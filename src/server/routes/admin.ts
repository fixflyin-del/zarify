import { Router } from 'express';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDatabaseConfigured } from '../../db/index.ts';
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
import { getFallbackState } from '../fallbackStore.ts';
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
  if (!isDatabaseConfigured()) return;
  try {
    await db.insert(adminActivityLogs).values({
      adminUserId: req.dbUser?.id && req.dbUser.id < 999000 ? req.dbUser.id : null,
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

function buildFallbackDashboard() {
  const s = getFallbackState();
  const lowStockVariants = s.products.flatMap((p) =>
    p.variants
      .filter((v) => v.isActive !== false && v.stockQuantity <= 5)
      .map((v) => ({ ...v, productName: p.name }))
  );
  const cloudinaryCfg = getCloudinaryConfig();
  const payuCfg = getPayUConfig();
  return {
    storageMode: 'fallback' as const,
    metrics: {
      totalRevenue: 0,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalCustomers: 0,
      totalProducts: s.products.length,
      lowStockCount: lowStockVariants.length,
    },
    lowStockVariants: lowStockVariants.slice(0, 10),
    bestSellingProducts: [],
    recentOrders: [],
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
  };
}

// DASHBOARD OVERVIEW
router.get('/dashboard', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json(buildFallbackDashboard());
  }
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

    const soldByProduct = new Map<
      number,
      { productName: string; unitsSold: number; revenue: number }
    >();
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
      storageMode: 'postgresql' as const,
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
    console.error('Admin dashboard DB error (using fallback):', error);
    res.json(buildFallbackDashboard());
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
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    return res.json({ products: s.products, categories: s.categories });
  }
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt));
    const hydrated = await hydrateProducts(rows);
    const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    res.json({ products: hydrated, categories: cats });
  } catch (error) {
    console.error('Admin products DB error (using fallback):', error);
    const s = getFallbackState();
    res.json({ products: s.products, categories: s.categories });
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
        colorHex: z.string().default('#FF4D8D'),
        sizeName: z.string().min(1),
        priceOverride: z.number().int().nullable().optional(),
        stockQuantity: z.number().int().min(0),
        imageUrl: z.string().optional().default(''),
        isActive: z.boolean().optional().default(true),
      })
    )
    .min(1),
});

function buildFallbackProduct(id: number, data: z.infer<typeof productPayloadSchema>) {
  const s = getFallbackState();
  const cat = s.categories.find((c) => c.id === data.categoryId) || s.categories[0] || null;
  const orig = Math.max(data.originalPrice, data.sellingPrice);
  const totalStock = data.variants.reduce((acc, v) => acc + v.stockQuantity, 0);
  const discountPercent = orig > data.sellingPrice ? Math.round(((orig - data.sellingPrice) / orig) * 100) : 0;
  return {
    id,
    categoryId: data.categoryId,
    slug: data.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: data.name,
    nameHi: data.nameHi,
    sku: data.sku.toUpperCase(),
    description: data.description,
    descriptionHi: data.descriptionHi,
    fabric: data.fabric,
    workDetails: data.workDetails,
    sellingPrice: data.sellingPrice,
    originalPrice: orig,
    isActive: data.isActive,
    isBestSeller: data.isBestSeller,
    isNewArrival: data.isNewArrival,
    isFeatured: data.isFeatured,
    seoTitle: data.seoTitle || `${data.name} | ZARIFLY`,
    seoDescription: data.seoDescription || data.description.slice(0, 155),
    category: cat,
    images: data.images.map((img, idx) => ({
      id: id * 10 + idx + 1,
      url: img.url,
      cloudinaryPublicId: img.cloudinaryPublicId,
      altText: img.altText || data.name,
      colorName: img.colorName,
      sortOrder: idx,
    })),
    variants: data.variants.map((v, idx) => ({
      id: v.id || id * 100 + idx + 1,
      sku: v.sku.toUpperCase(),
      colorName: v.colorName,
      colorHex: v.colorHex,
      sizeName: v.sizeName,
      priceOverride: v.priceOverride ?? null,
      stockQuantity: v.stockQuantity,
      imageUrl: v.imageUrl,
      isActive: v.isActive ?? true,
    })),
    reviewCount: 0,
    avgRating: 0,
    totalStock,
    discountPercent,
  };
}

