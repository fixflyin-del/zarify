import { Router } from 'express';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminActivityLogs,
  banners,
  blogs,
  categories,
  contactMessages,
  coupons,
  newsletterSubscribers,
  orderItems,
  orders,
  paymentTransactions,
  productImages,
  products,
  productVariants,
  reels,
  reviews,
  siteSettings,
  users,
} from '../../db/schema.ts';
import { AuthRequest, requireAdmin } from '../../middleware/auth.ts';
import { generateCloudinaryUploadSignature, getCloudinaryConfig } from '../cloudinary.ts';
import { getPayUConfig, initiatePayURefund } from '../payu.ts';
import { hydrateProducts } from './storefront.ts';

const router = Router();
router.use(requireAdmin);

async function logAdminAction(
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId: string | number = '',
  details: Record<string, unknown> = {}
) {
  try {
    await db.insert(adminActivityLogs).values({
      adminUserId: req.dbUser?.id ?? null,
      adminEmail: req.dbUser?.email || 'admin',
      action,
      entityType,
      entityId: String(entityId),
      detailsJson: details,
    });
  } catch (err) {
    console.error('Admin log insert failed:', err);
  }
}

// DASHBOARD OVERVIEW
router.get('/dashboard', async (_req, res) => {
  try {
    const [allOrders, allUsers, allProducts, allVariants, allOrderItems] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(users),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(orderItems),
    ]);

    const totalRevenue = allOrders
      .filter((o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded')
      .reduce((sum, o) => sum + o.grandTotal, 0);

    const pendingOrders = allOrders.filter((o) =>
      ['pending', 'confirmed', 'processing'].includes(o.orderStatus)
    ).length;
    const completedOrders = allOrders.filter((o) => o.orderStatus === 'delivered').length;
    const cancelledOrders = allOrders.filter((o) =>
      ['cancelled', 'returned', 'refunded'].includes(o.orderStatus)
    ).length;

    const prodMap = new Map(allProducts.map((p) => [p.id, p]));
    const lowStockVariants = allVariants
      .filter((v) => v.isActive && v.stockQuantity <= 5)
      .map((v) => ({
        ...v,
        productName: prodMap.get(v.productId)?.name || 'Unknown',
      }))
      .sort((a, b) => a.stockQuantity - b.stockQuantity);

    // Best selling products computed from real order_items (fallback to flagged best sellers)
    const soldByProduct = new Map<number, { productName: string; unitsSold: number; revenue: number }>();
    for (const item of allOrderItems) {
      if (!item.productId) continue;
      const prev = soldByProduct.get(item.productId) || {
        productName: item.productName,
        unitsSold: 0,
        revenue: 0,
      };
      prev.unitsSold += item.quantity;
      prev.revenue += item.totalPrice;
      soldByProduct.set(item.productId, prev);
    }

    const bestSellingProducts = Array.from(soldByProduct.entries())
      .map(([productId, stats]) => ({ productId, ...stats }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    const cloudinaryCfg = getCloudinaryConfig();
    const payuCfg = getPayUConfig();

    res.json({
      metrics: {
        totalRevenue,
        totalOrders: allOrders.length,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalCustomers: allUsers.filter((u) => u.role === 'customer').length,
        totalProducts: allProducts.length,
        lowStockCount: lowStockVariants.length,
      },
      lowStockVariants: lowStockVariants.slice(0, 10),
      bestSellingProducts,
      recentOrders: allOrders.slice(0, 8),
      integrations: {
        cloudinary: {
          configured: cloudinaryCfg.configured,
          cloudName: cloudinaryCfg.cloudName,
        },
        payu: {
          configured: payuCfg.configured,
          env: payuCfg.env,
        },
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Unable to load dashboard analytics.' });
  }
});

// CLOUDINARY SECURE UPLOAD SIGNATURE
router.post('/cloudinary/signature', async (req: AuthRequest, res) => {
  const subfolder = String(req.body?.folder || 'products').replace(/[^a-zA-Z0-9_-]/g, '');
  const signed = generateCloudinaryUploadSignature(subfolder);
  if (!signed) {
    return res.status(503).json({
      configured: false,
      error:
        'Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in environment secrets.',
    });
  }
  res.json({ configured: true, ...signed });
});

// PRODUCTS CRUD (with 5-image gallery + variants)
router.get('/products', async (_req, res) => {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt));
    const hydrated = await hydrateProducts(rows);
    const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    res.json({ products: hydrated, categories: cats });
  } catch (error) {
    console.error('Admin products error:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

const productPayloadSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2),
  nameHi: z.string().optional().default(''),
  slug: z.string().min(2),
  sku: z.string().min(2),
  description: z.string().min(5),
  descriptionHi: z.string().optional().default(''),
  fabric: z.string().optional().default(''),
  workDetails: z.string().optional().default(''),
  sellingPrice: z.number().int().positive(),
  originalPrice: z.number().int().positive(),
  isActive: z.boolean().default(true),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().optional().default(''),
  seoDescription: z.string().optional().default(''),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        cloudinaryPublicId: z.string().optional().default(''),
        altText: z.string().optional().default(''),
        colorName: z.string().optional().default(''),
        sortOrder: z.number().int().default(0),
      })
    )
    .min(1)
    .max(5),
  variants: z
    .array(
      z.object({
        id: z.number().int().optional(),
        sku: z.string().min(2),
        colorName: z.string().min(1),
        colorHex: z.string().default('#C6A25A'),
        sizeName: z.string().min(1),
        priceOverride: z.number().int().nullable().optional(),
        stockQuantity: z.number().int().min(0),
        imageUrl: z.string().optional().default(''),
        isActive: z.boolean().optional().default(true),
      })
    )
    .min(1),
});

