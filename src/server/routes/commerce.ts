import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  cartItems,
  carts,
  coupons,
  orderItems,
  orders,
  paymentTransactions,
  productImages,
  products,
  productVariants,
  reviews,
  siteSettings,
  wishlists,
} from '../../db/schema.ts';
import { ensureSeeded } from '../../db/seed.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../../middleware/auth.ts';
import {
  generatePayURequestHash,
  getPayUConfig,
  verifyPayUResponseHash,
  verifyPayUTransactionServerSide,
} from '../payu.ts';
import { hydrateProducts } from './storefront.ts';

const router = Router();

async function getStoreSettings() {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, 'storefront'))
    .limit(1);
  return (rows[0]?.valueJson as Record<string, any>) || {
    freeShippingThreshold: 1999,
    flatShippingFee: 120,
    taxRatePercent: 5,
    codEnabled: true,
  };
}

async function getOrCreateCart(userId?: number, sessionId?: string) {
  if (userId) {
    const existing = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    if (existing.length > 0) {
      // Merge guest cart if sessionId provided
      if (sessionId) {
        const guestCart = await db
          .select()
          .from(carts)
          .where(eq(carts.sessionId, sessionId))
          .limit(1);
        if (guestCart.length > 0 && guestCart[0].id !== existing[0].id) {
          const guestItems = await db
            .select()
            .from(cartItems)
            .where(eq(cartItems.cartId, guestCart[0].id));
          for (const gi of guestItems) {
            const match = await db
              .select()
              .from(cartItems)
              .where(
                and(eq(cartItems.cartId, existing[0].id), eq(cartItems.variantId, gi.variantId))
              )
              .limit(1);
            if (match.length > 0) {
              await db
                .update(cartItems)
                .set({ quantity: match[0].quantity + gi.quantity })
                .where(eq(cartItems.id, match[0].id));
            } else {
              await db
                .update(cartItems)
                .set({ cartId: existing[0].id })
                .where(eq(cartItems.id, gi.id));
            }
          }
          await db.delete(carts).where(eq(carts.id, guestCart[0].id));
        }
      }
      return existing[0];
    }

    if (sessionId) {
      const guestCart = await db
        .select()
        .from(carts)
        .where(eq(carts.sessionId, sessionId))
        .limit(1);
      if (guestCart.length > 0) {
        const [claimed] = await db
          .update(carts)
          .set({ userId, sessionId: null, updatedAt: new Date() })
          .where(eq(carts.id, guestCart[0].id))
          .returning();
        return claimed;
      }
    }

    const [created] = await db.insert(carts).values({ userId }).returning();
    return created;
  }

  const sid = sessionId || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.select().from(carts).where(eq(carts.sessionId, sid)).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(carts).values({ sessionId: sid }).returning();
  return created;
}

async function computeCartResponse(cartRow: typeof carts.$inferSelect) {
  const items = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      productNameHi: products.nameHi,
      basePrice: products.sellingPrice,
      originalPrice: products.originalPrice,
      variantId: productVariants.id,
      sku: productVariants.sku,
      colorName: productVariants.colorName,
      colorHex: productVariants.colorHex,
      sizeName: productVariants.sizeName,
      priceOverride: productVariants.priceOverride,
      stockQuantity: productVariants.stockQuantity,
      variantImageUrl: productVariants.imageUrl,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartRow.id));

  const allImgs = await db.select().from(productImages);
  const allVars = await db.select().from(productVariants);

  const enrichedItems = items.map((item) => {
    const unitPrice = item.priceOverride ?? item.basePrice;
    const fallbackImg = allImgs
      .filter((img) => img.productId === item.productId)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url;
    const availableVariants = allVars.filter((v) => v.productId === item.productId && v.isActive);
    return {
      ...item,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      imageUrl: item.variantImageUrl || fallbackImg || '',
      availableVariants,
    };
  });

  const subtotal = enrichedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const settings = await getStoreSettings();
  const freeThreshold = Number(settings.freeShippingThreshold ?? 1999);
  const flatShipping = Number(settings.flatShippingFee ?? 120);
  const taxRate = Number(settings.taxRatePercent ?? 5);

  let discountAmount = 0;
  let appliedCoupon: { code: string; description: string } | null = null;

  if (cartRow.couponCode && subtotal > 0) {
    const found = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, cartRow.couponCode.toUpperCase()), eq(coupons.isActive, true)))
      .limit(1);
    if (found.length > 0) {
      const c = found[0];
      const notExpired = !c.expiresAt || new Date(c.expiresAt) > new Date();
      const underLimit = !c.usageLimit || c.usedCount < c.usageLimit;
      if (notExpired && underLimit && subtotal >= c.minOrderAmount) {
        if (c.discountType === 'percentage') {
          discountAmount = Math.round((subtotal * c.discountValue) / 100);
          if (c.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, c.maxDiscountAmount);
          }
        } else {
          discountAmount = Math.min(subtotal, c.discountValue);
        }
        appliedCoupon = { code: c.code, description: c.description || '' };
      }
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const shippingFee = subtotal === 0 ? 0 : discountedSubtotal >= freeThreshold ? 0 : flatShipping;
  const taxAmount = Math.round((discountedSubtotal * taxRate) / 100);
  const grandTotal = discountedSubtotal + shippingFee;

  return {
    cartId: cartRow.id,
    sessionId: cartRow.sessionId,
    items: enrichedItems,
    itemCount: enrichedItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    discountAmount,
    appliedCoupon,
    shippingFee,
    freeShippingThreshold: freeThreshold,
    taxIncludedNote: `Inclusive of ${taxRate}% GST (₹${taxAmount})`,
    taxAmount,
    grandTotal,
  };
}

