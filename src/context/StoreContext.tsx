import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiRequest } from '../lib/api';
import {
  ensureUserProfile,
  fetchActiveCoupons,
  fetchStorefrontBootstrap,
  fetchUserWishlistIds,
  toggleWishlistDoc,
} from '../lib/firestoreStore';
import { DEFAULT_BOOTSTRAP, DEFAULT_PRODUCTS } from '../lib/defaultCatalog';
import { translations } from '../i18n/translations';
import type {
  Banner,
  BlogPost,
  CartItem,
  CartState,
  Category,
  CouponItem,
  Language,
  Product,
  ReelItem,
  ReviewItem,
  StoreSettings,
  User,
} from '../types';

const CART_STORAGE_KEY = 'zarifly_firebase_cart_v1';
const COUPON_STORAGE_KEY = 'zarifly_firebase_coupon_v1';
const WA_WISHLIST_STORAGE_KEY = 'zarifly_wa_wishlist_v1';

export interface WhatsAppOtpRequestResult {
  ok: boolean;
  phone: string;
  expiresInSeconds: number;
  deliveryMode: 'whatsapp_cloud_api' | 'whatsapp_direct';
  whatsappUrl: string;
  verificationCode?: string;
}

interface PersistedCartEntry {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
}

interface BootstrapData {
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  reels: ReelItem[];
  allProducts: Product[];
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
  sendPasswordReset: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<User>;
  requestWhatsAppOtp: (payload: {
    phone: string;
    fullName?: string;
    mode: 'login' | 'signup';
  }) => Promise<WhatsAppOtpRequestResult>;
  verifyWhatsAppOtp: (payload: {
    phone: string;
    code: string;
    fullName?: string;
  }) => Promise<User>;
  updateWhatsAppProfile: (payload: {
    fullName: string;
    preferredLang: Language;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  cart: CartState;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (productId: string, variantId: string, quantity?: number) => Promise<void>;
  updateCartItem: (itemId: string, payload: { quantity?: number; variantId?: string }) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refreshCart: () => Promise<void>;
  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  bootstrap: BootstrapData | null;
  bootstrapLoading: boolean;
  refreshBootstrap: () => Promise<void>;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  toasts: ToastMessage[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadPersistedCart(): PersistedCartEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePersistedCart(entries: PersistedCartEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

function formatFirebaseAuthError(err: any): Error {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return new Error('Invalid email or password. Please check your credentials and try again.');
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('An account with this email already exists. Please sign in instead.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Password should be at least 6 characters long.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      'Email/Password sign-in is not yet enabled in Firebase Console. Please enable Email/Password under Authentication → Sign-in method, or use Google Sign-In.'
    );
  }
  if (code === 'auth/popup-closed-by-user') {
    return new Error('Sign-in popup was closed before completing.');
  }
  return new Error(err?.message || 'Authentication failed.');
}

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
  const [cartEntries, setCartEntries] = useState<PersistedCartEntry[]>(loadPersistedCart);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(COUPON_STORAGE_KEY) || '';
    }
    return '';
  });
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>({
    ...DEFAULT_BOOTSTRAP,
    allProducts: DEFAULT_PRODUCTS,
  });
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
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
      const [data, activeCoupons] = await Promise.all([
        fetchStorefrontBootstrap(),
        fetchActiveCoupons(),
      ]);
      setBootstrap(data);
      setCoupons(activeCoupons);
    } catch (err) {
      console.error('Firestore bootstrap fetch error:', err);
      setBootstrap((prev) => prev || { ...DEFAULT_BOOTSTRAP, allProducts: DEFAULT_PRODUCTS });
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const loadLocalWhatsAppWishlist = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(WA_WISHLIST_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const restoreWhatsAppSession = useCallback(async (): Promise<User | null> => {
    try {
      const data = await apiRequest<{ user: User | null }>('/api/whatsapp-auth/me');
      if (data?.user) {
        setUser(data.user);
        setWishlistIds(loadLocalWhatsAppWishlist());
        return data.user;
      }
    } catch {
      // Ignore if WhatsApp session endpoint unavailable
    }
    return null;
  }, [loadLocalWhatsAppWishlist]);

  const refreshAuth = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      const waUser = await restoreWhatsAppSession();
      if (!waUser) {
        setUser(null);
        setWishlistIds([]);
      }
      setAuthLoading(false);
      return;
    }
    try {
      const profile = await ensureUserProfile(fbUser);
      setUser({ ...profile, authProvider: 'firebase' });
      const wl = await fetchUserWishlistIds(fbUser.uid).catch(() => []);
      setWishlistIds(wl);
    } catch {
      setUser(null);
      setWishlistIds([]);
    } finally {
      setAuthLoading(false);
    }
  }, [restoreWhatsAppSession]);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        const waUser = await restoreWhatsAppSession();
        if (!waUser) {
          setUser(null);
          setWishlistIds([]);
        }
        setAuthLoading(false);
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setUser({ ...profile, authProvider: 'firebase' });
        const wl = await fetchUserWishlistIds(fbUser.uid).catch(() => []);
        setWishlistIds(wl);
      } catch (err) {
        console.error('Auth profile sync error:', err);
        setUser({
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email || '',
          fullName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Customer',
          phone: '',
          role: 'customer',
          preferredLang: lang,
          authProvider: 'firebase',
        });
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [lang, restoreWhatsAppSession]);

  // Compute live cart state from persisted entries + live Firestore products/settings/coupons
  const cart: CartState = useMemo(() => {
    const products = bootstrap?.allProducts || DEFAULT_PRODUCTS;
    const settings = bootstrap?.settings || DEFAULT_BOOTSTRAP.settings;
    const freeThreshold = Number(settings.freeShippingThreshold ?? 1999);
    const flatShipping = Number(settings.flatShippingFee ?? 120);
    const taxRate = Number(settings.taxRatePercent ?? 5);

    const items: CartItem[] = [];
    for (const entry of cartEntries) {
      const product = products.find((p) => p.id === entry.productId);
      if (!product) continue;
      const variant =
        product.variants.find((v) => v.id === entry.variantId) || product.variants[0];
      if (!variant) continue;

      const unitPrice = variant.priceOverride != null ? variant.priceOverride : product.sellingPrice;
      const qty = Math.max(1, Math.min(entry.quantity, Math.max(1, variant.stockQuantity || 10)));
      const matchedImg =
        variant.imageUrl ||
        product.images.find((im) => im.colorName === variant.colorName)?.url ||
        product.images[0]?.url ||
        '';

      items.push({
        id: entry.id,
        quantity: qty,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productNameHi: product.nameHi,
        unitPrice,
        originalPrice: product.originalPrice,
        lineTotal: unitPrice * qty,
        variantId: variant.id || entry.variantId,
        sku: variant.sku || product.sku,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        sizeName: variant.sizeName,
        stockQuantity: variant.stockQuantity,
        imageUrl: matchedImg,
        availableVariants: product.variants,
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    let discountAmount = 0;
    let appliedCoupon: { code: string; description: string } | null = null;
    if (appliedCouponCode && subtotal > 0) {
      const found = coupons.find(
        (c) => c.isActive && c.code.toUpperCase() === appliedCouponCode.toUpperCase()
      );
      if (found && subtotal >= found.minOrderAmount) {
        if (found.discountType === 'percent') {
          discountAmount = Math.round((subtotal * found.discountValue) / 100);
          if (found.maxDiscount && discountAmount > found.maxDiscount) {
            discountAmount = found.maxDiscount;
          }
        } else {
          discountAmount = Math.min(subtotal, found.discountValue);
        }
        appliedCoupon = { code: found.code, description: found.description };
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const shippingFee = afterDiscount === 0 || afterDiscount >= freeThreshold ? 0 : flatShipping;
    const taxAmount = Math.round((afterDiscount * taxRate) / (100 + taxRate));
    const grandTotal = afterDiscount + shippingFee;

    return {
      cartId: user?.uid || 'local-cart',
      items,
      itemCount,
      subtotal,
      discountAmount,
      appliedCoupon,
      shippingFee,
      freeShippingThreshold: freeThreshold,
      taxIncludedNote: `Inclusive of ${taxRate}% GST`,
      taxAmount,
      grandTotal,
    };
  }, [bootstrap, cartEntries, appliedCouponCode, coupons, user?.uid]);

  const refreshCart = useCallback(async () => {
    setCartEntries(loadPersistedCart());
    const freshCoupons = await fetchActiveCoupons().catch(() => []);
    if (freshCoupons.length) setCoupons(freshCoupons);
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await ensureUserProfile(cred.user);
      setUser(profile);
      const wl = await fetchUserWishlistIds(cred.user.uid).catch(() => []);
      setWishlistIds(wl);
      return profile;
    } catch (err) {
      throw formatFirebaseAuthError(err);
    }
  };

  const registerWithEmail = async (payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        payload.email.trim(),
        payload.password
      );
      if (payload.fullName.trim()) {
        await updateProfile(cred.user, { displayName: payload.fullName.trim() }).catch(() => {});
      }
      const profile = await ensureUserProfile(cred.user, {
        fullName: payload.fullName.trim(),
        phone: payload.phone || '',
        preferredLang: lang,
      });
      setUser(profile);
      setWishlistIds([]);
      return profile;
    } catch (err) {
      throw formatFirebaseAuthError(err);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw formatFirebaseAuthError(err);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const profile = await ensureUserProfile(cred.user);
      setUser(profile);
      const wl = await fetchUserWishlistIds(cred.user.uid).catch(() => []);
      setWishlistIds(wl);
      return profile;
    } catch (err) {
      throw formatFirebaseAuthError(err);
    }
  };

  const requestWhatsAppOtp = async (payload: {
    phone: string;
    fullName?: string;
    mode: 'login' | 'signup';
  }) => {
    return apiRequest<WhatsAppOtpRequestResult>('/api/whatsapp-auth/request-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  };

  const verifyWhatsAppOtp = async (payload: {
    phone: string;
    code: string;
    fullName?: string;
  }) => {
    const data = await apiRequest<{ ok: boolean; user: User }>('/api/whatsapp-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!data?.user) throw new Error('WhatsApp verification failed.');
    setUser(data.user);
    setWishlistIds(loadLocalWhatsAppWishlist());
    return data.user;
  };

  const updateWhatsAppProfile = async (payload: {
    fullName: string;
    preferredLang: Language;
  }) => {
    const data = await apiRequest<{ ok: boolean; user: User }>('/api/whatsapp-auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (data?.user) setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/admin-security/lock', { method: 'POST' }).catch(() => {});
      await apiRequest('/api/whatsapp-auth/logout', { method: 'POST' }).catch(() => {});
      await firebaseSignOut(auth).catch(() => {});
    } finally {
      setUser(null);
      setWishlistIds([]);
      notify(lang === 'hi' ? 'आप सफलतापूर्वक लॉग आउट हो गए।' : 'Signed out successfully.', 'info');
    }
  };

  const addToCart = async (productId: string, variantId: string, quantity = 1) => {
    setCartEntries((prev) => {
      const existing = prev.find((e) => e.productId === productId && e.variantId === variantId);
      const next = existing
        ? prev.map((e) =>
            e.id === existing.id ? { ...e, quantity: e.quantity + Math.max(1, quantity) } : e
          )
        : [
            ...prev,
            {
              id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              productId,
              variantId,
              quantity: Math.max(1, quantity),
            },
          ];
      savePersistedCart(next);
      return next;
    });
    setCartDrawerOpen(true);
    notify(lang === 'hi' ? 'आपके बैग में जोड़ा गया।' : 'Added to your shopping bag.', 'success');
  };

  const updateCartItem = async (
    itemId: string,
    payload: { quantity?: number; variantId?: string }
  ) => {
    setCartEntries((prev) => {
      const next = prev
        .map((e) => {
          if (e.id !== itemId) return e;
          const nextQty = payload.quantity != null ? payload.quantity : e.quantity;
          if (nextQty <= 0) return null;
          return {
            ...e,
            quantity: nextQty,
            variantId: payload.variantId || e.variantId,
          };
        })
        .filter(Boolean) as PersistedCartEntry[];
      savePersistedCart(next);
      return next;
    });
  };

  const removeCartItem = async (itemId: string) => {
    setCartEntries((prev) => {
      const next = prev.filter((e) => e.id !== itemId);
      savePersistedCart(next);
      return next;
    });
  };

  const clearCart = useCallback(() => {
    setCartEntries([]);
    savePersistedCart([]);
    setAppliedCouponCode('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  }, []);

  const applyCoupon = async (code: string) => {
    const clean = code.trim().toUpperCase();
    const list = coupons.length ? coupons : await fetchActiveCoupons();
    const found = list.find((c) => c.isActive && c.code.toUpperCase() === clean);
    if (!found) {
      throw new Error('Invalid or expired coupon code.');
    }
    if (cart.subtotal < found.minOrderAmount) {
      throw new Error(`Minimum order of ₹${found.minOrderAmount} required for ${found.code}.`);
    }
    setCoupons(list);
    setAppliedCouponCode(found.code);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COUPON_STORAGE_KEY, found.code);
    }
    notify(lang === 'hi' ? 'कूपन लागू हो गया।' : 'Coupon applied successfully.', 'success');
  };

  const removeCoupon = async () => {
    setAppliedCouponCode('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      notify(
        lang === 'hi'
          ? 'विशलिस्ट सहेजने के लिए कृपया WhatsApp या Google से साइन इन करें।'
          : 'Please sign in with WhatsApp or Google to save pieces to your wishlist.',
        'info'
      );
      return;
    }

    if (user.authProvider === 'whatsapp' || !auth.currentUser) {
      const exists = wishlistIds.includes(productId);
      const next = exists
        ? wishlistIds.filter((id) => id !== productId)
        : Array.from(new Set([...wishlistIds, productId]));
      setWishlistIds(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WA_WISHLIST_STORAGE_KEY, JSON.stringify(next));
      }
      notify(
        !exists
          ? lang === 'hi'
            ? 'विशलिस्ट में सहेजा गया।'
            : 'Saved to your wishlist.'
          : lang === 'hi'
            ? 'विशलिस्ट से हटाया गया।'
            : 'Removed from wishlist.',
        'success'
      );
      return;
    }

    const wishlisted = await toggleWishlistDoc(user.uid, productId);
    setWishlistIds((prev) =>
      wishlisted ? Array.from(new Set([...prev, productId])) : prev.filter((id) => id !== productId)
    );
    notify(
      wishlisted
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
        sendPasswordReset,
        loginWithGoogle,
        requestWhatsAppOtp,
        verifyWhatsAppOtp,
        updateWhatsAppProfile,
        logout,
        refreshAuth,
        cart,
        cartDrawerOpen,
        setCartDrawerOpen,
        addToCart,
        updateCartItem,
        removeCartItem,
        clearCart,
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
