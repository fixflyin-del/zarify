import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiRequest, setAuthToken } from '../lib/api';
import { DEFAULT_BOOTSTRAP } from '../lib/defaultCatalog';
import { translations } from '../i18n/translations';
import type {
  Banner,
  BlogPost,
  CartState,
  Category,
  Language,
  Product,
  ReelItem,
  ReviewItem,
  StoreSettings,
  User,
} from '../types';

const EMPTY_CART: CartState = {
  cartId: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  discountAmount: 0,
  appliedCoupon: null,
  shippingFee: 0,
  freeShippingThreshold: 1999,
  taxIncludedNote: 'Inclusive of 5% GST',
  taxAmount: 0,
  grandTotal: 0,
};

interface BootstrapData {
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  reels: ReelItem[];
  bestSellers: Product[];
  newArrivals: Product[];
  featuredProducts: Product[];
  reviews: ReviewItem[];
  blogs: BlogPost[];
}

interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  user: User | null;
  authLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  cart: CartState;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (productId: number, variantId: number, quantity?: number) => Promise<void>;
  updateCartItem: (itemId: number, payload: { quantity?: number; variantId?: number }) => Promise<void>;
  removeCartItem: (itemId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refreshCart: () => Promise<void>;
  wishlistIds: number[];
  toggleWishlist: (productId: number) => Promise<void>;
  bootstrap: BootstrapData | null;
  bootstrapLoading: boolean;
  refreshBootstrap: () => Promise<void>;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  toasts: ToastMessage[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('zarifly_lang');
      if (saved === 'hi' || saved === 'en') return saved;
    }
    return 'en';
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zarifly_lang', next);
      document.documentElement.lang = next;
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[lang][key] || translations.en[key] || key;
    },
    [lang]
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      setBootstrapLoading(true);
      const data = await apiRequest<BootstrapData>('/api/bootstrap');
      if (data && (data.banners?.length || data.categories?.length || data.bestSellers?.length)) {
        setBootstrap(data);
      } else {
        setBootstrap(DEFAULT_BOOTSTRAP);
      }
    } catch (err) {
      console.error('Bootstrap fetch error (using default catalog):', err);
      setBootstrap((prev) => prev || DEFAULT_BOOTSTRAP);
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const data = await apiRequest<CartState>('/api/cart');
      setCart(data);
    } catch (err) {
      console.error('Cart fetch error:', err);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      setAuthLoading(true);
      const data = await apiRequest<{ user: User; wishlistIds: number[] }>('/api/auth/me');
      setUser(data.user);
      setWishlistIds(data.wishlistIds || []);
    } catch {
      setUser(null);
      setWishlistIds([]);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
    refreshAuth().finally(() => {
      refreshCart();
    });
  }, [refreshBootstrap, refreshAuth, refreshCart]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await apiRequest<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshAuth();
    await refreshCart();
    return res.user;
  };

  const registerWithEmail = async (payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    const res = await apiRequest<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshCart();
    return res.user;
  };

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    const res = await apiRequest<{ user: User; token: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshAuth();
    await refreshCart();
    return res.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      await firebaseSignOut(auth).catch(() => {});
    } finally {
      setAuthToken(null);
      setUser(null);
      setWishlistIds([]);
      await refreshCart();
      notify(lang === 'hi' ? 'आप सफलतापूर्वक लॉग आउट हो गए।' : 'Signed out successfully.', 'info');
    }
  };

  const addToCart = async (productId: number, variantId: number, quantity = 1) => {
    const data = await apiRequest<CartState>('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, variantId, quantity }),
    });
    setCart(data);
    setCartDrawerOpen(true);
    notify(lang === 'hi' ? 'आपके बैग में जोड़ा गया।' : 'Added to your shopping bag.', 'success');
  };

  const updateCartItem = async (
    itemId: number,
    payload: { quantity?: number; variantId?: number }
  ) => {
    const data = await apiRequest<CartState>(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setCart(data);
  };

  const removeCartItem = async (itemId: number) => {
    const data = await apiRequest<CartState>(`/api/cart/items/${itemId}`, {
      method: 'DELETE',
    });
    setCart(data);
  };

  const applyCoupon = async (code: string) => {
    const data = await apiRequest<CartState>('/api/cart/coupon', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setCart(data);
    notify(lang === 'hi' ? 'कूपन लागू हो गया।' : 'Coupon applied successfully.', 'success');
  };

  const removeCoupon = async () => {
    const data = await apiRequest<CartState>('/api/cart/coupon', {
      method: 'DELETE',
    });
    setCart(data);
  };

  const toggleWishlist = async (productId: number) => {
    if (!user) {
      notify(
        lang === 'hi'
          ? 'विशलिस्ट सहेजने के लिए कृपया साइन इन करें।'
          : 'Please sign in to save pieces to your wishlist.',
        'info'
      );
      return;
    }
    const res = await apiRequest<{ wishlisted: boolean }>('/api/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    setWishlistIds((prev) =>
      res.wishlisted ? Array.from(new Set([...prev, productId])) : prev.filter((id) => id !== productId)
    );
    notify(
      res.wishlisted
        ? lang === 'hi'
          ? 'विशलिस्ट में सहेजा गया।'
          : 'Saved to your wishlist.'
        : lang === 'hi'
          ? 'विशलिस्ट से हटाया गया।'
          : 'Removed from wishlist.',
      'success'
    );
  };

  return (
    <StoreContext.Provider
      value={{
        lang,
        setLang,
        t,
        user,
        authLoading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshAuth,
        cart,
        cartDrawerOpen,
        setCartDrawerOpen,
        addToCart,
        updateCartItem,
        removeCartItem,
        applyCoupon,
        removeCoupon,
        refreshCart,
        wishlistIds,
        toggleWishlist,
        bootstrap,
        bootstrapLoading,
        refreshBootstrap,
        quickViewProduct,
        setQuickViewProduct,
        notify,
        toasts,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