// CART ROUTES
router.get('/cart', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
    const data = await computeCartResponse(cart);
    res.json(data);
  } catch (error) {
    console.error('Cart fetch error:', error);
    res.status(500).json({ error: 'Unable to load shopping cart.' });
  }
});

router.post('/cart/items', optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid cart item payload.' });
  }

  try {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, parsed.data.variantId),
          eq(productVariants.productId, parsed.data.productId)
        )
      )
      .limit(1);

    if (!variant || !variant.isActive) {
      return res.status(404).json({ error: 'Selected variant is unavailable.' });
    }
    if (variant.stockQuantity < parsed.data.quantity) {
      return res.status(409).json({
        error:
          variant.stockQuantity === 0
            ? 'This variant is currently out of stock.'
            : `Only ${variant.stockQuantity} pieces available in stock.`,
      });
    }

    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);

    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variant.id)))
      .limit(1);

    if (existing.length > 0) {
      const nextQty = existing[0].quantity + parsed.data.quantity;
      if (nextQty > variant.stockQuantity) {
        return res.status(409).json({
          error: `Only ${variant.stockQuantity} pieces available for this colour & size.`,
        });
      }
      await db
        .update(cartItems)
        .set({ quantity: nextQty })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId: parsed.data.productId,
        variantId: variant.id,
        quantity: parsed.data.quantity,
      });
    }

    const data = await computeCartResponse(cart);
    res.json(data);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Unable to add item to cart.' });
  }
});

router.patch('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
  const itemId = Number(req.params.id);
  const schema = z.object({
    quantity: z.number().int().min(1).max(20).optional(),
    variantId: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (Number.isNaN(itemId) || !parsed.success) {
    return res.status(400).json({ error: 'Invalid cart item update.' });
  }

  try {
    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    const targetVariantId = parsed.data.variantId ?? existing[0].variantId;
    const targetQuantity = parsed.data.quantity ?? existing[0].quantity;

    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, targetVariantId))
      .limit(1);

    if (!variant || variant.stockQuantity < targetQuantity) {
      return res.status(409).json({
        error:
          !variant || variant.stockQuantity === 0
            ? 'Selected variant is out of stock.'
            : `Only ${variant.stockQuantity} pieces available.`,
      });
    }

    await db
      .update(cartItems)
      .set({ variantId: targetVariantId, quantity: targetQuantity })
      .where(eq(cartItems.id, itemId));

    const data = await computeCartResponse(cart);
    res.json(data);
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Unable to update cart item.' });
  }
});

router.delete('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
  const itemId = Number(req.params.id);
  if (Number.isNaN(itemId)) return res.status(400).json({ error: 'Invalid cart item.' });
  try {
    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
    const data = await computeCartResponse(cart);
    res.json(data);
  } catch (error) {
    console.error('Delete cart item error:', error);
    res.status(500).json({ error: 'Unable to remove item from cart.' });
  }
});

router.post('/cart/coupon', optionalAuth, async (req: AuthRequest, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Please enter a coupon code.' });
  try {
    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
    const [found] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, code), eq(coupons.isActive, true)))
      .limit(1);

    if (!found) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code.' });
    }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This coupon has expired.' });
    }
    if (found.usageLimit && found.usedCount >= found.usageLimit) {
      return res.status(400).json({ error: 'This coupon usage limit has been reached.' });
    }

    const preview = await computeCartResponse(cart);
    if (preview.subtotal < found.minOrderAmount) {
      return res.status(400).json({
        error: `Minimum order of ₹${found.minOrderAmount} required for ${found.code}.`,
      });
    }

    const [updatedCart] = await db
      .update(carts)
      .set({ couponCode: found.code, updatedAt: new Date() })
      .where(eq(carts.id, cart.id))
      .returning();

    const data = await computeCartResponse(updatedCart);
    res.json(data);
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ error: 'Unable to apply coupon.' });
  }
});

