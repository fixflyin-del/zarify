export type Language = 'en' | 'hi';

export interface User {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'admin' | 'super_admin' | string;
  preferredLang: Language | string;
  createdAt?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ProductImage {
  id?: string;
  productId?: string;
  url: string;
  storagePath?: string;
  altText?: string;
  colorName?: string;
  sortOrder: number;
}

export interface ProductVariant {
  id?: string;
  productId?: string;
  sku: string;
  colorName: string;
  colorHex: string;
  sizeName: string;
  priceOverride: number | null;
  stockQuantity: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  categorySlug?: string;
  category?: Category | null;
  slug: string;
  name: string;
  nameHi?: string | null;
  sku: string;
  description: string;
  descriptionHi?: string | null;
  fabric: string;
  workDetails: string;
  sellingPrice: number;
  originalPrice: number;
  discountPercent: number;
  isActive: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  reviewCount: number;
  avgRating: number;
  totalStock: number;
}

export interface CartItem {
  id: string;
  quantity: number;
  productId: string;
  productSlug: string;
  productName: string;
  productNameHi?: string | null;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  variantId: string;
  sku: string;
  colorName: string;
  colorHex: string;
  sizeName: string;
  stockQuantity: number;
  imageUrl: string;
  availableVariants: ProductVariant[];
}

export interface CartState {
  cartId: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  appliedCoupon: { code: string; description: string } | null;
  shippingFee: number;
  freeShippingThreshold: number;
  taxIncludedNote: string;
  taxAmount: number;
  grandTotal: number;
}

export interface Banner {
  id: string;
  heading: string;
  headingHi?: string;
  subheading?: string;
  subheadingHi?: string;
  ctaText: string;
  ctaTextHi?: string;
  ctaUrl: string;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ReelItem {
  id: string;
  title: string;
  caption?: string;
  videoUrl?: string;
  thumbnailUrl: string;
  productId?: string | null;
  product?: Product | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ReviewItem {
  id: string;
  productId?: string;
  userId?: string;
  rating: number;
  title?: string;
  comment: string;
  imagesJson?: string[];
  isVerifiedPurchase: boolean;
  status?: string;
  createdAt: string;
  customerName: string;
  customerEmail?: string;
  productName?: string;
  productSlug?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  titleHi?: string;
  excerpt: string;
  excerptHi?: string;
  content: string;
  contentHi?: string;
  featuredImageUrl: string;
  authorName: string;
  category: string;
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  publishedAt: string;
}

export interface CouponItem {
  id: string;
  code: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string | null;
}

export interface StoreSettings {
  announcementEn?: string;
  announcementHi?: string;
  logoUrl?: string;
  founderPortraitUrl?: string;
  whatsappNumber?: string;
  supportEmail?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  freeShippingThreshold?: number;
  flatShippingFee?: number;
  taxRatePercent?: number;
  codEnabled?: boolean;
}

export interface OrderItem {
  id: string;
  orderId?: string;
  orderNumber?: string;
  productId?: string | null;
  variantId?: string | null;
  productName: string;
  sku: string;
  colorName: string;
  sizeName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  userId?: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressJson: {
    fullName: string;
    mobile: string;
    email: string;
    houseFlat: string;
    streetArea: string;
    city: string;
    district?: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
  subtotal: number;
  discountAmount: number;
  couponCode?: string | null;
  shippingFee: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  courierName?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  notes?: string;
  createdAt: string;
  items?: OrderItem[];
}

export interface OrderTrackingSummary {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: number;
  courierName?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  cityState?: string;
  createdAt: string;
}
