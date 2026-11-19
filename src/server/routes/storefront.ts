import { Router } from 'express';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  banners,
  blogs,
  categories,
  contactMessages,
  newsletterSubscribers,
  productImages,
  products,
  productVariants,
  reels,
  reviews,
  siteSettings,
  users,
} from '../../db/schema.ts';
import { ensureSeeded } from '../../db/seed.ts';

const router = Router();

export async function hydrateProducts(productRows: (typeof products.$inferSelect)[]) {
  if (productRows.length === 0) return [];
  const allCategories = await db.select().from(categories);
  const catById = new Map(allCategories.map((c) => [c.id, c]));

  const allImages = await db
    .select()
    .from(productImages)
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const allVariants = await db
    .select()
    .from(productVariants)
    .orderBy(asc(productVariants.id));
  const approvedReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.status, 'approved'));

  return productRows.map((p) => {
    const imgs = allImages.filter((i) => i.productId === p.id);
    const vars = allVariants.filter((v) => v.productId === p.id && v.isActive);
    const revs = approvedReviews.filter((r) => r.productId === p.id);
    const reviewCount = revs.length;
    const avgRating =
      reviewCount > 0
        ? Number((revs.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1))
        : 0;
    const totalStock = vars.reduce((acc, v) => acc + v.stockQuantity, 0);
    const discountPercent =
      p.originalPrice > p.sellingPrice
        ? Math.round(((p.originalPrice - p.sellingPrice) / p.originalPrice) * 100)
        : 0;

    return {
      ...p,
      category: catById.get(p.categoryId) || null,
      images: imgs,
      variants: vars,
      reviewCount,
      avgRating,
      totalStock,
      discountPercent,
    };
  });
}

router.get('/bootstrap', async (_req, res) => {
  try {
    await ensureSeeded();
    const [settingsRows, catRows, bannerRows, reelRows, prodRows, blogRows, revRows] =
      await Promise.all([
        db.select().from(siteSettings).where(eq(siteSettings.key, 'storefront')).limit(1),
        db
          .select()
          .from(categories)
          .where(eq(categories.isActive, true))
          .orderBy(asc(categories.sortOrder)),
        db
          .select()
          .from(banners)
          .where(eq(banners.isActive, true))
          .orderBy(asc(banners.sortOrder)),
        db.select().from(reels).where(eq(reels.isActive, true)).orderBy(asc(reels.sortOrder)),
        db
          .select()
          .from(products)
          .where(eq(products.isActive, true))
          .orderBy(desc(products.createdAt)),
        db
          .select()
          .from(blogs)
          .where(eq(blogs.isPublished, true))
          .orderBy(desc(blogs.publishedAt))
          .limit(4),
        db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            title: reviews.title,
            comment: reviews.comment,
            imagesJson: reviews.imagesJson,
            isVerifiedPurchase: reviews.isVerifiedPurchase,
            createdAt: reviews.createdAt,
            customerName: users.fullName,
            productName: products.name,
            productSlug: products.slug,
          })
          .from(reviews)
          .innerJoin(users, eq(reviews.userId, users.id))
          .innerJoin(products, eq(reviews.productId, products.id))
          .where(eq(reviews.status, 'approved'))
          .orderBy(desc(reviews.createdAt))
          .limit(6),
      ]);

    const hydrated = await hydrateProducts(prodRows);
    const prodMap = new Map(hydrated.map((p) => [p.id, p]));

    res.json({
      settings: settingsRows[0]?.valueJson || {},
      categories: catRows,
      banners: bannerRows,
      reels: reelRows.map((r) => ({
        ...r,
        product: r.productId ? prodMap.get(r.productId) || null : null,
      })),
      bestSellers: hydrated.filter((p) => p.isBestSeller),
      newArrivals: hydrated.filter((p) => p.isNewArrival),
      featuredProducts: hydrated.filter((p) => p.isFeatured),
      reviews: revRows,
      blogs: blogRows,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Unable to load storefront data.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    await ensureSeeded();
    const { category, search, bestSeller, newArrival, sort, color, minPrice, maxPrice } = req.query;

    const conditions = [eq(products.isActive, true)];
    if (typeof category === 'string' && category && category !== 'all') {
      const foundCat = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, category))
        .limit(1);
      if (foundCat.length > 0) {
        conditions.push(eq(products.categoryId, foundCat[0].id));
      } else {
        return res.json({ products: [] });
      }
    }
    if (bestSeller === 'true') conditions.push(eq(products.isBestSeller, true));
    if (newArrival === 'true') conditions.push(eq(products.isNewArrival, true));
    if (typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(products.name, q),
          ilike(products.description, q),
          ilike(products.fabric, q),
          ilike(products.workDetails, q),
          ilike(products.sku, q)
        )!
      );
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));

    let hydrated = await hydrateProducts(rows);

    if (typeof color === 'string' && color.trim()) {
      const cLower = color.trim().toLowerCase();
      hydrated = hydrated.filter((p) =>
        p.variants.some((v) => v.colorName.toLowerCase().includes(cLower))
      );
    }
    if (minPrice && !Number.isNaN(Number(minPrice))) {
      hydrated = hydrated.filter((p) => p.sellingPrice >= Number(minPrice));
    }
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      hydrated = hydrated.filter((p) => p.sellingPrice <= Number(maxPrice));
    }

    if (sort === 'price_asc') {
      hydrated.sort((a, b) => a.sellingPrice - b.sellingPrice);
    } else if (sort === 'price_desc') {
      hydrated.sort((a, b) => b.sellingPrice - a.sellingPrice);
    } else if (sort === 'bestselling') {
      hydrated.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
    }

    res.json({ products: hydrated });
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