router.post('/products', async (req: AuthRequest, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid product payload.', details: parsed.error.flatten() });
  }

  try {
    const data = parsed.data;
    const created = await db.transaction(async (tx) => {
      const [prod] = await tx
        .insert(products)
        .values({
          categoryId: data.categoryId,
          name: data.name,
          nameHi: data.nameHi,
          slug: data.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          sku: data.sku.toUpperCase(),
          description: data.description,
          descriptionHi: data.descriptionHi,
          fabric: data.fabric,
          workDetails: data.workDetails,
          sellingPrice: data.sellingPrice,
          originalPrice: Math.max(data.originalPrice, data.sellingPrice),
          isActive: data.isActive,
          isBestSeller: data.isBestSeller,
          isNewArrival: data.isNewArrival,
          isFeatured: data.isFeatured,
          seoTitle: data.seoTitle || `${data.name} | ZARIFLY`,
          seoDescription: data.seoDescription || data.description.slice(0, 155),
        })
        .returning();

      await tx.insert(productImages).values(
        data.images.map((img, idx) => ({
          productId: prod.id,
          url: img.url,
          cloudinaryPublicId: img.cloudinaryPublicId,
          altText: img.altText || data.name,
          colorName: img.colorName,
          sortOrder: idx,
        }))
      );

      await tx.insert(productVariants).values(
        data.variants.map((v) => ({
          productId: prod.id,
          sku: v.sku.toUpperCase(),
          colorName: v.colorName,
          colorHex: v.colorHex,
          sizeName: v.sizeName,
          priceOverride: v.priceOverride ?? null,
          stockQuantity: v.stockQuantity,
          imageUrl: v.imageUrl,
          isActive: v.isActive ?? true,
        }))
      );

      return prod;
    });

    await logAdminAction(req, 'CREATE_PRODUCT', 'product', created.id, { name: created.name });
    const [hydrated] = await hydrateProducts([created]);
    res.status(201).json({ product: hydrated });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(400).json({ error: error?.message || 'Unable to create product (check unique SKU/slug).' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = productPayloadSchema.safeParse(req.body);
  if (Number.isNaN(id) || !parsed.success) {
    return res.status(400).json({ error: 'Invalid product update payload.' });
  }

  try {
    const data = parsed.data;
    const updated = await db.transaction(async (tx) => {
      const [prod] = await tx
        .update(products)
        .set({
          categoryId: data.categoryId,
          name: data.name,
          nameHi: data.nameHi,
          slug: data.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          sku: data.sku.toUpperCase(),
          description: data.description,
          descriptionHi: data.descriptionHi,
          fabric: data.fabric,
          workDetails: data.workDetails,
          sellingPrice: data.sellingPrice,
          originalPrice: Math.max(data.originalPrice, data.sellingPrice),
          isActive: data.isActive,
          isBestSeller: data.isBestSeller,
          isNewArrival: data.isNewArrival,
          isFeatured: data.isFeatured,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!prod) return null;

      await tx.delete(productImages).where(eq(productImages.productId, id));
      await tx.insert(productImages).values(
        data.images.map((img, idx) => ({
          productId: id,
          url: img.url,
          cloudinaryPublicId: img.cloudinaryPublicId,
          altText: img.altText || data.name,
          colorName: img.colorName,
          sortOrder: idx,
        }))
      );

      // Update or insert variants safely
      await tx.delete(productVariants).where(eq(productVariants.productId, id));
      await tx.insert(productVariants).values(
        data.variants.map((v) => ({
          productId: id,
          sku: v.sku.toUpperCase(),
          colorName: v.colorName,
          colorHex: v.colorHex,
          sizeName: v.sizeName,
          priceOverride: v.priceOverride ?? null,
          stockQuantity: v.stockQuantity,
          imageUrl: v.imageUrl,
          isActive: v.isActive ?? true,
        }))
      );

      return prod;
    });

    if (!updated) return res.status(404).json({ error: 'Product not found.' });
    await logAdminAction(req, 'UPDATE_PRODUCT', 'product', id, { name: updated.name });
    const [hydrated] = await hydrateProducts([updated]);
    res.json({ product: hydrated });
  } catch (error: any) {
    console.error('Update product error:', error);
    res.status(400).json({ error: error?.message || 'Unable to update product.' });
  }
});

router.delete('/products/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid product ID.' });
  try {
    await db.delete(products).where(eq(products.id, id));
    await logAdminAction(req, 'DELETE_PRODUCT', 'product', id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

// ORDERS MANAGEMENT + REFUND
router.get('/orders', async (req, res) => {
  try {
    const statusFilter = String(req.query.status || '');
    const paymentFilter = String(req.query.paymentStatus || '');
    const search = String(req.query.search || '').trim().toLowerCase();

    const [allOrders, allItems, allTxns] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(paymentTransactions),
    ]);

    let filtered = allOrders;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.orderStatus === statusFilter);
    }
    if (paymentFilter && paymentFilter !== 'all') {
      filtered = filtered.filter((o) => o.paymentStatus === paymentFilter);
    }
    if (search) {
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search) ||
          o.customerName.toLowerCase().includes(search) ||
          o.customerEmail.toLowerCase().includes(search) ||
          o.customerPhone.includes(search)
      );
    }

    res.json({
      orders: filtered.map((o) => ({
        ...o,
        items: allItems.filter((i) => i.orderId === o.id),
        transactions: allTxns.filter((t) => t.orderId === o.id),
      })),
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

router.patch('/orders/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    orderStatus: z
      .enum([
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'return_requested',
        'returned',
        'refunded',
      ])
      .optional(),
    paymentStatus: z.enum(['pending', 'initiated', 'paid', 'failed', 'refunded']).optional(),
    courierName: z.string().optional(),
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (Number.isNaN(id) || !parsed.success) {
    return res.status(400).json({ error: 'Invalid order update.' });
  }

  try {
    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const [updated] = await db
      .update(orders)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    // Restore stock if transitioning into cancelled for the first time
    if (parsed.data.orderStatus === 'cancelled' && existing.orderStatus !== 'cancelled') {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
      for (const item of items) {
        if (item.variantId) {
          await db
            .update(productVariants)
            .set({ stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId));
        }
      }
    }

    await logAdminAction(req, 'UPDATE_ORDER', 'order', existing.orderNumber, parsed.data);
    res.json({ order: updated });
  } catch (error) {
    console.error('Admin order update error:', error);
    res.status(500).json({ error: 'Unable to update order.' });
  }
});

router.post('/orders/:id/refund', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid order ID.' });
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (order.paymentMethod === 'payu') {
      const [txn] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.orderId, order.id))
        .limit(1);

      if (!txn || !txn.mihpayid) {
        return res
          .status(400)
          .json({ error: 'No verified PayU mihpayid transaction found for this order.' });
      }
      const tokenId = `RFND-${Date.now()}`;
      const result = await initiatePayURefund({
        mihpayid: txn.mihpayid,
        tokenId,
        amount: Number(order.grandTotal).toFixed(2),
      });

      if (!result.ok) {
        return res.status(400).json({ error: result.message });
      }

      await db
        .update(paymentTransactions)
        .set({ refundId: tokenId, refundStatus: 'initiated', status: 'refunded', updatedAt: new Date() })
        .where(eq(paymentTransactions.id, txn.id));
    }

    const [updated] = await db
      .update(orders)
      .set({ paymentStatus: 'refunded', orderStatus: 'refunded', updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    await logAdminAction(req, 'REFUND_ORDER', 'order', order.orderNumber);
    res.json({ order: updated, message: 'Refund workflow recorded.' });
  } catch (error) {
    console.error('Order refund error:', error);
    res.status(500).json({ error: 'Unable to process refund.' });
  }
});