router.post('/products', async (req: AuthRequest, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid product payload.', details: parsed.error.flatten() });
  }

  const data = parsed.data;
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const created = buildFallbackProduct(s.nextId++, data);
    s.products.unshift(created);
    return res.status(201).json({ product: created });
  }

  try {
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
    res
      .status(400)
      .json({ error: error?.message || 'Unable to create product (check unique SKU/slug).' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = productPayloadSchema.safeParse(req.body);
  if (Number.isNaN(id) || !parsed.success) {
    return res.status(400).json({ error: 'Invalid product update payload.' });
  }

  const data = parsed.data;
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const idx = s.products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found.' });
    const updated = buildFallbackProduct(id, data);
    s.products[idx] = updated;
    return res.json({ product: updated });
  }

  try {
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
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.products = s.products.filter((p) => p.id !== id);
    return res.json({ ok: true });
  }
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
  if (!isDatabaseConfigured()) {
    return res.json({ orders: [] });
  }
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
    res.json({ orders: [] });
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
  if (!isDatabaseConfigured()) {
    return res.json({ customers: [] });
  }
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
    res.json({ customers: [] });
  }
});

// BANNERS CRUD
function sanitizeBannerBody(body: any) {
  return {
    heading: String(body.heading || '').trim(),
    headingHi: String(body.headingHi || '').trim(),
    subheading: String(body.subheading || '').trim(),
    subheadingHi: String(body.subheadingHi || '').trim(),
    ctaText: String(body.ctaText || 'Shop Collection').trim(),
    ctaTextHi: String(body.ctaTextHi || 'कलेक्शन देखें').trim(),
    ctaUrl: String(body.ctaUrl || '/shop').trim(),
    desktopImageUrl: String(body.desktopImageUrl || '').trim(),
    mobileImageUrl: String(body.mobileImageUrl || body.desktopImageUrl || '').trim(),
    sortOrder: Number(body.sortOrder) || 1,
    isActive: body.isActive !== false,
  };
}

router.get('/banners', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ banners: getFallbackState().banners });
  }
  try {
    const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder));
    res.json({ banners: rows });
  } catch {
    res.json({ banners: getFallbackState().banners });
  }
});

router.post('/banners', async (req: AuthRequest, res) => {
  const payload = sanitizeBannerBody(req.body);
  if (!payload.heading || !payload.desktopImageUrl) {
    return res.status(400).json({ error: 'Banner heading and image URL are required.' });
  }
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const created = { id: s.nextId++, ...payload };
    s.banners.push(created);
    return res.status(201).json({ banner: created });
  }
  try {
    const [created] = await db.insert(banners).values(payload).returning();
    await logAdminAction(req, 'CREATE_BANNER', 'banner', created.id, { heading: created.heading });
    res.status(201).json({ banner: created });
  } catch (error) {
    console.error('Banner create error:', error);
    res.status(400).json({ error: 'Unable to create banner.' });
  }
});

router.put('/banners/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const payload = sanitizeBannerBody(req.body);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const idx = s.banners.findIndex((b) => b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Banner not found.' });
    s.banners[idx] = { ...s.banners[idx], ...payload };
    return res.json({ banner: s.banners[idx] });
  }
  try {
    const [updated] = await db
      .update(banners)
      .set(payload)
      .where(eq(banners.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Banner not found.' });
    await logAdminAction(req, 'UPDATE_BANNER', 'banner', id, { heading: updated.heading });
    res.json({ banner: updated });
  } catch (error) {
    console.error('Banner update error:', error);
    res.status(400).json({ error: 'Unable to update banner.' });
  }
});

router.delete('/banners/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.banners = s.banners.filter((b) => b.id !== id);
    return res.json({ ok: true });
  }
  try {
    await db.delete(banners).where(eq(banners.id, id));
    await logAdminAction(req, 'DELETE_BANNER', 'banner', id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete banner.' });
  }
});

