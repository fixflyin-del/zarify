import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users (Customers & Admins)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull().default(''),
  phone: text('phone').default(''),
  role: text('role').notNull().default('customer'), // 'customer' | 'admin' | 'super_admin'
  preferredLang: text('preferred_lang').notNull().default('en'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Categories (Hijabs, Naqaabs, Dupattas)
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  nameHi: text('name_hi').notNull().default(''),
  description: text('description').notNull().default(''),
  descriptionHi: text('description_hi').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  nameHi: text('name_hi').default(''),
  sku: text('sku').notNull().unique(),
  description: text('description').notNull(),
  descriptionHi: text('description_hi').default(''),
  fabric: text('fabric').notNull().default(''),
  workDetails: text('work_details').notNull().default(''),
  sellingPrice: integer('selling_price').notNull(),
  originalPrice: integer('original_price').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Product Images (5 square images per product + optional color mapping)
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  cloudinaryPublicId: text('cloudinary_public_id').default(''),
  altText: text('alt_text').default(''),
  colorName: text('color_name').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Product Variants (Colour + Size + Separate Variant Inventory)
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull().unique(),
  colorName: text('color_name').notNull(),
  colorHex: text('color_hex').notNull().default('#C6A25A'),
  sizeName: text('size_name').notNull().default('Standard'),
  priceOverride: integer('price_override'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  imageUrl: text('image_url').default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Customer Saved Addresses
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').notNull(),
  houseFlat: text('house_flat').notNull(),
  streetArea: text('street_area').notNull(),
  city: text('city').notNull(),
  district: text('district').default(''),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  landmark: text('landmark').default(''),
  latitude: text('latitude').default(''),
  longitude: text('longitude').default(''),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Persistent Carts (for logged-in users & guest session IDs)
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').unique(),
  couponCode: text('coupon_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Cart Items
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .references(() => carts.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id')
    .references(() => productVariants.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Wishlists
export const wishlists = pgTable(
  'wishlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('wishlist_user_product_idx').on(table.userId, table.productId)]
);

// 10. Coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').default(''),
  discountType: text('discount_type').notNull().default('percentage'), // 'percentage' | 'fixed'
  discountValue: integer('discount_value').notNull(),
  minOrderAmount: integer('min_order_amount').notNull().default(0),
  maxDiscountAmount: integer('max_discount_amount'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Orders
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  shippingAddressJson: jsonb('shipping_address_json').notNull(),
  subtotal: integer('subtotal').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  couponCode: text('coupon_code'),
  shippingFee: integer('shipping_fee').notNull().default(0),
  taxAmount: integer('tax_amount').notNull().default(0),
  grandTotal: integer('grand_total').notNull(),
  paymentMethod: text('payment_method').notNull().default('payu'), // 'payu' | 'cod'
  paymentStatus: text('payment_status').notNull().default('pending'), // 'pending' | 'initiated' | 'paid' | 'failed' | 'refunded'
  orderStatus: text('order_status').notNull().default('pending'),
  // 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'return_requested' | 'returned' | 'refunded'
  courierName: text('courier_name').default(''),
  trackingNumber: text('tracking_number').default(''),
  estimatedDelivery: text('estimated_delivery').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Order Items
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  colorName: text('color_name').notNull(),
  sizeName: text('size_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: integer('total_price').notNull(),
  imageUrl: text('image_url').default(''),
});

// 13. Payment Transactions (PayU India logs & idempotency)
export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  gateway: text('gateway').notNull().default('payu'),
  txnid: text('txnid').notNull().unique(),
  mihpayid: text('mihpayid').default(''),
  status: text('status').notNull().default('initiated'), // 'initiated' | 'success' | 'failure' | 'refunded'
  amount: text('amount').notNull(),
  hashSent: text('hash_sent').default(''),
  hashVerified: boolean('hash_verified').notNull().default(false),
  rawPayloadJson: jsonb('raw_payload_json'),
  refundId: text('refund_id').default(''),
  refundStatus: text('refund_status').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Genuine Customer Reviews (linked to real users & optional verified orders)
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  title: text('title').default(''),
  comment: text('comment').notNull(),
  imagesJson: jsonb('images_json').$type<string[]>().default([]),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Homepage Hero Banners
export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  heading: text('heading').notNull(),
  headingHi: text('heading_hi').default(''),
  subheading: text('subheading').default(''),
  subheadingHi: text('subheading_hi').default(''),
  ctaText: text('cta_text').notNull().default('Shop Collection'),
  ctaTextHi: text('cta_text_hi').default('कलेक्शन देखें'),
  ctaUrl: text('cta_url').notNull().default('/shop'),
  desktopImageUrl: text('desktop_image_url').notNull(),
  mobileImageUrl: text('mobile_image_url').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Instagram-Style Reels Videos
export const reels = pgTable('reels', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  caption: text('caption').default(''),
  videoUrl: text('video_url').default(''),
  thumbnailUrl: text('thumbnail_url').notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Blog Articles
export const blogs = pgTable('blogs', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleHi: text('title_hi').default(''),
  excerpt: text('excerpt').notNull(),
  excerptHi: text('excerpt_hi').default(''),
  content: text('content').notNull(),
  contentHi: text('content_hi').default(''),
  featuredImageUrl: text('featured_image_url').notNull(),
  authorName: text('author_name').notNull().default('Sama Shaikh'),
  category: text('category').notNull().default('Modest Fashion'),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  isPublished: boolean('is_published').notNull().default(true),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. Newsletter Subscribers
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Website Settings (key-value JSON)
export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  valueJson: jsonb('value_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Contact Messages
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  subject: text('subject').default('General Inquiry'),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Admin Activity Logs
export const adminActivityLogs = pgTable('admin_activity_logs', {
  id: serial('id').primaryKey(),
  adminUserId: integer('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default(''),
  detailsJson: jsonb('details_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  transactions: many(paymentTransactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));