// CUSTOMERS
router.get('/customers', async (_req, res) => {
  try {
    const [allUsers, allOrders] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
    ]);

    const customers = allUsers.map((u) => {
      const userOrders = allOrders.filter(
        (o) => o.userId === u.id || o.customerEmail.toLowerCase() === u.email.toLowerCase()
      );
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        createdAt: u.createdAt,
        orderCount: userOrders.length,
        totalSpent: userOrders
          .filter((o) => o.orderStatus !== 'cancelled')
          .reduce((s, o) => s + o.grandTotal, 0),
        orders: userOrders,
      };
    });

    res.json({ customers });
  } catch (error) {
    console.error('Admin customers error:', error);
    res.status(500).json({ error: 'Unable to load customers.' });
  }
});

// BANNERS CRUD
router.get('/banners', async (_req, res) => {
  const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder));
  res.json({ banners: rows });
});

router.post('/banners', async (req: AuthRequest, res) => {
  try {
    const [created] = await db.insert(banners).values(req.body).returning();
    await logAdminAction(req, 'CREATE_BANNER', 'banner', created.id);
    res.status(201).json({ banner: created });
  } catch (error) {
    console.error('Banner create error:', error);
    res.status(400).json({ error: 'Unable to create banner.' });
  }
});

router.put('/banners/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [updated] = await db.update(banners).set(req.body).where(eq(banners.id, id)).returning();
    await logAdminAction(req, 'UPDATE_BANNER', 'banner', id);
    res.json({ banner: updated });
  } catch (error) {
    res.status(400).json({ error: 'Unable to update banner.' });
  }
});