// REELS CRUD
function sanitizeReelBody(body: any) {
  return {
    title: String(body.title || '').trim(),
    caption: String(body.caption || '').trim(),
    videoUrl: String(body.videoUrl || '').trim(),
    thumbnailUrl: String(body.thumbnailUrl || '').trim(),
    productId: body.productId ? Number(body.productId) : null,
    sortOrder: Number(body.sortOrder) || 1,
    isActive: body.isActive !== false,
  };
}

router.get('/reels', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ reels: getFallbackState().reels });
  }
  try {
    const rows = await db.select().from(reels).orderBy(asc(reels.sortOrder));
    res.json({ reels: rows });
  } catch {
    res.json({ reels: getFallbackState().reels });
  }
});

router.post('/reels', async (req: AuthRequest, res) => {
  const payload = sanitizeReelBody(req.body);
  if (!payload.title || !payload.thumbnailUrl) {
    return res.status(400).json({ error: 'Reel title and thumbnail URL are required.' });
  }
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const created = { id: s.nextId++, ...payload };
    s.reels.push(created);
    return res.status(201).json({ reel: created });
  }
  try {
    const [created] = await db.insert(reels).values(payload).returning();
    await logAdminAction(req, 'CREATE_REEL', 'reel', created.id);
    res.status(201).json({ reel: created });
  } catch {
    res.status(400).json({ error: 'Unable to create reel.' });
  }
});

router.put('/reels/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const payload = sanitizeReelBody(req.body);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const idx = s.reels.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Reel not found.' });
    s.reels[idx] = { ...s.reels[idx], ...payload };
    return res.json({ reel: s.reels[idx] });
  }
  try {
    const [updated] = await db.update(reels).set(payload).where(eq(reels.id, id)).returning();
    await logAdminAction(req, 'UPDATE_REEL', 'reel', id);
    res.json({ reel: updated });
  } catch {
    res.status(400).json({ error: 'Unable to update reel.' });
  }
});

router.delete('/reels/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.reels = s.reels.filter((r) => r.id !== id);
    return res.json({ ok: true });
  }
  try {
    await db.delete(reels).where(eq(reels.id, id));
    await logAdminAction(req, 'DELETE_REEL', 'reel', id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete reel.' });
  }
});

// REVIEWS MANAGEMENT (Add, Edit, Moderate, Delete)
router.get('/reviews', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ reviews: getFallbackState().reviews });
  }
  try {
    const rows = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
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
        productSlug: products.slug,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(products, eq(reviews.productId, products.id))
      .orderBy(desc(reviews.createdAt));
    res.json({ reviews: rows });
  } catch {
    res.json({ reviews: getFallbackState().reviews });
  }
});

const adminCreateReviewSchema = z.object({
  productId: z.number().int().positive(),
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional().or(z.literal('')),
  rating: z.number().int().min(1).max(5),
  title: z.string().optional().default(''),
  comment: z.string().min(3),
  isVerifiedPurchase: z.boolean().optional().default(true),
  status: z.enum(['pending', 'approved', 'rejected']).optional().default('approved'),
});

router.post('/reviews', async (req: AuthRequest, res) => {
  const parsed = adminCreateReviewSchema.safeParse({
    ...req.body,
    productId: Number(req.body?.productId),
    rating: Number(req.body?.rating),
  });
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Please select a product, customer name, rating (1-5), and comment.' });
  }
  const data = parsed.data;

  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const prod = s.products.find((p) => p.id === data.productId);
    if (!prod) return res.status(404).json({ error: 'Product not found.' });
    const created = {
      id: s.nextId++,
      productId: prod.id,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      imagesJson: [],
      isVerifiedPurchase: data.isVerifiedPurchase,
      status: data.status,
      createdAt: new Date().toISOString(),
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail || 'verified@zarifly.com',
      productName: prod.name,
      productSlug: prod.slug,
    };
    s.reviews.unshift(created);
    return res.status(201).json({ review: created });
  }

  try {
    const safeEmail =
      data.customerEmail && data.customerEmail.trim()
        ? data.customerEmail.trim().toLowerCase()
        : `reviewer-${data.customerName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 24)}-${Date.now().toString().slice(-4)}@reviews.zarifly.com`;

    let reviewerUser = (
      await db.select().from(users).where(eq(users.email, safeEmail)).limit(1)
    )[0];

    if (!reviewerUser) {
      const [insertedUser] = await db
        .insert(users)
        .values({
          uid: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          email: safeEmail,
          fullName: data.customerName.trim(),
          role: 'customer',
        })
        .returning();
      reviewerUser = insertedUser;
    } else if (reviewerUser.fullName !== data.customerName.trim()) {
      const [updatedUser] = await db
        .update(users)
        .set({ fullName: data.customerName.trim(), updatedAt: new Date() })
        .where(eq(users.id, reviewerUser.id))
        .returning();
      reviewerUser = updatedUser;
    }

    const [created] = await db
      .insert(reviews)
      .values({
        productId: data.productId,
        userId: reviewerUser.id,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        isVerifiedPurchase: data.isVerifiedPurchase,
        status: data.status,
      })
      .returning();

    await logAdminAction(req, 'CREATE_REVIEW', 'review', created.id, {
      productId: data.productId,
      customerName: data.customerName,
    });
    res.status(201).json({ review: created });
  } catch (error) {
    console.error('Admin create review error:', error);
    res.status(400).json({ error: 'Unable to create review.' });
  }
});

