import {
  DEFAULT_BANNERS,
  DEFAULT_BLOGS,
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  DEFAULT_REELS,
  DEFAULT_SETTINGS,
} from '../lib/defaultCatalog.ts';
import type {
  Banner,
  BlogPost,
  Category,
  Product,
  ReelItem,
  ReviewItem,
  StoreSettings,
} from '../types.ts';

export interface FallbackState {
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  products: Product[];
  reels: ReelItem[];
  blogs: BlogPost[];
  reviews: (ReviewItem & { productId: number; customerEmail?: string; status: string })[];
  coupons: Array<{
    id: number;
    code: string;
    description: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    isActive: boolean;
  }>;
  subscribers: Array<{ id: number; email: string; createdAt: string }>;
  messages: Array<{
    id: number;
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    createdAt: string;
  }>;
  nextId: number;
}

declare global {
  var _zariflyFallbackState: FallbackState | undefined;
}

export function getFallbackState(): FallbackState {
  if (!global._zariflyFallbackState) {
    global._zariflyFallbackState = {
      settings: structuredClone(DEFAULT_SETTINGS),
      categories: structuredClone(DEFAULT_CATEGORIES),
      banners: structuredClone(DEFAULT_BANNERS),
      products: structuredClone(DEFAULT_PRODUCTS),
      reels: structuredClone(DEFAULT_REELS),
      blogs: structuredClone(DEFAULT_BLOGS),
      reviews: [],
      coupons: [
        {
          id: 1,
          code: 'ZARIFLY10',
          description: '10% off boutique orders above ₹1,499',
          discountType: 'percentage',
          discountValue: 10,
          minOrderAmount: 1499,
          isActive: true,
        },
        {
          id: 2,
          code: 'WELCOME200',
          description: 'Flat ₹200 off on orders above ₹1,999',
          discountType: 'fixed',
          discountValue: 200,
          minOrderAmount: 1999,
          isActive: true,
        },
      ],
      subscribers: [],
      messages: [],
      nextId: 100,
    };
  }
  return global._zariflyFallbackState;
}

export function getFallbackBootstrap() {
  const s = getFallbackState();
  const activeProducts = s.products.filter((p) => p.isActive);
  const prodMap = new Map(activeProducts.map((p) => [p.id, p]));
  return {
    settings: s.settings,
    categories: s.categories.filter((c) => c.isActive !== false),
    banners: s.banners
      .filter((b) => b.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    reels: s.reels
      .filter((r) => r.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((r) => ({
        ...r,
        product: r.productId ? prodMap.get(r.productId) || null : null,
      })),
    bestSellers: activeProducts.filter((p) => p.isBestSeller),
    newArrivals: activeProducts.filter((p) => p.isNewArrival),
    featuredProducts: activeProducts.filter((p) => p.isFeatured),
    reviews: s.reviews.filter((r) => r.status === 'approved'),
    blogs: s.blogs.filter((b) => b.isPublished),
  };
}