router.delete('/banners/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(banners).where(eq(banners.id, id));
  await logAdminAction(req, 'DELETE_BANNER', 'banner', id);
  res.json({ ok: true });
});

// REELS CRUD
router.get('/reels', async (_req, res) => {
  const rows = await db.select().from(reels).orderBy(asc(reels.sortOrder));
  res.json({ reels: rows });
});

router.post('/reels', async (req: AuthRequest, res) => {
  try {
    const [created] = await db.insert(reels).values(req.body).returning();
    await logAdminAction(req, 'CREATE_REEL', 'reel', created.id);
    res.status(201).json({ reel: created });
  } catch {
    res.status(400).json({ error: 'Unable to create reel.' });
  }
});

router.put('/reels/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [updated] = await db.update(reels).set(req.body).where(eq(reels.id, id)).returning();
    await logAdminAction(req, 'UPDATE_REEL', 'reel', id);
    res.json({ reel: updated });
  } catch {
    res.status(400).json({ error: 'Unable to update reel.' });
  }
});

router.delete('/reels/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(reels).where(eq(reels.id, id));
  await logAdminAction(req, 'DELETE_REEL', 'reel', id);
  res.json({ ok: true });
});

// REVIEWS MODERATION
router.get('/reviews', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        imagesJson: reviews.imagesJson,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        status: reviews.status,
        createdAt: reviews.createdAt,
        customerName: users.fullName,
        customerEmail: users.email,
        productName: products.name,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(products, eq(reviews.productId, products.id))
      .orderBy(desc(reviews.createdAt));
    res.json({ reviews: rows });
  } catch {
    res.status(500).json({ error: 'Unable to load reviews.' });
  }
});