router.patch('/reviews/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().optional(),
    comment: z.string().min(3).optional(),
    isVerifiedPurchase: z.boolean().optional(),
    customerName: z.string().min(2).optional(),
  });
  const parsed = schema.safeParse({
    ...req.body,
    rating: req.body?.rating !== undefined ? Number(req.body.rating) : undefined,
  });
  if (Number.isNaN(id) || !parsed.success) {
    return res.status(400).json({ error: 'Invalid review update payload.' });
  }

  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const idx = s.reviews.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Review not found.' });
    s.reviews[idx] = { ...s.reviews[idx], ...parsed.data };
    return res.json({ review: s.reviews[idx] });
  }

  try {
    const { customerName, ...reviewFields } = parsed.data;
    const [updated] = await db
      .update(reviews)
      .set({ ...reviewFields, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Review not found.' });

    if (customerName && updated.userId) {
      await db
        .update(users)
        .set({ fullName: customerName.trim(), updatedAt: new Date() })
        .where(eq(users.id, updated.userId));
    }

    await logAdminAction(req, 'UPDATE_REVIEW', 'review', id, parsed.data);
    res.json({ review: updated });
  } catch (error) {
    console.error('Admin review update error:', error);
    res.status(400).json({ error: 'Unable to update review.' });
  }
});

router.delete('/reviews/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.reviews = s.reviews.filter((r) => r.id !== id);
    return res.json({ ok: true });
  }
  try {
    await db.delete(reviews).where(eq(reviews.id, id));
    await logAdminAction(req, 'DELETE_REVIEW', 'review', id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete review.' });
  }
});

// BLOGS CRUD
function sanitizeBlogBody(body: any) {
  const title = String(body.title || '').trim();
  const rawSlug = String(body.slug || '').trim() || title;
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return {
    slug,
    title,
    titleHi: String(body.titleHi || '').trim(),
    excerpt: String(body.excerpt || '').trim(),
    excerptHi: String(body.excerptHi || '').trim(),
    content: String(body.content || '').trim(),
    contentHi: String(body.contentHi || '').trim(),
    featuredImageUrl:
      String(body.featuredImageUrl || '').trim() ||
      '/src/assets/images/cat_premium_hijabs_1795097097750.jpg',
    authorName: String(body.authorName || 'Sama Shaikh').trim(),
    category: String(body.category || 'Modest Fashion').trim(),
    seoTitle: String(body.seoTitle || '').trim() || `${title} | ZARIFLY Journal`,
    seoDescription:
      String(body.seoDescription || '').trim() || String(body.excerpt || '').slice(0, 155),
    isPublished: body.isPublished !== false,
  };
}

router.get('/blogs', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ blogs: getFallbackState().blogs });
  }
  try {
    const rows = await db.select().from(blogs).orderBy(desc(blogs.createdAt));
    res.json({ blogs: rows });
  } catch {
    res.json({ blogs: getFallbackState().blogs });
  }
});

