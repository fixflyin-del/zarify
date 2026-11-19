export type Language = 'en' | 'hi';

export interface User {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'admin' | 'super_admin' | string;
  preferredLang: Language | string;
}

export interface Category {
  id: number;
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
  id?: number;
  productId?: number;
  url: string;
  cloudinaryPublicId?: string;
  altText?: string;
  colorName?: string;
  sortOrder: number;
}

export interface ProductVariant {
  id?: number;
  productId?: number;
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
  id: number;
  categoryId: number;
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
  id: number;
  quantity: number;
  productId: number;
  productSlug: string;
  productName: string;
  productNameHi?: string | null;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  variantId: number;
  sku: string;
  colorName: string;
  colorHex: string;
  sizeName: string;
  stockQuantity: number;
  imageUrl: string;
  availableVariants: ProductVariant[];
}

export interface CartState {
  cartId: number | null;
  sessionId?: string | null;
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
  id: number;
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
  id: number;
  title: string;
  caption?: string;
  videoUrl?: string;
  thumbnailUrl: string;
  productId?: number | null;
  product?: Product | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ReviewItem {
  id: number;
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
  id: number;
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
  instagramPosts?: Array<{ imageUrl: string; caption: string; link: string }>;
}

export interface OrderItem {
  id: number;
  productId?: number | null;
  variantId?: number | null;
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
  id: number;
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