router.delete('/cart/coupon', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = (req.headers['x-cart-session'] as string) || undefined;
    const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
    const [updated] = await db
      .update(carts)
      .set({ couponCode: null, updatedAt: new Date() })
      .where(eq(carts.id, cart.id))
      .returning();
    const data = await computeCartResponse(updated);
    res.json(data);
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({ error: 'Unable to remove coupon.' });
  }
});

// WISHLIST ROUTES
router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ product: products })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .where(eq(wishlists.userId, req.dbUser!.id))
      .orderBy(desc(wishlists.createdAt));

    const hydrated = await hydrateProducts(rows.map((r) => r.product));
    res.json({ items: hydrated });
  } catch (error) {
    console.error('Wishlist fetch error:', error);
    res.status(500).json({ error: 'Unable to load wishlist.' });
  }
});

router.post('/wishlist/toggle', requireAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.body?.productId);
  if (Number.isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID.' });
  try {
    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, req.dbUser!.id), eq(wishlists.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
      res.json({ wishlisted: false });
    } else {
      await db.insert(wishlists).values({ userId: req.dbUser!.id, productId });
      res.json({ wishlisted: true });
    }
  } catch (error) {
    console.error('Wishlist toggle error:', error);
    res.status(500).json({ error: 'Unable to update wishlist.' });
  }
});

// PAYU STATUS ENDPOINT (never exposes salt/secrets)
router.get('/payments/payu/status', (_req, res) => {
  const cfg = getPayUConfig();
  res.json({
    configured: cfg.configured,
    env: cfg.env,
  });
});

