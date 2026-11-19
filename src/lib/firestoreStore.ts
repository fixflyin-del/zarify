import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_BANNERS,
  DEFAULT_BLOGS,
  DEFAULT_CATEGORIES,
  DEFAULT_COUPONS,
  DEFAULT_PRODUCTS,
  DEFAULT_REELS,
  DEFAULT_SETTINGS,
} from './defaultCatalog';
import type {
  Banner,
  BlogPost,
  Category,
  CouponItem,
  Order,
  OrderItem,
  OrderTrackingSummary,
  Product,
  ProductVariant,
  ReelItem,
  ReviewItem,
  StoreSettings,
  User,
} from '../types';

export const AUTHORIZED_ADMIN_EMAILS = [
  'fixfly.in@gmail.com',
  'admin@zarifly.com',
  'info@zarifly.com',
];

export function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 140) || `item-${Date.now()}`
  );
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function computeDiscount(selling: number, original: number): number {
  if (!original || original <= selling) return 0;
  return Math.round(((original - selling) / original) * 100);
}

// ============================================================================
// User & Admin Profiles
// ============================================================================

export async function ensureUserProfile(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}, overrides?: { fullName?: string; phone?: string; preferredLang?: string }): Promise<User> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').trim().toLowerCase();
  const userRef = doc(db, 'users', uid);

  let isAdminAccount = Boolean(
    firebaseUser.emailVerified && AUTHORIZED_ADMIN_EMAILS.includes(email)
  );

  // Also check /admins/{uid}
  if (!isAdminAccount) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (adminSnap.exists() && adminSnap.data()?.isActive === true) {
        isAdminAccount = true;
      }
    } catch {
      // Non-admin user reading non-existent /admins/{uid} is fine
    }
  }

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data();
      const effectiveRole = isAdminAccount ? 'admin' : d.role || 'customer';
      return {
        id: uid,
        uid,
        email: d.email || email,
        fullName: d.fullName || firebaseUser.displayName || email.split('@')[0] || 'Customer',
        phone: d.phone || '',
        role: effectiveRole,
        preferredLang: d.preferredLang || 'en',
        createdAt: toIsoString(d.createdAt),
      };
    }

    const fullName = (
      overrides?.fullName ||
      firebaseUser.displayName ||
      email.split('@')[0] ||
      'ZARIFLY Guest'
    ).slice(0, 120);
    const phone = (overrides?.phone || '').slice(0, 24);
    const preferredLang = overrides?.preferredLang === 'hi' ? 'hi' : 'en';
    const role = isAdminAccount ? 'admin' : 'customer';

    await setDoc(userRef, {
      uid,
      email,
      fullName,
      phone,
      role,
      preferredLang,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (isAdminAccount) {
      try {
        const adminRef = doc(db, 'admins', uid);
        const adminExisting = await getDoc(adminRef);
        if (!adminExisting.exists()) {
          await setDoc(adminRef, {
            uid,
            email,
            fullName,
            role: 'super_admin',
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Ignore if admin doc already managed
      }
    }

    return {
      id: uid,
      uid,
      email,
      fullName,
      phone,
      role,
      preferredLang,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: { fullName: string; phone: string; preferredLang: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: updates.fullName.trim().slice(0, 120),
      phone: updates.phone.trim().slice(0, 24),
      preferredLang: updates.preferredLang === 'hi' ? 'hi' : 'en',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

// ============================================================================
// Wishlist
// ============================================================================

export async function fetchUserWishlistIds(uid: string): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'wishlist'));
    return snap.docs.map((d) => d.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/wishlist`);
  }
}

export async function toggleWishlistDoc(uid: string, productId: string): Promise<boolean> {
  const refDoc = doc(db, 'users', uid, 'wishlist', productId);
  try {
    const existing = await getDoc(refDoc);
    if (existing.exists()) {
      await deleteDoc(refDoc);
      return false;
    }
    await setDoc(refDoc, {
      userId: uid,
      productId,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/wishlist/${productId}`);
  }
}

// ============================================================================
// Public Catalog & Storefront Bootstrap
// ============================================================================

export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const [webSnap, shipSnap] = await Promise.all([
      getDoc(doc(db, 'website_settings', 'primary')),
      getDoc(doc(db, 'shipping_settings', 'primary')),
    ]);
    const web = webSnap.exists() ? webSnap.data() : {};
    const ship = shipSnap.exists() ? shipSnap.data() : {};
    return {
      ...DEFAULT_SETTINGS,
      ...web,
      ...ship,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function fetchAllProductsEnriched(options?: {
  includeInactive?: boolean;
  includeAllReviews?: boolean;
}): Promise<{
  categories: Category[];
  products: Product[];
  reviews: ReviewItem[];
}> {
  const [catSnap, prodSnap, varSnap, revSnap] = await Promise.all([
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'product_variants')),
    options?.includeAllReviews
      ? getDocs(collection(db, 'reviews'))
      : getDocs(query(collection(db, 'reviews'), where('status', '==', 'approved'))),
  ]);

  const categories: Category[] = catSnap.empty
    ? DEFAULT_CATEGORIES
    : catSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            slug: data.slug || d.id,
            name: data.name || '',
            nameHi: data.nameHi || '',
            description: data.description || '',
            descriptionHi: data.descriptionHi || '',
            imageUrl: data.imageUrl || '',
            sortOrder: Number(data.sortOrder ?? 0),
            isActive: data.isActive !== false,
            seoTitle: data.seoTitle || '',
            seoDescription: data.seoDescription || '',
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const reviews: ReviewItem[] = revSnap.docs
    .map((d) => {
      const r = d.data();
      return {
        id: d.id,
        productId: r.productId || '',
        userId: r.userId || '',
        productName: r.productName || '',
        productSlug: r.productSlug || '',
        customerName: r.customerName || 'Verified Guest',
        customerEmail: r.customerEmail || '',
        rating: Number(r.rating || 5),
        title: r.title || '',
        comment: r.comment || '',
        imagesJson: Array.isArray(r.imagesJson) ? r.imagesJson : [],
        isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
        status: r.status || 'approved',
        createdAt: toIsoString(r.createdAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (prodSnap.empty) {
    return { categories, products: DEFAULT_PRODUCTS, reviews };
  }

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const d of varSnap.docs) {
    const v = d.data();
    const list = variantsByProduct.get(v.productId) || [];
    list.push({
      id: d.id,
      productId: v.productId,
      sku: v.sku || '',
      colorName: v.colorName || 'Ivory',
      colorHex: v.colorHex || '#EFE8DC',
      sizeName: v.sizeName || 'Standard',
      priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
      stockQuantity: Number(v.stockQuantity ?? 0),
      imageUrl: v.imageUrl || '',
      isActive: v.isActive !== false,
    });
    variantsByProduct.set(v.productId, list);
  }

  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const reviewsByProduct = new Map<string, ReviewItem[]>();
  for (const rev of approvedReviews) {
    if (!rev.productId) continue;
    const list = reviewsByProduct.get(rev.productId) || [];
    list.push(rev);
    reviewsByProduct.set(rev.productId, list);
  }

  const products: Product[] = prodSnap.docs
    .map((d) => {
      const p = d.data();
      const variants = variantsByProduct.get(d.id) || [];
      const prodReviews = reviewsByProduct.get(d.id) || [];
      const sellingPrice = Number(p.sellingPrice || 0);
      const originalPrice = Number(p.originalPrice || sellingPrice);
      const avgRating =
        prodReviews.length > 0
          ? Number(
              (
                prodReviews.reduce((acc, r) => acc + r.rating, 0) / prodReviews.length
              ).toFixed(1)
            )
          : 0;
      const totalStock = variants.reduce((sum, v) => sum + Number(v.stockQuantity || 0), 0);

      return {
        id: d.id,
        categoryId: p.categoryId || 'cat_hijabs',
        categorySlug: p.categorySlug || catMap.get(p.categoryId)?.slug || 'hijabs',
        category: catMap.get(p.categoryId) || null,
        slug: p.slug || d.id,
        name: p.name || '',
        nameHi: p.nameHi || null,
        sku: p.sku || '',
        description: p.description || '',
        descriptionHi: p.descriptionHi || null,
        fabric: p.fabric || '',
        workDetails: p.workDetails || '',
        sellingPrice,
        originalPrice,
        discountPercent: computeDiscount(sellingPrice, originalPrice),
        isActive: p.isActive !== false,
        isBestSeller: Boolean(p.isBestSeller),
        isNewArrival: Boolean(p.isNewArrival),
        isFeatured: Boolean(p.isFeatured),
        seoTitle: p.seoTitle || '',
        seoDescription: p.seoDescription || '',
        images: Array.isArray(p.images) ? p.images : [],
        variants,
        reviewCount: prodReviews.length,
        avgRating,
        totalStock,
      };
    })
    .filter((p) => (options?.includeInactive ? true : p.isActive));

  return { categories, products, reviews };
}

export async function fetchStorefrontBootstrap() {
  try {
    const [settings, { categories, products, reviews }, bannerSnap, reelSnap, blogSnap] =
      await Promise.all([
        fetchStoreSettings(),
        fetchAllProductsEnriched({ includeInactive: false, includeAllReviews: false }),
        getDocs(collection(db, 'banners')),
        getDocs(collection(db, 'reels')),
        getDocs(collection(db, 'blogs')),
      ]);

    const banners: Banner[] = bannerSnap.empty
      ? DEFAULT_BANNERS
      : bannerSnap.docs
          .map((d) => {
            const b = d.data();
            return {
              id: d.id,
              heading: b.heading || '',
              headingHi: b.headingHi || '',
              subheading: b.subheading || '',
              subheadingHi: b.subheadingHi || '',
              ctaText: b.ctaText || 'Shop Now',
              ctaTextHi: b.ctaTextHi || 'अभी खरीदें',
              ctaUrl: b.ctaUrl || '/shop',
              desktopImageUrl: b.desktopImageUrl || '',
              mobileImageUrl: b.mobileImageUrl || '',
              sortOrder: Number(b.sortOrder ?? 0),
              isActive: b.isActive !== false,
            };
          })
          .filter((b) => b.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const reels: ReelItem[] = reelSnap.empty
      ? DEFAULT_REELS
      : reelSnap.docs
          .map((d) => {
            const r = d.data();
            return {
              id: d.id,
              title: r.title || '',
              caption: r.caption || '',
              videoUrl: r.videoUrl || '',
              thumbnailUrl: r.thumbnailUrl || '',
              productId: r.productId || null,
              product: r.productId ? productMap.get(r.productId) || null : null,
              sortOrder: Number(r.sortOrder ?? 0),
              isActive: r.isActive !== false,
            };
          })
          .filter((r) => r.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);

    const blogs: BlogPost[] = blogSnap.empty
      ? DEFAULT_BLOGS
      : blogSnap.docs
          .map((d) => {
            const b = d.data();
            return {
              id: d.id,
              slug: b.slug || d.id,
              title: b.title || '',
              titleHi: b.titleHi || '',
              excerpt: b.excerpt || '',
              excerptHi: b.excerptHi || '',
              content: b.content || '',
              contentHi: b.contentHi || '',
              featuredImageUrl: b.featuredImageUrl || '',
              authorName: b.authorName || 'Sama Shaikh',
              category: b.category || 'Journal',
              seoTitle: b.seoTitle || '',
              seoDescription: b.seoDescription || '',
              isPublished: b.isPublished !== false,
              publishedAt: b.publishedAt || toIsoString(b.createdAt),
            };
          })
          .filter((b) => b.isPublished)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    return {
      settings,
      categories,
      banners: banners.length ? banners : DEFAULT_BANNERS,
      reels: reels.length ? reels : DEFAULT_REELS,
      allProducts: products,
      bestSellers: products.filter((p) => p.isBestSeller),
      newArrivals: products.filter((p) => p.isNewArrival),
      featuredProducts: products.filter((p) => p.isFeatured),
      reviews,
      blogs: blogs.length ? blogs : DEFAULT_BLOGS,
    };
  } catch (err) {
    console.warn('Firestore bootstrap read fell back to starter catalog:', err);
    return {
      settings: DEFAULT_SETTINGS,
      categories: DEFAULT_CATEGORIES,
      banners: DEFAULT_BANNERS,
      reels: DEFAULT_REELS,
      allProducts: DEFAULT_PRODUCTS,
      bestSellers: DEFAULT_PRODUCTS.filter((p) => p.isBestSeller),
      newArrivals: DEFAULT_PRODUCTS.filter((p) => p.isNewArrival),
      featuredProducts: DEFAULT_PRODUCTS.filter((p) => p.isFeatured),
      reviews: [] as ReviewItem[],
      blogs: DEFAULT_BLOGS,
    };
  }
}

export async function fetchProductDetailBySlug(slug: string): Promise<{
  product: Product;
  reviews: ReviewItem[];
  related: Product[];
} | null> {
  const { products, reviews } = await fetchAllProductsEnriched({
    includeInactive: false,
    includeAllReviews: false,
  });
  const product = products.find((p) => p.slug === slug || p.id === slug);
  if (!product) return null;
  const prodReviews = reviews.filter((r) => r.productId === product.id);
  const related = products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, 4);
  return { product, reviews: prodReviews, related };
}

export async function fetchPublishedBlogs(): Promise<BlogPost[]> {
  try {
    const snap = await getDocs(collection(db, 'blogs'));
    if (snap.empty) return DEFAULT_BLOGS;
    return snap.docs
      .map((d) => {
        const b = d.data();
        return {
          id: d.id,
          slug: b.slug || d.id,
          title: b.title || '',
          titleHi: b.titleHi || '',
          excerpt: b.excerpt || '',
          excerptHi: b.excerptHi || '',
          content: b.content || '',
          contentHi: b.contentHi || '',
          featuredImageUrl: b.featuredImageUrl || '',
          authorName: b.authorName || 'Sama Shaikh',
          category: b.category || 'Journal',
          seoTitle: b.seoTitle || '',
          seoDescription: b.seoDescription || '',
          isPublished: b.isPublished !== false,
          publishedAt: b.publishedAt || toIsoString(b.createdAt),
        };
      })
      .filter((b) => b.isPublished)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  } catch {
    return DEFAULT_BLOGS;
  }
}

export async function fetchActiveCoupons(): Promise<CouponItem[]> {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    if (snap.empty) return DEFAULT_COUPONS;
    return snap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        code: (c.code || '').toUpperCase(),
        description: c.description || '',
        discountType: c.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: Number(c.discountValue || 0),
        minOrderAmount: Number(c.minOrderAmount || 0),
        maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : null,
        usageLimit: c.usageLimit != null ? Number(c.usageLimit) : null,
        usedCount: Number(c.usedCount || 0),
        isActive: c.isActive !== false,
        expiresAt: c.expiresAt || null,
      };
    });
  } catch {
    return DEFAULT_COUPONS;
  }
}

// ============================================================================
// Customer Submissions (Reviews, Newsletter, Contact, Orders)
// ============================================================================

export async function submitCustomerReview(input: {
  productId: string;
  productName: string;
  productSlug: string;
  rating: number;
  title?: string;
  comment: string;
  imagesJson?: string[];
  customerName: string;
  customerEmail?: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to submit a product review.');
  }
  const id = makeDocId('rev');
  try {
    await setDoc(doc(db, 'reviews', id), {
      productId: input.productId,
      productName: input.productName.slice(0, 200),
      productSlug: input.productSlug.slice(0, 160),
      userId: currentUser.uid,
      customerName: input.customerName.trim().slice(0, 120) || 'ZARIFLY Customer',
      customerEmail: (input.customerEmail || currentUser.email || '').slice(0, 160),
      rating: Math.min(5, Math.max(1, Number(input.rating || 5))),
      title: (input.title || '').trim().slice(0, 200),
      comment: input.comment.trim().slice(0, 3000),
      imagesJson: (input.imagesJson || []).slice(0, 5),
      isVerifiedPurchase: false,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reviews/${id}`);
  }
}

export async function subscribeNewsletter(email: string, source = 'homepage'): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const id = makeDocId('sub');
  try {
    await setDoc(doc(db, 'newsletter_subscribers', id), {
      email: cleanEmail.slice(0, 160),
      source: source.slice(0, 60),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `newsletter_subscribers/${id}`);
  }
}

export async function submitContactMessage(input: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}): Promise<void> {
  const id = makeDocId('msg');
  try {
    await setDoc(doc(db, 'contact_messages', id), {
      name: input.name.trim().slice(0, 120),
      email: input.email.trim().toLowerCase().slice(0, 160),
      phone: (input.phone || '').trim().slice(0, 24),
      subject: input.subject.trim().slice(0, 200),
      message: input.message.trim().slice(0, 4000),
      status: 'new',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `contact_messages/${id}`);
  }
}

export async function placeCustomerOrder(input: {
  shippingAddress: Order['shippingAddressJson'];
  paymentMethod: 'cod' | 'online';
  notes?: string;
  couponCode?: string | null;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  grandTotal: number;
  items: Array<{
    productId: string;
    variantId: string;
    productName: string;
    sku: string;
    colorName: string;
    sizeName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    imageUrl: string;
  }>;
}): Promise<{ orderId: string; orderNumber: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to place your ZARIFLY order securely.');
  }

  const orderId = makeDocId('ord');
  const orderNumber = `ZRF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const paymentId = makeDocId('pay');

  const batch = writeBatch(db);

  batch.set(doc(db, 'orders', orderId), {
    orderNumber,
    userId: currentUser.uid,
    customerName: input.shippingAddress.fullName.trim().slice(0, 120),
    customerEmail: input.shippingAddress.email.trim().toLowerCase().slice(0, 160),
    customerPhone: input.shippingAddress.mobile.trim().slice(0, 24),
    shippingAddressJson: input.shippingAddress,
    subtotal: Number(input.subtotal),
    discountAmount: Number(input.discountAmount),
    couponCode: input.couponCode ? input.couponCode.trim().slice(0, 60) : null,
    shippingFee: Number(input.shippingFee),
    taxAmount: Number(input.taxAmount),
    grandTotal: Number(input.grandTotal),
    paymentMethod: input.paymentMethod,
    paymentStatus: 'pending',
    orderStatus: 'placed',
    courierName: null,
    trackingNumber: null,
    estimatedDelivery: '4–6 business days',
    notes: (input.notes || '').trim().slice(0, 1000) || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Non-PII public tracking summary keyed by orderNumber
  batch.set(doc(db, 'order_tracking', orderNumber), {
    orderNumber,
    userId: currentUser.uid,
    orderStatus: 'placed',
    paymentStatus: 'pending',
    paymentMethod: input.paymentMethod,
    grandTotal: Number(input.grandTotal),
    courierName: null,
    trackingNumber: null,
    estimatedDelivery: '4–6 business days',
    cityState: `${input.shippingAddress.city}, ${input.shippingAddress.state}`.slice(0, 160),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Payment record
  batch.set(doc(db, 'payments', paymentId), {
    orderId,
    orderNumber,
    userId: currentUser.uid,
    method: input.paymentMethod,
    amount: Number(input.grandTotal),
    currency: 'INR',
    status: 'pending',
    transactionRef: `TXN-${orderNumber}`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Order items + bounded stock decrement
  for (const item of input.items) {
    const itemId = makeDocId('oi');
    batch.set(doc(db, 'order_items', itemId), {
      orderId,
      orderNumber,
      userId: currentUser.uid,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName.slice(0, 200),
      sku: item.sku.slice(0, 80),
      colorName: item.colorName.slice(0, 80),
      sizeName: item.sizeName.slice(0, 80),
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      totalPrice: Number(item.totalPrice),
      imageUrl: (item.imageUrl || '').slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();

    // Best-effort stock decrement for variants & inventory in Firestore
    for (const item of input.items) {
      try {
        const varRef = doc(db, 'product_variants', item.variantId);
        const varSnap = await getDoc(varRef);
        if (varSnap.exists()) {
          const curQty = Number(varSnap.data().stockQuantity || 0);
          const nextQty = Math.max(0, curQty - Math.min(10, item.quantity));
          if (nextQty < curQty) {
            await updateDoc(varRef, {
              stockQuantity: nextQty,
              updatedAt: serverTimestamp(),
            });
          }
        }
        const invRef = doc(db, 'inventory', item.variantId);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const curQty = Number(invSnap.data().stockQuantity || 0);
          const nextQty = Math.max(0, curQty - Math.min(10, item.quantity));
          if (nextQty < curQty) {
            await updateDoc(invRef, {
              stockQuantity: nextQty,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch {
        // Non-blocking if starter fallback variant isn't seeded yet
      }
    }

    return { orderId, orderNumber };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
  }
}

export async function fetchMyOrders(uid: string): Promise<Order[]> {
  try {
    const [orderSnap, itemSnap] = await Promise.all([
      getDocs(query(collection(db, 'orders'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'order_items'), where('userId', '==', uid))),
    ]);

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const d of itemSnap.docs) {
      const it = d.data();
      const list = itemsByOrder.get(it.orderId) || [];
      list.push({
        id: d.id,
        orderId: it.orderId,
        orderNumber: it.orderNumber,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        sku: it.sku,
        colorName: it.colorName,
        sizeName: it.sizeName,
        unitPrice: Number(it.unitPrice || 0),
        quantity: Number(it.quantity || 1),
        totalPrice: Number(it.totalPrice || 0),
        imageUrl: it.imageUrl || '',
      });
      itemsByOrder.set(it.orderId, list);
    }

    return orderSnap.docs
      .map((d) => {
        const o = d.data();
        return {
          id: d.id,
          userId: o.userId,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          shippingAddressJson: o.shippingAddressJson,
          subtotal: Number(o.subtotal || 0),
          discountAmount: Number(o.discountAmount || 0),
          couponCode: o.couponCode || null,
          shippingFee: Number(o.shippingFee || 0),
          taxAmount: Number(o.taxAmount || 0),
          grandTotal: Number(o.grandTotal || 0),
          paymentMethod: o.paymentMethod || 'cod',
          paymentStatus: o.paymentStatus || 'pending',
          orderStatus: o.orderStatus || 'placed',
          courierName: o.courierName || '',
          trackingNumber: o.trackingNumber || '',
          estimatedDelivery: o.estimatedDelivery || '',
          notes: o.notes || '',
          createdAt: toIsoString(o.createdAt),
          items: itemsByOrder.get(d.id) || [],
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function fetchOrderByNumberForUser(orderNumber: string): Promise<Order | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'orders'),
        where('userId', '==', currentUser.uid),
        where('orderNumber', '==', orderNumber)
      )
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    const o = d.data();
    const itemSnap = await getDocs(
      query(
        collection(db, 'order_items'),
        where('userId', '==', currentUser.uid),
        where('orderId', '==', d.id)
      )
    );
    const items: OrderItem[] = itemSnap.docs.map((itDoc) => {
      const it = itDoc.data();
      return {
        id: itDoc.id,
        orderId: it.orderId,
        orderNumber: it.orderNumber,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        sku: it.sku,
        colorName: it.colorName,
        sizeName: it.sizeName,
        unitPrice: Number(it.unitPrice || 0),
        quantity: Number(it.quantity || 1),
        totalPrice: Number(it.totalPrice || 0),
        imageUrl: it.imageUrl || '',
      };
    });
    return {
      id: d.id,
      userId: o.userId,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddressJson: o.shippingAddressJson,
      subtotal: Number(o.subtotal || 0),
      discountAmount: Number(o.discountAmount || 0),
      couponCode: o.couponCode || null,
      shippingFee: Number(o.shippingFee || 0),
      taxAmount: Number(o.taxAmount || 0),
      grandTotal: Number(o.grandTotal || 0),
      paymentMethod: o.paymentMethod || 'cod',
      paymentStatus: o.paymentStatus || 'pending',
      orderStatus: o.orderStatus || 'placed',
      courierName: o.courierName || '',
      trackingNumber: o.trackingNumber || '',
      estimatedDelivery: o.estimatedDelivery || '',
      notes: o.notes || '',
      createdAt: toIsoString(o.createdAt),
      items,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `orders/${orderNumber}`);
  }
}

export async function trackOrderPublic(orderNumber: string): Promise<OrderTrackingSummary | null> {
  const cleanNum = orderNumber.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,60}$/.test(cleanNum)) return null;
  try {
    const snap = await getDoc(doc(db, 'order_tracking', cleanNum));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      orderNumber: d.orderNumber,
      orderStatus: d.orderStatus || 'placed',
      paymentStatus: d.paymentStatus || 'pending',
      paymentMethod: d.paymentMethod || 'cod',
      grandTotal: Number(d.grandTotal || 0),
      courierName: d.courierName || '',
      trackingNumber: d.trackingNumber || '',
      estimatedDelivery: d.estimatedDelivery || '',
      cityState: d.cityState || '',
      createdAt: toIsoString(d.createdAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `order_tracking/${cleanNum}`);
  }
}

// ============================================================================
// Admin Audit Logger & One-Click Starter Catalog Seeder
// ============================================================================

export async function logAdminActivity(
  action: string,
  entityType: string,
  entityId?: string,
  details?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) return;
  try {
    const id = makeDocId('log');
    await setDoc(doc(db, 'admin_activity_logs', id), {
      adminUid: user.uid,
      adminEmail: user.email,
      action: action.slice(0, 120),
      entityType: entityType.slice(0, 80),
      entityId: entityId ? entityId.slice(0, 128) : null,
      details: details ? details.slice(0, 1000) : null,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit log
  }
}

export async function seedStarterCatalogIfEmpty(force = false): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  const existingProds = await getDocs(collection(db, 'products'));
  if (!force && !existingProds.empty) {
    return { seeded: false, counts: { products: existingProds.size } };
  }

  const batch = writeBatch(db);

  // Settings
  batch.set(doc(db, 'website_settings', 'primary'), {
    announcementEn: DEFAULT_SETTINGS.announcementEn || '',
    announcementHi: DEFAULT_SETTINGS.announcementHi || '',
    logoUrl: DEFAULT_SETTINGS.logoUrl || '',
    founderPortraitUrl: DEFAULT_SETTINGS.founderPortraitUrl || '',
    whatsappNumber: DEFAULT_SETTINGS.whatsappNumber || '',
    supportEmail: DEFAULT_SETTINGS.supportEmail || '',
    instagramUrl: DEFAULT_SETTINGS.instagramUrl || '',
    facebookUrl: DEFAULT_SETTINGS.facebookUrl || '',
    youtubeUrl: DEFAULT_SETTINGS.youtubeUrl || '',
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'shipping_settings', 'primary'), {
    freeShippingThreshold: DEFAULT_SETTINGS.freeShippingThreshold ?? 1999,
    flatShippingFee: DEFAULT_SETTINGS.flatShippingFee ?? 120,
    taxRatePercent: DEFAULT_SETTINGS.taxRatePercent ?? 5,
    codEnabled: DEFAULT_SETTINGS.codEnabled !== false,
    updatedAt: serverTimestamp(),
  });

  // Categories
  for (const cat of DEFAULT_CATEGORIES) {
    batch.set(doc(db, 'categories', cat.id), {
      slug: cat.slug,
      name: cat.name,
      nameHi: cat.nameHi,
      description: cat.description,
      descriptionHi: cat.descriptionHi,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      seoTitle: cat.seoTitle || '',
      seoDescription: cat.seoDescription || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Products, Variants & Inventory
  let variantCount = 0;
  for (const prod of DEFAULT_PRODUCTS) {
    batch.set(doc(db, 'products', prod.id), {
      categoryId: prod.categoryId,
      categorySlug: prod.categorySlug || 'hijabs',
      slug: prod.slug,
      name: prod.name,
      nameHi: prod.nameHi || '',
      sku: prod.sku,
      description: prod.description,
      descriptionHi: prod.descriptionHi || '',
      fabric: prod.fabric,
      workDetails: prod.workDetails,
      sellingPrice: prod.sellingPrice,
      originalPrice: prod.originalPrice,
      discountPercent: prod.discountPercent,
      isActive: prod.isActive,
      isBestSeller: prod.isBestSeller,
      isNewArrival: prod.isNewArrival,
      isFeatured: prod.isFeatured,
      seoTitle: prod.seoTitle || '',
      seoDescription: prod.seoDescription || '',
      images: prod.images,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const v of prod.variants) {
      const vid = v.id || makeDocId('var');
      variantCount++;
      batch.set(doc(db, 'product_variants', vid), {
        productId: prod.id,
        sku: v.sku,
        colorName: v.colorName,
        colorHex: v.colorHex,
        sizeName: v.sizeName,
        priceOverride: v.priceOverride,
        stockQuantity: v.stockQuantity,
        imageUrl: v.imageUrl || '',
        isActive: v.isActive !== false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'inventory', vid), {
        productId: prod.id,
        variantId: vid,
        sku: v.sku,
        stockQuantity: v.stockQuantity,
        lowStockThreshold: 5,
        updatedAt: serverTimestamp(),
      });
    }
  }

  // Banners
  for (const b of DEFAULT_BANNERS) {
    batch.set(doc(db, 'banners', b.id), {
      heading: b.heading,
      headingHi: b.headingHi || '',
      subheading: b.subheading || '',
      subheadingHi: b.subheadingHi || '',
      ctaText: b.ctaText,
      ctaTextHi: b.ctaTextHi || '',
      ctaUrl: b.ctaUrl,
      desktopImageUrl: b.desktopImageUrl,
      mobileImageUrl: b.mobileImageUrl || '',
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Reels
  for (const r of DEFAULT_REELS) {
    batch.set(doc(db, 'reels', r.id), {
      title: r.title,
      caption: r.caption || '',
      videoUrl: r.videoUrl || '',
      thumbnailUrl: r.thumbnailUrl,
      productId: r.productId || null,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Blogs
  for (const blog of DEFAULT_BLOGS) {
    batch.set(doc(db, 'blogs', blog.id), {
      slug: blog.slug,
      title: blog.title,
      titleHi: blog.titleHi || '',
      excerpt: blog.excerpt,
      excerptHi: blog.excerptHi || '',
      content: blog.content,
      contentHi: blog.contentHi || '',
      featuredImageUrl: blog.featuredImageUrl,
      authorName: blog.authorName,
      category: blog.category,
      seoTitle: blog.seoTitle || '',
      seoDescription: blog.seoDescription || '',
      isPublished: blog.isPublished,
      publishedAt: blog.publishedAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Coupons
  for (const c of DEFAULT_COUPONS) {
    batch.set(doc(db, 'coupons', c.id), {
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.maxDiscount ?? null,
      usageLimit: c.usageLimit ?? null,
      usedCount: 0,
      isActive: c.isActive,
      expiresAt: c.expiresAt ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    await logAdminActivity('SEED_CATALOG', 'system', 'starter_catalog', 'Initialized ZARIFLY Firestore collections');
    return {
      seeded: true,
      counts: {
        categories: DEFAULT_CATEGORIES.length,
        products: DEFAULT_PRODUCTS.length,
        variants: variantCount,
        banners: DEFAULT_BANNERS.length,
        reels: DEFAULT_REELS.length,
        blogs: DEFAULT_BLOGS.length,
        coupons: DEFAULT_COUPONS.length,
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_seed');
  }
}

// ============================================================================
// Admin CRUD Operations (Protected by Firestore Rules + Admin PIN Gate)
// ============================================================================

export async function adminFetchDashboard() {
  try {
    const [ordersSnap, usersSnap, { products, reviews }, subsSnap, msgsSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'users')),
      fetchAllProductsEnriched({ includeInactive: true, includeAllReviews: true }),
      getDocs(collection(db, 'newsletter_subscribers')),
      getDocs(collection(db, 'contact_messages')),
    ]);

    const orders = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
      createdAt: toIsoString(d.data().createdAt),
    }));

    const totalRevenue = orders
      .filter((o) => o.orderStatus !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);

    const lowStockVariants = products.flatMap((p) =>
      p.variants
        .filter((v) => Number(v.stockQuantity || 0) <= 5)
        .map((v) => ({
          productId: p.id,
          productName: p.name,
          sku: v.sku,
          colorName: v.colorName,
          sizeName: v.sizeName,
          stockQuantity: v.stockQuantity,
        }))
    );

    const pendingReviewsCount = reviews.filter((r) => r.status === 'pending').length;

    return {
      totalOrders: orders.length,
      totalRevenue,
      totalCustomers: usersSnap.size,
      totalProducts: products.length,
      pendingReviewsCount,
      newsletterCount: subsSnap.size,
      contactMessagesCount: msgsSnap.size,
      lowStockVariants,
      recentOrders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_dashboard');
  }
}

export async function adminSaveProduct(
  existingId: string | null,
  payload: {
    categoryId: string;
    categorySlug?: string;
    slug?: string;
    name: string;
    nameHi?: string;
    sku: string;
    description: string;
    descriptionHi?: string;
    fabric: string;
    workDetails: string;
    sellingPrice: number;
    originalPrice: number;
    isActive: boolean;
    isBestSeller: boolean;
    isNewArrival: boolean;
    isFeatured: boolean;
    seoTitle?: string;
    seoDescription?: string;
    images: Product['images'];
    variants: ProductVariant[];
  }
): Promise<string> {
  const productId = existingId || makeDocId('prod');
  const slug = (payload.slug || slugify(payload.name)).slice(0, 160);
  const sellingPrice = Number(payload.sellingPrice || 0);
  const originalPrice = Number(payload.originalPrice || sellingPrice);

  const productData = {
    categoryId: payload.categoryId,
    categorySlug: payload.categorySlug || 'hijabs',
    slug,
    name: payload.name.trim().slice(0, 200),
    nameHi: (payload.nameHi || '').trim().slice(0, 200),
    sku: payload.sku.trim().slice(0, 80),
    description: payload.description.trim().slice(0, 5000),
    descriptionHi: (payload.descriptionHi || '').trim().slice(0, 5000),
    fabric: (payload.fabric || '').trim().slice(0, 200),
    workDetails: (payload.workDetails || '').trim().slice(0, 300),
    sellingPrice,
    originalPrice,
    discountPercent: computeDiscount(sellingPrice, originalPrice),
    isActive: Boolean(payload.isActive),
    isBestSeller: Boolean(payload.isBestSeller),
    isNewArrival: Boolean(payload.isNewArrival),
    isFeatured: Boolean(payload.isFeatured),
    seoTitle: (payload.seoTitle || '').trim().slice(0, 200),
    seoDescription: (payload.seoDescription || '').trim().slice(0, 500),
    images: (payload.images || []).slice(0, 10),
  };

  try {
    const prodRef = doc(db, 'products', productId);
    const existingSnap = existingId ? await getDoc(prodRef) : null;
    if (existingSnap && existingSnap.exists()) {
      await updateDoc(prodRef, {
        ...productData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(prodRef, {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Replace/upsert product variants + inventory documents
    const oldVars = await getDocs(
      query(collection(db, 'product_variants'), where('productId', '==', productId))
    );
    const keepVarIds = new Set<string>();
    const batch = writeBatch(db);

    for (const v of payload.variants || []) {
      const vid = v.id && !String(v.id).startsWith('tmp_') ? String(v.id) : makeDocId('var');
      keepVarIds.add(vid);
      const varRef = doc(db, 'product_variants', vid);
      const varExists = oldVars.docs.some((d) => d.id === vid);
      const varFields = {
        productId,
        sku: (v.sku || `${payload.sku}-${vid.slice(-4)}`).trim().slice(0, 80),
        colorName: (v.colorName || 'Ivory').trim().slice(0, 80),
        colorHex: (v.colorHex || '#EFE8DC').trim().slice(0, 20),
        sizeName: (v.sizeName || 'Standard').trim().slice(0, 80),
        priceOverride: v.priceOverride != null && String(v.priceOverride) !== '' ? Number(v.priceOverride) : null,
        stockQuantity: Math.max(0, Number(v.stockQuantity ?? 0)),
        imageUrl: (v.imageUrl || '').trim().slice(0, 1000),
        isActive: v.isActive !== false,
      };
      if (varExists) {
        batch.update(varRef, { ...varFields, updatedAt: serverTimestamp() });
      } else {
        batch.set(varRef, {
          ...varFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'inventory', vid), {
        productId,
        variantId: vid,
        sku: varFields.sku,
        stockQuantity: varFields.stockQuantity,
        lowStockThreshold: 5,
        updatedAt: serverTimestamp(),
      });
    }

    for (const oldDoc of oldVars.docs) {
      if (!keepVarIds.has(oldDoc.id)) {
        batch.delete(oldDoc.ref);
        batch.delete(doc(db, 'inventory', oldDoc.id));
      }
    }

    await batch.commit();
    await logAdminActivity(existingId ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', 'product', productId, payload.name);
    return productId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${productId}`);
  }
}

export async function adminDeleteProduct(productId: string): Promise<void> {
  try {
    const oldVars = await getDocs(
      query(collection(db, 'product_variants'), where('productId', '==', productId))
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, 'products', productId));
    for (const d of oldVars.docs) {
      batch.delete(d.ref);
      batch.delete(doc(db, 'inventory', d.id));
    }
    await batch.commit();
    await logAdminActivity('DELETE_PRODUCT', 'product', productId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

export async function adminFetchBanners(): Promise<Banner[]> {
  try {
    const snap = await getDocs(collection(db, 'banners'));
    return snap.docs
      .map((d) => {
        const b = d.data();
        return {
          id: d.id,
          heading: b.heading || '',
          headingHi: b.headingHi || '',
          subheading: b.subheading || '',
          subheadingHi: b.subheadingHi || '',
          ctaText: b.ctaText || 'Shop Now',
          ctaTextHi: b.ctaTextHi || '',
          ctaUrl: b.ctaUrl || '/shop',
          desktopImageUrl: b.desktopImageUrl || '',
          mobileImageUrl: b.mobileImageUrl || '',
          sortOrder: Number(b.sortOrder ?? 0),
          isActive: b.isActive !== false,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'banners');
  }
}

export async function adminSaveBanner(existingId: string | null, data: Omit<Banner, 'id'>): Promise<string> {
  const id = existingId || makeDocId('banner');
  const fields = {
    heading: data.heading.trim().slice(0, 200),
    headingHi: (data.headingHi || '').trim().slice(0, 200),
    subheading: (data.subheading || '').trim().slice(0, 500),
    subheadingHi: (data.subheadingHi || '').trim().slice(0, 500),
    ctaText: (data.ctaText || 'Shop Now').trim().slice(0, 80),
    ctaTextHi: (data.ctaTextHi || '').trim().slice(0, 80),
    ctaUrl: (data.ctaUrl || '/shop').trim().slice(0, 500),
    desktopImageUrl: data.desktopImageUrl.trim().slice(0, 1000),
    mobileImageUrl: (data.mobileImageUrl || '').trim().slice(0, 1000),
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: Boolean(data.isActive),
  };
  try {
    const refDoc = doc(db, 'banners', id);
    const snap = existingId ? await getDoc(refDoc) : null;
    if (snap && snap.exists()) {
      await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() });
    } else {
      await setDoc(refDoc, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await logAdminActivity(existingId ? 'UPDATE_BANNER' : 'CREATE_BANNER', 'banner', id, fields.heading);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `banners/${id}`);
  }
}

export async function adminDeleteBanner(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'banners', id));
    await logAdminActivity('DELETE_BANNER', 'banner', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `banners/${id}`);
  }
}

export async function adminFetchReels(): Promise<ReelItem[]> {
  try {
    const snap = await getDocs(collection(db, 'reels'));
    return snap.docs
      .map((d) => {
        const r = d.data();
        return {
          id: d.id,
          title: r.title || '',
          caption: r.caption || '',
          videoUrl: r.videoUrl || '',
          thumbnailUrl: r.thumbnailUrl || '',
          productId: r.productId || null,
          sortOrder: Number(r.sortOrder ?? 0),
          isActive: r.isActive !== false,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reels');
  }
}

export async function adminSaveReel(existingId: string | null, data: Omit<ReelItem, 'id' | 'product'>): Promise<string> {
  const id = existingId || makeDocId('reel');
  const fields = {
    title: data.title.trim().slice(0, 200),
    caption: (data.caption || '').trim().slice(0, 500),
    videoUrl: (data.videoUrl || '').trim().slice(0, 1000),
    thumbnailUrl: data.thumbnailUrl.trim().slice(0, 1000),
    productId: data.productId ? String(data.productId).slice(0, 128) : null,
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: Boolean(data.isActive),
  };
  try {
    const refDoc = doc(db, 'reels', id);
    const snap = existingId ? await getDoc(refDoc) : null;
    if (snap && snap.exists()) {
      await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() });
    } else {
      await setDoc(refDoc, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await logAdminActivity(existingId ? 'UPDATE_REEL' : 'CREATE_REEL', 'reel', id, fields.title);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reels/${id}`);
  }
}

export async function adminDeleteReel(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reels', id));
    await logAdminActivity('DELETE_REEL', 'reel', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reels/${id}`);
  }
}

export async function adminFetchReviews(): Promise<ReviewItem[]> {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    return snap.docs
      .map((d) => {
        const r = d.data();
        return {
          id: d.id,
          productId: r.productId || '',
          userId: r.userId || '',
          productName: r.productName || '',
          productSlug: r.productSlug || '',
          customerName: r.customerName || 'Guest',
          customerEmail: r.customerEmail || '',
          rating: Number(r.rating || 5),
          title: r.title || '',
          comment: r.comment || '',
          imagesJson: Array.isArray(r.imagesJson) ? r.imagesJson : [],
          isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
          status: r.status || 'pending',
          createdAt: toIsoString(r.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reviews');
  }
}

export async function adminSaveReview(
  existingId: string | null,
  data: {
    productId: string;
    productName?: string;
    productSlug?: string;
    customerName: string;
    customerEmail?: string;
    rating: number;
    title?: string;
    comment: string;
    imagesJson?: string[];
    isVerifiedPurchase: boolean;
    status: 'pending' | 'approved' | 'rejected';
  }
): Promise<string> {
  const id = existingId || makeDocId('rev');
  const currentUid = auth.currentUser?.uid || 'admin';
  const fields = {
    productId: data.productId,
    productName: (data.productName || '').slice(0, 200),
    productSlug: (data.productSlug || '').slice(0, 160),
    customerName: data.customerName.trim().slice(0, 120),
    customerEmail: (data.customerEmail || '').trim().slice(0, 160),
    rating: Math.min(5, Math.max(1, Number(data.rating || 5))),
    title: (data.title || '').trim().slice(0, 200),
    comment: data.comment.trim().slice(0, 3000),
    imagesJson: (data.imagesJson || []).slice(0, 5),
    isVerifiedPurchase: Boolean(data.isVerifiedPurchase),
    status: data.status,
  };
  try {
    const refDoc = doc(db, 'reviews', id);
    const snap = existingId ? await getDoc(refDoc) : null;
    if (snap && snap.exists()) {
      await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() });
    } else {
      await setDoc(refDoc, {
        ...fields,
        userId: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logAdminActivity(existingId ? 'UPDATE_REVIEW' : 'CREATE_REVIEW', 'review', id, `${fields.status} (${fields.rating}★)`);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reviews/${id}`);
  }
}

export async function adminDeleteReview(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reviews', id));
    await logAdminActivity('DELETE_REVIEW', 'review', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reviews/${id}`);
  }
}

export async function adminFetchBlogs(): Promise<BlogPost[]> {
  try {
    const snap = await getDocs(collection(db, 'blogs'));
    return snap.docs
      .map((d) => {
        const b = d.data();
        return {
          id: d.id,
          slug: b.slug || d.id,
          title: b.title || '',
          titleHi: b.titleHi || '',
          excerpt: b.excerpt || '',
          excerptHi: b.excerptHi || '',
          content: b.content || '',
          contentHi: b.contentHi || '',
          featuredImageUrl: b.featuredImageUrl || '',
          authorName: b.authorName || 'Sama Shaikh',
          category: b.category || 'Journal',
          seoTitle: b.seoTitle || '',
          seoDescription: b.seoDescription || '',
          isPublished: b.isPublished !== false,
          publishedAt: b.publishedAt || toIsoString(b.createdAt),
        };
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'blogs');
  }
}

export async function adminSaveBlog(existingId: string | null, data: Omit<BlogPost, 'id'>): Promise<string> {
  const id = existingId || makeDocId('blog');
  const fields = {
    slug: (data.slug || slugify(data.title)).slice(0, 180),
    title: data.title.trim().slice(0, 240),
    titleHi: (data.titleHi || '').trim().slice(0, 240),
    excerpt: data.excerpt.trim().slice(0, 1000),
    excerptHi: (data.excerptHi || '').trim().slice(0, 1000),
    content: data.content.trim().slice(0, 30000),
    contentHi: (data.contentHi || '').trim().slice(0, 30000),
    featuredImageUrl: (data.featuredImageUrl || '').trim().slice(0, 1000),
    authorName: (data.authorName || 'Sama Shaikh').trim().slice(0, 120),
    category: (data.category || 'Journal').trim().slice(0, 80),
    seoTitle: (data.seoTitle || '').trim().slice(0, 200),
    seoDescription: (data.seoDescription || '').trim().slice(0, 500),
    isPublished: Boolean(data.isPublished),
    publishedAt: data.publishedAt || new Date().toISOString(),
  };
  try {
    const refDoc = doc(db, 'blogs', id);
    const snap = existingId ? await getDoc(refDoc) : null;
    if (snap && snap.exists()) {
      await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() });
    } else {
      await setDoc(refDoc, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await logAdminActivity(existingId ? 'UPDATE_BLOG' : 'CREATE_BLOG', 'blog', id, fields.title);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `blogs/${id}`);
  }
}

export async function adminDeleteBlog(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'blogs', id));
    await logAdminActivity('DELETE_BLOG', 'blog', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `blogs/${id}`);
  }
}

export async function adminFetchOrders(statusFilter?: string): Promise<Order[]> {
  try {
    const [orderSnap, itemSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'order_items')),
    ]);

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const d of itemSnap.docs) {
      const it = d.data();
      const list = itemsByOrder.get(it.orderId) || [];
      list.push({
        id: d.id,
        orderId: it.orderId,
        orderNumber: it.orderNumber,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.productName,
        sku: it.sku,
        colorName: it.colorName,
        sizeName: it.sizeName,
        unitPrice: Number(it.unitPrice || 0),
        quantity: Number(it.quantity || 1),
        totalPrice: Number(it.totalPrice || 0),
        imageUrl: it.imageUrl || '',
      });
      itemsByOrder.set(it.orderId, list);
    }

    return orderSnap.docs
      .map((d) => {
        const o = d.data();
        return {
          id: d.id,
          userId: o.userId,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          shippingAddressJson: o.shippingAddressJson,
          subtotal: Number(o.subtotal || 0),
          discountAmount: Number(o.discountAmount || 0),
          couponCode: o.couponCode || null,
          shippingFee: Number(o.shippingFee || 0),
          taxAmount: Number(o.taxAmount || 0),
          grandTotal: Number(o.grandTotal || 0),
          paymentMethod: o.paymentMethod || 'cod',
          paymentStatus: o.paymentStatus || 'pending',
          orderStatus: o.orderStatus || 'placed',
          courierName: o.courierName || '',
          trackingNumber: o.trackingNumber || '',
          estimatedDelivery: o.estimatedDelivery || '',
          notes: o.notes || '',
          createdAt: toIsoString(o.createdAt),
          items: itemsByOrder.get(d.id) || [],
        };
      })
      .filter((o) => (!statusFilter || statusFilter === 'all' ? true : o.orderStatus === statusFilter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function adminUpdateOrder(
  orderId: string,
  orderNumber: string,
  updates: {
    orderStatus?: string;
    paymentStatus?: string;
    courierName?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    notes?: string;
  }
): Promise<void> {
  try {
    const cleanUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const trackUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };

    if (updates.orderStatus) {
      cleanUpdates.orderStatus = updates.orderStatus;
      trackUpdates.orderStatus = updates.orderStatus;
    }
    if (updates.paymentStatus) {
      cleanUpdates.paymentStatus = updates.paymentStatus;
      trackUpdates.paymentStatus = updates.paymentStatus;
    }
    if (updates.courierName !== undefined) {
      cleanUpdates.courierName = updates.courierName.trim().slice(0, 120) || null;
      trackUpdates.courierName = updates.courierName.trim().slice(0, 120) || null;
    }
    if (updates.trackingNumber !== undefined) {
      cleanUpdates.trackingNumber = updates.trackingNumber.trim().slice(0, 120) || null;
      trackUpdates.trackingNumber = updates.trackingNumber.trim().slice(0, 120) || null;
    }
    if (updates.estimatedDelivery !== undefined) {
      cleanUpdates.estimatedDelivery = updates.estimatedDelivery.trim().slice(0, 120) || null;
      trackUpdates.estimatedDelivery = updates.estimatedDelivery.trim().slice(0, 120) || null;
    }
    if (updates.notes !== undefined) {
      cleanUpdates.notes = updates.notes.trim().slice(0, 1000) || null;
    }

    await updateDoc(doc(db, 'orders', orderId), cleanUpdates);
    try {
      await updateDoc(doc(db, 'order_tracking', orderNumber), trackUpdates);
    } catch {
      // Ignore if tracking mirror doc absent
    }
    await logAdminActivity('UPDATE_ORDER', 'order', orderId, JSON.stringify(updates).slice(0, 500));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function adminFetchCustomers() {
  try {
    const [usersSnap, ordersSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'orders')),
    ]);
    const ordersByUser = new Map<string, { count: number; totalSpent: number }>();
    for (const d of ordersSnap.docs) {
      const o = d.data();
      const rec = ordersByUser.get(o.userId) || { count: 0, totalSpent: 0 };
      rec.count += 1;
      if (o.orderStatus !== 'cancelled') rec.totalSpent += Number(o.grandTotal || 0);
      ordersByUser.set(o.userId, rec);
    }
    return usersSnap.docs.map((d) => {
      const u = d.data();
      const stats = ordersByUser.get(d.id) || { count: 0, totalSpent: 0 };
      return {
        id: d.id,
        uid: u.uid || d.id,
        fullName: u.fullName || '',
        email: u.email || '',
        phone: u.phone || '',
        role: u.role || 'customer',
        orderCount: stats.count,
        totalSpent: stats.totalSpent,
        createdAt: toIsoString(u.createdAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function adminFetchMarketingData() {
  try {
    const [couponSnap, subSnap, msgSnap] = await Promise.all([
      getDocs(collection(db, 'coupons')),
      getDocs(collection(db, 'newsletter_subscribers')),
      getDocs(collection(db, 'contact_messages')),
    ]);

    const coupons: CouponItem[] = couponSnap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        code: c.code || '',
        description: c.description || '',
        discountType: c.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: Number(c.discountValue || 0),
        minOrderAmount: Number(c.minOrderAmount || 0),
        maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : null,
        usageLimit: c.usageLimit != null ? Number(c.usageLimit) : null,
        usedCount: Number(c.usedCount || 0),
        isActive: c.isActive !== false,
        expiresAt: c.expiresAt || null,
      };
    });

    const subscribers = subSnap.docs
      .map((d) => ({
        id: d.id,
        email: d.data().email || '',
        source: d.data().source || 'storefront',
        createdAt: toIsoString(d.data().createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const messages = msgSnap.docs
      .map((d) => ({
        id: d.id,
        name: d.data().name || '',
        email: d.data().email || '',
        phone: d.data().phone || '',
        subject: d.data().subject || '',
        message: d.data().message || '',
        status: d.data().status || 'new',
        createdAt: toIsoString(d.data().createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { coupons, subscribers, messages };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'marketing');
  }
}

export async function adminCreateCoupon(data: {
  code: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  isActive: boolean;
}): Promise<string> {
  const id = makeDocId('coupon');
  try {
    await setDoc(doc(db, 'coupons', id), {
      code: data.code.trim().toUpperCase().slice(0, 40),
      description: data.description.trim().slice(0, 300),
      discountType: data.discountType,
      discountValue: Number(data.discountValue),
      minOrderAmount: Number(data.minOrderAmount || 0),
      maxDiscount: data.maxDiscount != null ? Number(data.maxDiscount) : null,
      usageLimit: data.usageLimit != null ? Number(data.usageLimit) : null,
      usedCount: 0,
      isActive: Boolean(data.isActive),
      expiresAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAdminActivity('CREATE_COUPON', 'coupon', id, data.code.toUpperCase());
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `coupons/${id}`);
  }
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'coupons', id));
    await logAdminActivity('DELETE_COUPON', 'coupon', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `coupons/${id}`);
  }
}

export async function adminSaveSettings(settings: StoreSettings): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'website_settings', 'primary'), {
    announcementEn: (settings.announcementEn || '').trim().slice(0, 400),
    announcementHi: (settings.announcementHi || '').trim().slice(0, 400),
    logoUrl: (settings.logoUrl || '').trim().slice(0, 1000),
    founderPortraitUrl: (settings.founderPortraitUrl || '').trim().slice(0, 1000),
    whatsappNumber: (settings.whatsappNumber || '').trim().slice(0, 30),
    supportEmail: (settings.supportEmail || '').trim().slice(0, 160),
    instagramUrl: (settings.instagramUrl || '').trim().slice(0, 500),
    facebookUrl: (settings.facebookUrl || '').trim().slice(0, 500),
    youtubeUrl: (settings.youtubeUrl || '').trim().slice(0, 500),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'shipping_settings', 'primary'), {
    freeShippingThreshold: Number(settings.freeShippingThreshold ?? 1999),
    flatShippingFee: Number(settings.flatShippingFee ?? 120),
    taxRatePercent: Number(settings.taxRatePercent ?? 5),
    codEnabled: settings.codEnabled !== false,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    await logAdminActivity('UPDATE_SETTINGS', 'settings', 'primary', 'Updated website & shipping settings');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'website_settings/primary');
  }
}

export async function adminFetchActivityLogs() {
  try {
    const snap = await getDocs(collection(db, 'admin_activity_logs'));
    return snap.docs
      .map((d) => ({
        id: d.id,
        adminUid: d.data().adminUid || '',
        adminEmail: d.data().adminEmail || '',
        action: d.data().action || '',
        entityType: d.data().entityType || '',
        entityId: d.data().entityId || '',
        details: d.data().details || '',
        createdAt: toIsoString(d.data().createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 80);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_activity_logs');
  }
}