router.post('/blogs', async (req: AuthRequest, res) => {
  const payload = sanitizeBlogBody(req.body);
  if (!payload.title || !payload.content) {
    return res.status(400).json({ error: 'Blog title and content are required.' });
  }
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const created = {
      id: s.nextId++,
      ...payload,
      publishedAt: new Date().toISOString(),
    };
    s.blogs.unshift(created);
    return res.status(201).json({ blog: created });
  }
  try {
    const [created] = await db.insert(blogs).values(payload).returning();
    await logAdminAction(req, 'CREATE_BLOG', 'blog', created.id, { title: created.title });
    res.status(201).json({ blog: created });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to create blog post.' });
  }
});

router.put('/blogs/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const payload = sanitizeBlogBody(req.body);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const idx = s.blogs.findIndex((b) => b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Blog post not found.' });
    s.blogs[idx] = { ...s.blogs[idx], ...payload };
    return res.json({ blog: s.blogs[idx] });
  }
  try {
    const [updated] = await db
      .update(blogs)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(blogs.id, id))
      .returning();
    await logAdminAction(req, 'UPDATE_BLOG', 'blog', id, { title: updated?.title });
    res.json({ blog: updated });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to update blog post.' });
  }
});

router.delete('/blogs/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.blogs = s.blogs.filter((b) => b.id !== id);
    return res.json({ ok: true });
  }
  try {
    await db.delete(blogs).where(eq(blogs.id, id));
    await logAdminAction(req, 'DELETE_BLOG', 'blog', id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete blog post.' });
  }
});

// COUPONS CRUD
router.get('/coupons', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ coupons: getFallbackState().coupons });
  }
  try {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    res.json({ coupons: rows });
  } catch {
    res.json({ coupons: getFallbackState().coupons });
  }
});

router.post('/coupons', async (req: AuthRequest, res) => {
  const body = {
    code: String(req.body.code || '')
      .toUpperCase()
      .trim(),
    description: String(req.body.description || ''),
    discountType: req.body.discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(req.body.discountValue) || 10,
    minOrderAmount: Number(req.body.minOrderAmount) || 0,
    isActive: true,
  };
  if (!body.code) return res.status(400).json({ error: 'Coupon code is required.' });
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    const created = { id: s.nextId++, ...body };
    s.coupons.unshift(created);
    return res.status(201).json({ coupon: created });
  }
  try {
    const [created] = await db.insert(coupons).values(body).returning();
    await logAdminAction(req, 'CREATE_COUPON', 'coupon', created.code);
    res.status(201).json({ coupon: created });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to create coupon.' });
  }
});

router.delete('/coupons/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.coupons = s.coupons.filter((c) => c.id !== id);
    return res.json({ ok: true });
  }
  try {
    await db.delete(coupons).where(eq(coupons.id, id));
    await logAdminAction(req, 'DELETE_COUPON', 'coupon', id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete coupon.' });
  }
});

// SUBSCRIBERS, CONTACT MESSAGES, SETTINGS, LOGS
router.get('/subscribers', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ subscribers: getFallbackState().subscribers });
  }
  try {
    const rows = await db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt));
    res.json({ subscribers: rows });
  } catch {
    res.json({ subscribers: getFallbackState().subscribers });
  }
});

router.get('/messages', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ messages: getFallbackState().messages });
  }
  try {
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
    res.json({ messages: rows });
  } catch {
    res.json({ messages: getFallbackState().messages });
  }
});

router.get('/settings', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ settings: getFallbackState().settings });
  }
  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, 'storefront'))
      .limit(1);
    res.json({ settings: rows[0]?.valueJson || {} });
  } catch {
    res.json({ settings: getFallbackState().settings });
  }
});

router.put('/settings', async (req: AuthRequest, res) => {
  if (!isDatabaseConfigured()) {
    const s = getFallbackState();
    s.settings = { ...s.settings, ...req.body };
    return res.json({ settings: s.settings });
  }
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
  if (!isDatabaseConfigured()) {
    return res.json({ logs: [] });
  }
  try {
    const rows = await db
      .select()
      .from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(50);
    res.json({ logs: rows });
  } catch {
    res.json({ logs: [] });
  }
});

export default router;