router.patch('/reviews/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid review status.' });
  }
  const [updated] = await db
    .update(reviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning();
  await logAdminAction(req, 'MODERATE_REVIEW', 'review', id, { status });
  res.json({ review: updated });
});

router.delete('/reviews/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(reviews).where(eq(reviews.id, id));
  await logAdminAction(req, 'DELETE_REVIEW', 'review', id);
  res.json({ ok: true });
});

// BLOGS CRUD
router.get('/blogs', async (_req, res) => {
  const rows = await db.select().from(blogs).orderBy(desc(blogs.createdAt));
  res.json({ blogs: rows });
});

router.post('/blogs', async (req: AuthRequest, res) => {
  try {
    const [created] = await db.insert(blogs).values(req.body).returning();
    await logAdminAction(req, 'CREATE_BLOG', 'blog', created.id, { title: created.title });
    res.status(201).json({ blog: created });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to create blog post.' });
  }
});

router.put('/blogs/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [updated] = await db
      .update(blogs)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(blogs.id, id))
      .returning();
    await logAdminAction(req, 'UPDATE_BLOG', 'blog', id);
    res.json({ blog: updated });
  } catch {
    res.status(400).json({ error: 'Unable to update blog post.' });
  }
});

router.delete('/blogs/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(blogs).where(eq(blogs.id, id));
  await logAdminAction(req, 'DELETE_BLOG', 'blog', id);
  res.json({ ok: true });
});

// COUPONS CRUD
router.get('/coupons', async (_req, res) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  res.json({ coupons: rows });
});

router.post('/coupons', async (req: AuthRequest, res) => {
  try {
    const body = { ...req.body, code: String(req.body.code || '').toUpperCase().trim() };
    const [created] = await db.insert(coupons).values(body).returning();
    await logAdminAction(req, 'CREATE_COUPON', 'coupon', created.code);
    res.status(201).json({ coupon: created });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to create coupon.' });
  }
});

router.delete('/coupons/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(coupons).where(eq(coupons.id, id));
  await logAdminAction(req, 'DELETE_COUPON', 'coupon', id);
  res.json({ ok: true });
});

// SUBSCRIBERS, CONTACT MESSAGES, SETTINGS, LOGS
router.get('/subscribers', async (_req, res) => {
  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt));
  res.json({ subscribers: rows });
});

router.get('/messages', async (_req, res) => {
  const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  res.json({ messages: rows });
});

router.get('/settings', async (_req, res) => {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, 'storefront'))
    .limit(1);
  res.json({ settings: rows[0]?.valueJson || {} });
});

router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const [saved] = await db
      .insert(siteSettings)
      .values({ key: 'storefront', valueJson: req.body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: req.body, updatedAt: new Date() },
      })
      .returning();
    await logAdminAction(req, 'UPDATE_SETTINGS', 'site_settings', 'storefront');
    res.json({ settings: saved.valueJson });
  } catch {
    res.status(500).json({ error: 'Unable to save website settings.' });
  }
});

router.get('/activity-logs', async (_req, res) => {
  const rows = await db
    .select()
    .from(adminActivityLogs)
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(50);
  res.json({ logs: rows });
});

export default router;