// ORDER CREATION WITH ATOMIC INVENTORY DEDUCTION + REAL PAYU INITIATION
router.post('/orders', optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    mobile: z.string().min(10).max(15),
    email: z.string().email(),
    houseFlat: z.string().min(1),
    streetArea: z.string().min(2),
    city: z.string().min(2),
    district: z.string().optional().default(''),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    landmark: z.string().optional().default(''),
    latitude: z.string().optional().default(''),
    longitude: z.string().optional().default(''),
    paymentMethod: z.enum(['payu', 'cod']).default('payu'),
    notes: z.string().optional().default(''),
    estimatedDelivery: z.string().optional().default('3–5 Business Days'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete all required checkout fields accurately.' });
  }

  const sessionId = (req.headers['x-cart-session'] as string) || undefined;
  const cart = await getOrCreateCart(req.dbUser?.id, sessionId);
  const cartSummary = await computeCartResponse(cart);

  if (cartSummary.items.length === 0) {
    return res.status(400).json({ error: 'Your shopping cart is empty.' });
  }

  const payuCfg = getPayUConfig();
  if (parsed.data.paymentMethod === 'payu' && !payuCfg.configured) {
    return res.status(503).json({
      error:
        'PayU India payment gateway is awaiting merchant credentials (PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT). You may configure them in environment secrets or choose Cash on Delivery.',
      code: 'PAYU_AWAITING_CREDENTIALS',
    });
  }

  try {
    const orderNumber = `ZRF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const createdOrder = await db.transaction(async (tx) => {
      // Atomic stock verification & deduction to prevent overselling
      for (const item of cartSummary.items) {
        const updatedVariants = await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              sql`${productVariants.stockQuantity} >= ${item.quantity}`
            )
          )
          .returning();

        if (updatedVariants.length === 0) {
          throw new Error(`INSUFFICIENT_STOCK:${item.productName} (${item.colorName} / ${item.sizeName})`);
        }
      }

      const isCod = parsed.data.paymentMethod === 'cod';
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: req.dbUser?.id ?? null,
          customerName: parsed.data.fullName.trim(),
          customerEmail: parsed.data.email.trim().toLowerCase(),
          customerPhone: parsed.data.mobile.trim(),
          shippingAddressJson: {
            fullName: parsed.data.fullName.trim(),
            mobile: parsed.data.mobile.trim(),
            email: parsed.data.email.trim().toLowerCase(),
            houseFlat: parsed.data.houseFlat.trim(),
            streetArea: parsed.data.streetArea.trim(),
            city: parsed.data.city.trim(),
            district: parsed.data.district.trim(),
            state: parsed.data.state.trim(),
            pincode: parsed.data.pincode.trim(),
            landmark: parsed.data.landmark.trim(),
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
          },
          subtotal: cartSummary.subtotal,
          discountAmount: cartSummary.discountAmount,
          couponCode: cartSummary.appliedCoupon?.code || null,
          shippingFee: cartSummary.shippingFee,
          taxAmount: cartSummary.taxAmount,
          grandTotal: cartSummary.grandTotal,
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: isCod ? 'pending' : 'initiated',
          orderStatus: isCod ? 'confirmed' : 'pending',
          estimatedDelivery: parsed.data.estimatedDelivery,
          notes: parsed.data.notes,
        })
        .returning();

      await tx.insert(orderItems).values(
        cartSummary.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          colorName: item.colorName,
          sizeName: item.sizeName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.lineTotal,
          imageUrl: item.imageUrl,
        }))
      );

      if (cartSummary.appliedCoupon?.code) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(eq(coupons.code, cartSummary.appliedCoupon.code));
      }

      // Clear cart after atomic order creation
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await tx.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));

      return order;
    });

    // If PayU India online payment, generate official SHA-512 signed redirect payload
    if (parsed.data.paymentMethod === 'payu') {
      const txnid = `ZRF${Date.now()}${Math.floor(100 + Math.random() * 899)}`;
      const amount = Number(createdOrder.grandTotal).toFixed(2);
      const productinfo = `ZARIFLY Order ${createdOrder.orderNumber}`;
      const firstname = parsed.data.fullName.trim().split(' ')[0];
      const email = parsed.data.email.trim().toLowerCase();
      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

      const hash = generatePayURequestHash({
        key: payuCfg.key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1: createdOrder.orderNumber,
        salt: payuCfg.salt,
      });

      await db.insert(paymentTransactions).values({
        orderId: createdOrder.id,
        gateway: 'payu',
        txnid,
        status: 'initiated',
        amount,
        hashSent: hash,
      });

      return res.status(201).json({
        order: createdOrder,
        paymentGateway: 'payu',
        payuPayload: {
          actionUrl: payuCfg.actionUrl,
          fields: {
            key: payuCfg.key,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            phone: parsed.data.mobile.trim(),
            surl: `${baseUrl}/api/payments/payu/success`,
            furl: `${baseUrl}/api/payments/payu/failure`,
            udf1: createdOrder.orderNumber,
            hash,
          },
        },
      });
    }

    res.status(201).json({
      order: createdOrder,
      paymentGateway: 'cod',
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      return res.status(409).json({
        error: `Insufficient stock for ${error.message.replace('INSUFFICIENT_STOCK:', '')}. Please adjust your cart.`,
      });
    }
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Unable to process your order. Please try again.' });
  }
});

// PAYU SERVER-SIDE SUCCESS CALLBACK (SHA-512 hash + verify_payment + idempotency)
router.post('/payments/payu/success', async (req, res) => {
  const payload = req.body as Record<string, string>;
  const cfg = getPayUConfig();
  const txnid = payload.txnid || '';
  const orderNumber = payload.udf1 || '';

  if (!txnid || !cfg.configured) {
    return res.redirect(`/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=failed`);
  }

  try {
    const [txn] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.txnid, txnid))
      .limit(1);

    if (!txn) {
      return res.redirect(`/order-confirmation?payment=failed`);
    }

    // Duplicate callback idempotency protection
    if (txn.status === 'success' && txn.hashVerified) {
      return res.redirect(
        `/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=success`
      );
    }

    const hashOk = verifyPayUResponseHash(payload, cfg.salt);
    const serverVerify = await verifyPayUTransactionServerSide(txnid);

    if (hashOk && payload.status === 'success' && serverVerify.verified) {
      await db.transaction(async (tx) => {
        await tx
          .update(paymentTransactions)
          .set({
            status: 'success',
            mihpayid: payload.mihpayid || serverVerify.mihpayid || '',
            hashVerified: true,
            rawPayloadJson: payload,
            updatedAt: new Date(),
          })
          .where(eq(paymentTransactions.id, txn.id));

        await tx
          .update(orders)
          .set({
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            updatedAt: new Date(),
          })
          .where(eq(orders.id, txn.orderId));
      });

      return res.redirect(
        `/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=success`
      );
    }

    await db
      .update(paymentTransactions)
      .set({
        status: 'failure',
        hashVerified: hashOk,
        rawPayloadJson: payload,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactions.id, txn.id));

    return res.redirect(
      `/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=verification_failed`
    );
  } catch (error) {
    console.error('PayU success callback error:', error);
    return res.redirect(
      `/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=failed`
    );
  }
});

// PAYU SERVER-SIDE FAILURE CALLBACK (restores stock idempotently)
router.post('/payments/payu/failure', async (req, res) => {
  const payload = req.body as Record<string, string>;
  const txnid = payload.txnid || '';
  const orderNumber = payload.udf1 || '';

  try {
    if (txnid) {
      const [txn] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.txnid, txnid))
        .limit(1);

      if (txn && txn.status === 'initiated') {
        await db.transaction(async (tx) => {
          await tx
            .update(paymentTransactions)
            .set({
              status: 'failure',
              mihpayid: payload.mihpayid || '',
              rawPayloadJson: payload,
              updatedAt: new Date(),
            })
            .where(eq(paymentTransactions.id, txn.id));

          await tx
            .update(orders)
            .set({
              paymentStatus: 'failed',
              orderStatus: 'cancelled',
              updatedAt: new Date(),
            })
            .where(eq(orders.id, txn.orderId));

          // Restore variant stock on failed payment
          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, txn.orderId));
          for (const item of items) {
            if (item.variantId) {
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
                })
                .where(eq(productVariants.id, item.variantId));
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('PayU failure callback error:', error);
  }

  res.redirect(`/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=failed`);
});

// CUSTOMER ORDERS & ORDER TRACKING
router.get('/orders/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.dbUser!.id))
      .orderBy(desc(orders.createdAt));

    const allItems = await db.select().from(orderItems);
    const enriched = userOrders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
    }));
    res.json({ orders: enriched });
  } catch (error) {
    console.error('My orders error:', error);
    res.status(500).json({ error: 'Unable to load your orders.' });
  }
});

router.get('/orders/track', async (req, res) => {
  const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
  const contact = String(req.query.contact || '').trim().toLowerCase();

  if (!orderNumber) {
    return res.status(400).json({ error: 'Please enter an order number.' });
  }
  try {
    const found = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'No order found matching that order number.' });
    }
    const order = found[0];
    if (contact) {
      const emailMatch = order.customerEmail.toLowerCase() === contact;
      const phoneMatch = order.customerPhone.replace(/\D/g, '').endsWith(contact.replace(/\D/g, ''));
      if (!emailMatch && !phoneMatch) {
        return res
          .status(404)
          .json({ error: 'Order number does not match the provided email or mobile number.' });
      }
    }
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    res.json({ order: { ...order, items } });
  } catch (error) {
    console.error('Order track error:', error);
    res.status(500).json({ error: 'Unable to look up order status.' });
  }
});

router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, req.params.orderNumber))
      .limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    res.json({ order: { ...order, items } });
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Unable to load order.' });
  }
});

// GENUINE CUSTOMER REVIEW SUBMISSION (Verified Purchase linked to actual completed orders)
router.post('/reviews', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    title: z.string().max(120).optional().default(''),
    comment: z.string().min(8).max(1500),
    images: z.array(z.string().url()).max(4).optional().default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Please select a star rating and write at least 8 characters.' });
  }

  try {
    const userId = req.dbUser!.id;
    // Check if the customer actually purchased this product in a real completed/paid/delivered order
    const purchased = await db
      .select({ orderId: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orderItems.productId, parsed.data.productId),
          sql`${orders.orderStatus} IN ('confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered')`
        )
      )
      .limit(1);

    const isVerifiedPurchase = purchased.length > 0;
    const orderId = purchased[0]?.orderId ?? null;

    // One review per user per product (allows editing existing review)
    const existing = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.productId, parsed.data.productId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(reviews)
        .set({
          rating: parsed.data.rating,
          title: parsed.data.title,
          comment: parsed.data.comment,
          imagesJson: parsed.data.images,
          isVerifiedPurchase,
          orderId,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, existing[0].id))
        .returning();
      return res.json({
        review: updated,
        message: 'Your review has been updated and submitted for moderation.',
      });
    }

    const [created] = await db
      .insert(reviews)
      .values({
        productId: parsed.data.productId,
        userId,
        orderId,
        rating: parsed.data.rating,
        title: parsed.data.title,
        comment: parsed.data.comment,
        imagesJson: parsed.data.images,
        isVerifiedPurchase,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      review: created,
      message: isVerifiedPurchase
        ? 'Thank you! Your Verified Purchase review has been submitted for approval.'
        : 'Thank you! Your review has been submitted for moderation.',
    });
  } catch (error) {
    console.error('Review submit error:', error);
    res.status(500).json({ error: 'Unable to submit review.' });
  }
});

export default router;