router.get('/products/:slug', async (req, res) => {
  try {
    await ensureSeeded();
    const { slug } = req.params;
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.isActive, true)))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [product] = await hydrateProducts(rows);

    const productReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        imagesJson: reviews.imagesJson,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
        customerName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.productId, product.id), eq(reviews.status, 'approved')))
      .orderBy(desc(reviews.createdAt));

    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: productReviews.filter((r) => r.rating === star).length,
    }));

    const relatedRows = await db
      .select()
      .from(products)
      .where(and(eq(products.categoryId, product.categoryId), eq(products.isActive, true)))
      .limit(5);
    const related = (await hydrateProducts(relatedRows)).filter((p) => p.id !== product.id).slice(0, 4);

    res.json({
      product,
      reviews: productReviews,
      ratingDistribution: distribution,
      relatedProducts: related,
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Unable to load product details.' });
  }
});

router.get('/blogs', async (_req, res) => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(blogs)
      .where(eq(blogs.isPublished, true))
      .orderBy(desc(blogs.publishedAt));
    res.json({ blogs: rows });
  } catch (error) {
    console.error('Blogs error:', error);
    res.status(500).json({ error: 'Unable to load blog articles.' });
  }
});

router.get('/blogs/:slug', async (req, res) => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(blogs)
      .where(and(eq(blogs.slug, req.params.slug), eq(blogs.isPublished, true)))
      .limit(1);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    const related = await db
      .select()
      .from(blogs)
      .where(eq(blogs.isPublished, true))
      .orderBy(desc(blogs.publishedAt))
      .limit(4);
    res.json({
      blog: rows[0],
      related: related.filter((b) => b.id !== rows[0].id).slice(0, 3),
    });
  } catch (error) {
    console.error('Blog detail error:', error);
    res.status(500).json({ error: 'Unable to load article.' });
  }
});

router.post('/newsletter', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  try {
    await db
      .insert(newsletterSubscribers)
      .values({ email: parsed.data.email.trim().toLowerCase() })
      .onConflictDoNothing();
    res.json({ ok: true, message: 'Subscribed successfully to ZARIFLY.' });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ error: 'Unable to save subscription.' });
  }
});

router.post('/contact', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().default(''),
    subject: z.string().optional().default('General Inquiry'),
    message: z.string().min(5),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete all required contact fields.' });
  }
  try {
    const [saved] = await db.insert(contactMessages).values(parsed.data).returning();
    res.status(201).json({ ok: true, messageId: saved.id });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Unable to submit inquiry.' });
  }
});

// Live Indian Postal PIN Code Lookup (never invents data)
router.get('/pincode/:pin', async (req, res) => {
  const pin = req.params.pin.trim();
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'Please enter a valid 6-digit Indian PIN code.' });
  }
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = (await response.json()) as any[];
    const record = Array.isArray(data) ? data[0] : null;
    if (!record || record.Status !== 'Success' || !record.PostOffice?.length) {
      return res.status(404).json({
        serviceable: false,
        error: 'PIN code not found in India Post directory. Please verify and try again.',
      });
    }

    const po = record.PostOffice[0];
    const state = po.State || '';
    const district = po.District || '';
    const city = po.Block && po.Block !== 'NA' ? po.Block : district || po.Name || '';

    // Shipping zone estimation based on Maharashtra/Mumbai boutique dispatch
    const isMetroOrWest = ['Maharashtra', 'Gujarat', 'Goa', 'Karnataka', 'Delhi', 'Telangana', 'Tamil Nadu', 'West Bengal'].includes(state);
    const estimatedDays = state === 'Maharashtra' ? '2–3 Business Days' : isMetroOrWest ? '3–5 Business Days' : '5–7 Business Days';

    res.json({
      serviceable: true,
      pincode: pin,
      city,
      district,
      state,
      postOfficeName: po.Name,
      estimatedDelivery: estimatedDays,
      codAvailable: true,
    });
  } catch (error) {
    console.error('PIN lookup error:', error);
    res.status(502).json({
      serviceable: false,
      error: 'Postal lookup service is temporarily unavailable. You may enter your city and state manually.',
    });
  }
});

// Real Reverse Geocoding via OpenStreetMap Nominatim (never invents data)
router.get('/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ZariflyBoutiqueEcommerce/1.0 (info@zarifly.com)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Reverse geocoding service unavailable.' });
    }
    const data = (await response.json()) as any;
    const addr = data?.address || {};
    const houseFlat = [addr.house_number, addr.building].filter(Boolean).join(', ');
    const streetArea = [addr.road, addr.neighbourhood, addr.suburb, addr.residential]
      .filter(Boolean)
      .join(', ');
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const district = addr.state_district || addr.county || '';
    const state = addr.state || '';
    const pincode = (addr.postcode || '').replace(/\s+/g, '');

    res.json({
      displayName: data?.display_name || '',
      houseFlat,
      streetArea,
      city,
      district,
      state,
      pincode,
      latitude: String(lat),
      longitude: String(lon),
    });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(502).json({ error: 'Unable to resolve address from coordinates. Please enter manually.' });
  }
});

export default router;
