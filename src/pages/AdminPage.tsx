import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CloudUpload,
  Database,
  Edit3,
  FileText,
  Film,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { uploadMediaFile, type MediaFolder } from '../lib/mediaStorage';
import {
  adminCreateCoupon,
  adminDeleteBanner,
  adminDeleteBlog,
  adminDeleteCoupon,
  adminDeleteProduct,
  adminDeleteReel,
  adminDeleteReview,
  adminFetchActivityLogs,
  adminFetchBanners,
  adminFetchBlogs,
  adminFetchCustomers,
  adminFetchDashboard,
  adminFetchMarketingData,
  adminFetchOrders,
  adminFetchReels,
  adminFetchReviews,
  adminSaveBanner,
  adminSaveBlog,
  adminSaveProduct,
  adminSaveReel,
  adminSaveReview,
  adminSaveSettings,
  adminUpdateOrder,
  fetchAllProductsEnriched,
  fetchStoreSettings,
  seedStarterCatalogIfEmpty,
  slugify,
} from '../lib/firestoreStore';
import { FiveImageUploader } from '../components/FiveImageUploader';
import { ZariflyLogo } from '../components/ZariflyLogo';
import type {
  Banner,
  BlogPost,
  Category,
  CouponItem,
  Order,
  Product,
  ProductImage,
  ProductVariant,
  ReelItem,
  ReviewItem,
  StoreSettings,
} from '../types';

type AdminTab =
  | 'overview'
  | 'products'
  | 'orders'
  | 'banners'
  | 'reviews'
  | 'blogs'
  | 'reels'
  | 'customers'
  | 'marketing'
  | 'settings';

function SingleMediaUploadField({
  label,
  value,
  onChange,
  folder,
  accept = 'image/jpeg,image/png,image/webp,image/avif',
  placeholder = 'https://...',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: MediaFolder;
  accept?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setProgress(1);
    try {
      const res = await uploadMediaFile(file, folder, (pct) => setProgress(pct));
      onChange(res.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. You can also paste an image URL.');
    } finally {
      setTimeout(() => setProgress(null), 600);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-[#5E5474]">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
        />
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3EEFF] text-[#7C3AED] border border-[#E2D9F3] text-xs font-bold hover:bg-[#7C3AED] hover:text-white transition-colors shrink-0 cursor-pointer"
        >
          <CloudUpload className="w-3.5 h-3.5" />
          <span>{progress !== null ? `${progress}%` : 'Upload'}</span>
        </button>
      </div>
      {progress !== null && (
        <div className="w-full h-1.5 rounded-full bg-[#F3EEFF] overflow-hidden">
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] transition-all"
          />
        </div>
      )}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      {value && !accept.includes('video') && (
        <img
          src={value}
          alt={label}
          referrerPolicy="no-referrer"
          className="h-14 w-24 object-cover rounded-lg border border-[#E2D9F3]"
        />
      )}
    </div>
  );
}

export function AdminPage() {
  const { user, authLoading, loginWithEmail, loginWithGoogle, logout, refreshBootstrap, notify } =
    useStore();

  // Step 1: Firebase Admin Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Step 2: Server-Verified 4-Digit Admin Entry PIN state
  const [pinCheckLoading, setPinCheckLoading] = useState(false);
  const [serverAdminVerified, setServerAdminVerified] = useState<boolean | null>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [lockedSeconds, setLockedSeconds] = useState<number>(0);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Step 3: Admin Dashboard State
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loadingTab, setLoadingTab] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [dashboard, setDashboard] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [logs, setLogs] = useState<any[]>([]);

  // Product Editor state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productUploading, setProductUploading] = useState(false);
  const [prodForm, setProdForm] = useState({
    categoryId: 'cat_hijabs',
    name: '',
    nameHi: '',
    slug: '',
    sku: '',
    description: '',
    descriptionHi: '',
    fabric: '',
    workDetails: '',
    sellingPrice: 1490,
    originalPrice: 1890,
    isActive: true,
    isBestSeller: false,
    isNewArrival: true,
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
    images: [] as ProductImage[],
    variants: [
      {
        id: 'tmp_1',
        sku: '',
        colorName: 'Warm Ivory',
        colorHex: '#F3ECE1',
        sizeName: 'Standard',
        priceOverride: null as number | null,
        stockQuantity: 10,
        imageUrl: '',
        isActive: true,
      },
    ] as ProductVariant[],
  });

  // Banner Editor state
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm, setBannerForm] = useState({
    heading: '',
    headingHi: '',
    subheading: '',
    subheadingHi: '',
    ctaText: 'Shop Collection',
    ctaTextHi: 'कलेक्शन देखें',
    ctaUrl: '/shop',
    desktopImageUrl: '',
    mobileImageUrl: '',
    sortOrder: 1,
    isActive: true,
  });

  // Review Editor state
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [reviewForm, setReviewForm] = useState({
    productId: '',
    customerName: '',
    customerEmail: '',
    rating: 5,
    title: '',
    comment: '',
    isVerifiedPurchase: true,
    status: 'approved' as 'pending' | 'approved' | 'rejected',
  });

  // Blog Editor state
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({
    slug: '',
    title: '',
    titleHi: '',
    excerpt: '',
    excerptHi: '',
    content: '',
    contentHi: '',
    featuredImageUrl: '',
    authorName: 'Sama Shaikh',
    category: 'Hijab Guide',
    seoTitle: '',
    seoDescription: '',
    isPublished: true,
    publishedAt: new Date().toISOString(),
  });

  // Reel Editor state
  const [editingReel, setEditingReel] = useState<ReelItem | null>(null);
  const [reelForm, setReelForm] = useState({
    title: '',
    caption: '',
    videoUrl: '',
    thumbnailUrl: '',
    productId: '',
    sortOrder: 1,
    isActive: true,
  });

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percent' as 'percent' | 'fixed',
    discountValue: 10,
    minOrderAmount: 1500,
    maxDiscount: 500,
    usageLimit: 500,
    isActive: true,
  });

  // Check server-side Firebase Admin status & PIN unlock cookie
  const checkAdminSecurityStatus = useCallback(async () => {
    if (!user) {
      setServerAdminVerified(null);
      setPinUnlocked(false);
      return;
    }
    try {
      setPinCheckLoading(true);
      const status = await apiRequest<{
        isAdmin: boolean;
        pinUnlocked: boolean;
        locked: boolean;
        retryAfterSeconds: number;
        attemptsRemaining: number;
      }>('/api/admin-security/status');

      setServerAdminVerified(Boolean(status.isAdmin));
      setPinUnlocked(Boolean(status.pinUnlocked));
      setAttemptsRemaining(status.attemptsRemaining ?? 5);
      setLockedSeconds(status.locked ? status.retryAfterSeconds : 0);
    } catch (err: any) {
      if (err?.status === 403 || err?.code === 'NOT_ADMIN') {
        setServerAdminVerified(false);
      } else {
        setServerAdminVerified(false);
      }
      setPinUnlocked(false);
    } finally {
      setPinCheckLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      void checkAdminSecurityStatus();
    } else if (!user) {
      setServerAdminVerified(null);
      setPinUnlocked(false);
    }
  }, [authLoading, user, checkAdminSecurityStatus]);

  // Countdown timer when PIN entry is temporarily locked
  useEffect(() => {
    if (lockedSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockedSeconds((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedSeconds]);

  const loadTabData = useCallback(
    async (targetTab: AdminTab) => {
      if (!pinUnlocked || !serverAdminVerified) return;
      try {
        setLoadingTab(true);
        if (targetTab === 'overview') {
          const dash = await adminFetchDashboard();
          setDashboard(dash);
        } else if (targetTab === 'products') {
          const res = await fetchAllProductsEnriched({
            includeInactive: true,
            includeAllReviews: true,
          });
          setCategories(res.categories);
          setProducts(res.products);
        } else if (targetTab === 'orders') {
          const list = await adminFetchOrders(orderFilter);
          setOrders(list);
        } else if (targetTab === 'banners') {
          setBanners(await adminFetchBanners());
        } else if (targetTab === 'reviews') {
          const [revs, enriched] = await Promise.all([
            adminFetchReviews(),
            fetchAllProductsEnriched({ includeInactive: true, includeAllReviews: false }),
          ]);
          setReviews(revs);
          setProducts(enriched.products);
        } else if (targetTab === 'blogs') {
          setBlogs(await adminFetchBlogs());
        } else if (targetTab === 'reels') {
          const [rList, enriched] = await Promise.all([
            adminFetchReels(),
            fetchAllProductsEnriched({ includeInactive: true, includeAllReviews: false }),
          ]);
          setReels(rList);
          setProducts(enriched.products);
        } else if (targetTab === 'customers') {
          setCustomers(await adminFetchCustomers());
        } else if (targetTab === 'marketing') {
          const m = await adminFetchMarketingData();
          setCoupons(m.coupons);
          setSubscribers(m.subscribers);
          setMessages(m.messages);
        } else if (targetTab === 'settings') {
          const [s, l] = await Promise.all([fetchStoreSettings(), adminFetchActivityLogs()]);
          setSettings(s);
          setLogs(l);
        }
      } catch (err: any) {
        notify(err?.message || 'Unable to load Firestore admin data.', 'error');
      } finally {
        setLoadingTab(false);
      }
    },
    [pinUnlocked, serverAdminVerified, orderFilter, notify]
  );

  // Auto-seed starter catalog to Firestore once when an admin unlocks an empty project
  useEffect(() => {
    if (!pinUnlocked || !serverAdminVerified) return;
    let active = true;
    seedStarterCatalogIfEmpty(false)
      .then((res) => {
        if (active && res.seeded) {
          notify('Starter ZARIFLY catalog initialized in Cloud Firestore!', 'success');
          void refreshBootstrap();
        }
        if (active) void loadTabData(tab);
      })
      .catch(() => {
        if (active) void loadTabData(tab);
      });
    return () => {
      active = false;
    };
  }, [pinUnlocked, serverAdminVerified]);

  useEffect(() => {
    if (pinUnlocked && serverAdminVerified) {
      void loadTabData(tab);
    }
  }, [tab, orderFilter, pinUnlocked, serverAdminVerified, loadTabData]);

  // PIN Input Handlers
  const handlePinChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError('');
    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      e.preventDefault();
      setPinDigits(pasted.split(''));
      pinInputRefs.current[3]?.focus();
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinDigits.join('');
    if (!/^\d{4}$/.test(pin)) {
      setPinError('Please enter all 4 digits of your Admin Entry PIN.');
      return;
    }
    try {
      setPinSubmitting(true);
      setPinError('');
      await apiRequest('/api/admin-security/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      setPinDigits(['', '', '', '']);
      setPinUnlocked(true);
      notify('Admin Panel unlocked.', 'success');
    } catch (err: any) {
      setPinDigits(['', '', '', '']);
      pinInputRefs.current[0]?.focus();
      setPinError(err?.message || 'PIN verification failed.');
      if (typeof err?.attemptsRemaining === 'number') {
        setAttemptsRemaining(err.attemptsRemaining);
      }
      if (err?.locked && err?.retryAfterSeconds) {
        setLockedSeconds(err.retryAfterSeconds);
      }
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleLockPin = async () => {
    await apiRequest('/api/admin-security/lock', { method: 'POST' }).catch(() => {});
    setPinUnlocked(false);
    setPinDigits(['', '', '', '']);
    notify('Admin Panel locked.', 'info');
  };

  const handleForceSeed = async () => {
    try {
      setSeeding(true);
      await seedStarterCatalogIfEmpty(true);
      await refreshBootstrap();
      await loadTabData(tab);
      notify('Starter catalog synced to Cloud Firestore.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Failed to sync starter catalog.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // =========================================================================
  // GATE 1: Firebase Authentication (Sign In)
  // =========================================================================
  if (authLoading || pinCheckLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFF] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E2D9F3] border-t-[#7C3AED] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#64597A] uppercase tracking-wider">
            Verifying Firebase Admin Session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-[32px] border border-[#E9DDFC] p-8 sm:p-10 space-y-6 shadow-[0_24px_60px_rgba(124,58,237,0.14)]">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <ZariflyLogo size="lg" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[11px] font-extrabold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              Step 1 of 2 · Firebase Admin Identity
            </div>
            <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
              ZARIFLY Admin Login
            </h1>
            <p className="text-xs text-[#64597A]">
              Authenticate with your authorized ZARIFLY Firebase Admin account before entering the
              4-digit security PIN.
            </p>
          </div>

          <button
            type="button"
            disabled={authSubmitting}
            onClick={async () => {
              try {
                setAuthSubmitting(true);
                await loginWithGoogle();
              } catch (err: any) {
                notify(err?.message || 'Google Sign-In failed.', 'error');
              } finally {
                setAuthSubmitting(false);
              }
            }}
            className="w-full py-3.5 px-4 rounded-full border-2 border-[#181326] bg-white text-[#181326] text-xs font-extrabold uppercase tracking-wider hover:bg-[#F3EEFF] hover:border-[#7C3AED] transition-colors cursor-pointer"
          >
            Sign in with Google (Admin)
          </button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-[#EDE8F7]" />
            <span className="shrink mx-3 text-[11px] text-[#8B7FA6] uppercase font-bold">
              or email
            </span>
            <div className="flex-grow border-t border-[#EDE8F7]" />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setAuthSubmitting(true);
                await loginWithEmail(loginEmail, loginPassword);
              } catch (err: any) {
                notify(err?.message || 'Admin login failed.', 'error');
              } finally {
                setAuthSubmitting(false);
              }
            }}
            className="space-y-4"
          >
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Admin email"
              className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
            />
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
            />
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-lg cursor-pointer"
            >
              {authSubmitting ? 'Verifying...' : 'Continue to PIN Verification'}
            </button>
          </form>

          <div className="text-center pt-1">
            <Link to="/" className="text-xs font-bold text-[#64597A] hover:text-[#FF4D8D]">
              ← Return to ZARIFLY Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // GATE 1B: Logged-in Customer Denied Admin Access
  // =========================================================================
  if (serverAdminVerified === false) {
    return (
      <div className="min-h-screen bg-[#FAFAFF] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-[32px] border border-rose-200 p-8 text-center space-y-4 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-rose-50 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-rose-600" />
          </div>
          <h1 className="font-serif-display text-2xl font-extrabold text-[#181326]">
            Admin Access Restricted
          </h1>
          <p className="text-xs text-[#5E5474] leading-relaxed">
            Signed in as <strong>{user.email}</strong>. This account does not have ZARIFLY Admin
            privileges verified by Firebase Admin SDK.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-full border border-[#E2D9F3] text-xs font-bold text-[#181326]"
            >
              Storefront
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-5 py-2.5 rounded-full bg-[#181326] text-white text-xs font-bold cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // GATE 2: Server-Verified 4-Digit Admin Entry PIN Screen
  // =========================================================================
  if (!pinUnlocked) {
    const mins = Math.floor(lockedSeconds / 60);
    const secs = lockedSeconds % 60;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#181326] via-[#2E1065] to-[#831843] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 sm:p-10 space-y-6 shadow-2xl">
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF4D8D] to-[#7C3AED] text-white mx-auto flex items-center justify-center shadow-lg">
              <KeyRound className="w-7 h-7" />
            </div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#7C3AED]">
              Step 2 of 2 · Admin Security PIN
            </p>
            <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
              Enter 4-Digit PIN
            </h1>
            <p className="text-xs text-[#64597A]">
              Verified Firebase Admin: <strong className="text-[#181326]">{user.email}</strong>
            </p>
          </div>

          {lockedSeconds > 0 ? (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-center space-y-2">
              <Lock className="w-6 h-6 text-rose-600 mx-auto" />
              <p className="text-sm font-extrabold text-rose-700">Temporarily Locked</p>
              <p className="text-xs text-rose-600">
                Too many incorrect PIN attempts. Try again in{' '}
                <strong className="tabular-nums">
                  {mins}:{String(secs).padStart(2, '0')}
                </strong>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerifyPin} className="space-y-5">
              <div className="flex items-center justify-center gap-3">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      pinInputRefs.current[idx] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    autoFocus={idx === 0}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePinPaste : undefined}
                    aria-label={`PIN digit ${idx + 1}`}
                    className="w-14 h-16 rounded-2xl text-center text-2xl font-extrabold bg-[#FAFAFF] border-2 border-[#E2D9F3] focus:border-[#7C3AED] focus:bg-white outline-none transition-all tabular-nums"
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-xs text-center font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  {pinError}
                </p>
              )}

              <p className="text-[11px] text-center text-[#7E7394]">
                Server-verified with rate limiting · {attemptsRemaining} attempt(s) remaining
              </p>

              <button
                type="submit"
                disabled={pinSubmitting || pinDigits.some((d) => !d)}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 disabled:opacity-45 shadow-lg transition-all cursor-pointer"
              >
                {pinSubmitting ? 'Verifying PIN...' : 'Unlock ZARIFLY Admin'}
              </button>
            </form>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#EDE8F7] text-xs">
            <Link to="/" className="font-bold text-[#64597A] hover:text-[#181326]">
              ← Storefront
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="font-bold text-rose-600 hover:underline cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // GATE 3: Full Cloud Firestore + Firebase Storage Admin Dashboard
  // =========================================================================

  const openNewProductForm = () => {
    setEditingProduct(null);
    setProdForm({
      categoryId: categories[0]?.id || 'cat_hijabs',
      name: '',
      nameHi: '',
      slug: '',
      sku: `ZRF-${Date.now().toString().slice(-4)}`,
      description: '',
      descriptionHi: '',
      fabric: 'Pure Matte Silk-Chiffon',
      workDetails: 'Handcrafted Zari & Zardozi Border',
      sellingPrice: 1490,
      originalPrice: 1890,
      isActive: true,
      isBestSeller: false,
      isNewArrival: true,
      isFeatured: false,
      seoTitle: '',
      seoDescription: '',
      images: [],
      variants: [
        {
          id: 'tmp_1',
          sku: `ZRF-${Date.now().toString().slice(-4)}-IVR`,
          colorName: 'Warm Ivory',
          colorHex: '#F3ECE1',
          sizeName: 'Standard',
          priceOverride: null,
          stockQuantity: 10,
          imageUrl: '',
          isActive: true,
        },
      ],
    });
    setShowProductForm(true);
  };

  const openEditProductForm = (p: Product) => {
    setEditingProduct(p);
    setProdForm({
      categoryId: p.categoryId,
      name: p.name,
      nameHi: p.nameHi || '',
      slug: p.slug,
      sku: p.sku,
      description: p.description,
      descriptionHi: p.descriptionHi || '',
      fabric: p.fabric,
      workDetails: p.workDetails,
      sellingPrice: p.sellingPrice,
      originalPrice: p.originalPrice,
      isActive: p.isActive,
      isBestSeller: p.isBestSeller,
      isNewArrival: p.isNewArrival,
      isFeatured: p.isFeatured,
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      images: p.images || [],
      variants:
        p.variants && p.variants.length > 0
          ? p.variants
          : [
              {
                id: 'tmp_1',
                sku: `${p.sku}-STD`,
                colorName: 'Warm Ivory',
                colorHex: '#F3ECE1',
                sizeName: 'Standard',
                priceOverride: null,
                stockQuantity: 10,
                imageUrl: '',
                isActive: true,
              },
            ],
    });
    setShowProductForm(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productUploading) {
      notify('Please wait for image uploads to finish.', 'info');
      return;
    }
    try {
      const cat = categories.find((c) => c.id === prodForm.categoryId);
      await adminSaveProduct(editingProduct?.id || null, {
        ...prodForm,
        categorySlug: cat?.slug || 'hijabs',
      });
      notify(editingProduct ? 'Product updated in Firestore.' : 'Product created in Firestore.', 'success');
      setShowProductForm(false);
      await loadTabData('products');
      void refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save product.', 'error');
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminSaveBanner(editingBanner?.id || null, bannerForm);
      notify(editingBanner ? 'Banner updated.' : 'Banner added.', 'success');
      setEditingBanner(null);
      setBannerForm({
        heading: '',
        headingHi: '',
        subheading: '',
        subheadingHi: '',
        ctaText: 'Shop Collection',
        ctaTextHi: 'कलेक्शन देखें',
        ctaUrl: '/shop',
        desktopImageUrl: '',
        mobileImageUrl: '',
        sortOrder: banners.length + 1,
        isActive: true,
      });
      await loadTabData('banners');
      void refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save banner.', 'error');
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = products.find((p) => p.id === reviewForm.productId);
      await adminSaveReview(editingReview?.id || null, {
        ...reviewForm,
        productName: prod?.name || editingReview?.productName || '',
        productSlug: prod?.slug || editingReview?.productSlug || '',
      });
      notify(editingReview ? 'Review updated.' : 'Review created.', 'success');
      setEditingReview(null);
      setReviewForm({
        productId: products[0]?.id || '',
        customerName: '',
        customerEmail: '',
        rating: 5,
        title: '',
        comment: '',
        isVerifiedPurchase: true,
        status: 'approved',
      });
      await loadTabData('reviews');
      void refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save review.', 'error');
    }
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminSaveBlog(editingBlog?.id || null, {
        ...blogForm,
        slug: blogForm.slug.trim() || slugify(blogForm.title),
      });
      notify(editingBlog ? 'Blog post updated.' : 'Blog post published to Firestore.', 'success');
      setEditingBlog(null);
      setBlogForm({
        slug: '',
        title: '',
        titleHi: '',
        excerpt: '',
        excerptHi: '',
        content: '',
        contentHi: '',
        featuredImageUrl: '',
        authorName: 'Sama Shaikh',
        category: 'Hijab Guide',
        seoTitle: '',
        seoDescription: '',
        isPublished: true,
        publishedAt: new Date().toISOString(),
      });
      await loadTabData('blogs');
      void refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save blog post.', 'error');
    }
  };

  const handleSaveReel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminSaveReel(editingReel?.id || null, {
        ...reelForm,
        productId: reelForm.productId || null,
      });
      notify(editingReel ? 'Reel updated.' : 'Reel added.', 'success');
      setEditingReel(null);
      setReelForm({
        title: '',
        caption: '',
        videoUrl: '',
        thumbnailUrl: '',
        productId: '',
        sortOrder: reels.length + 1,
        isActive: true,
      });
      await loadTabData('reels');
      void refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save reel.', 'error');
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'banners', label: 'Banners', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
    { id: 'blogs', label: 'Blogs CMS', icon: <FileText className="w-4 h-4" /> },
    { id: 'reels', label: 'Reels', icon: <Film className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'marketing', label: 'Marketing', icon: <Tag className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]';

  return (
    <div className="min-h-screen bg-[#FAFAFF] text-[#181326]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EDE8F7] px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ZariflyLogo size="sm" />
          </Link>
          <span className="px-2.5 py-1 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[10px] font-extrabold uppercase tracking-wider">
            Firebase Admin
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={seeding}
            onClick={handleForceSeed}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#ECFEFF] text-[#0E7490] border border-[#06B6D4]/40 text-xs font-bold hover:bg-[#06B6D4] hover:text-white transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{seeding ? 'Syncing...' : 'Sync Starter Catalog'}</span>
          </button>
          <button
            type="button"
            onClick={handleLockPin}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FFF0F6] text-[#FF4D8D] border border-[#FF4D8D]/30 text-xs font-bold hover:bg-[#FF4D8D] hover:text-white transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock PIN</span>
          </button>
          <Link
            to="/"
            className="px-3.5 py-2 rounded-full border border-[#E2D9F3] text-xs font-bold text-[#5E5474] hover:border-[#7C3AED]"
          >
            View Store
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#181326] text-white text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-2">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-md'
                    : 'bg-white text-[#5E5474] border border-[#EDE8F7] hover:border-[#7C3AED]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-10 space-y-6">
          {loadingTab && (
            <div className="flex items-center gap-2 text-xs text-[#7C3AED] font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing with Cloud Firestore...</span>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {tab === 'overview' && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', val: formatINR(dashboard.totalRevenue), icon: <BarChart3 className="w-4 h-4 text-[#FF4D8D]" /> },
                  { label: 'Total Orders', val: String(dashboard.totalOrders), icon: <ShoppingCart className="w-4 h-4 text-[#7C3AED]" /> },
                  { label: 'Products', val: String(dashboard.totalProducts), icon: <Package className="w-4 h-4 text-[#06B6D4]" /> },
                  { label: 'Customers', val: String(dashboard.totalCustomers), icon: <Users className="w-4 h-4 text-[#10B981]" /> },
                ].map((k) => (
                  <div key={k.label} className="bg-white rounded-2xl border border-[#EDE8F7] p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#64597A] font-semibold">
                      <span>{k.label}</span>
                      {k.icon}
                    </div>
                    <p className="text-2xl font-extrabold tabular-nums">{k.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64597A]">Pending Reviews</span>
                  <span className="text-lg font-extrabold text-[#FF4D8D]">{dashboard.pendingReviewsCount}</span>
                </div>
                <div className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64597A]">Newsletter Subscribers</span>
                  <span className="text-lg font-extrabold text-[#7C3AED]">{dashboard.newsletterCount}</span>
                </div>
                <div className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64597A]">Contact Inquiries</span>
                  <span className="text-lg font-extrabold text-[#06B6D4]">{dashboard.contactMessagesCount}</span>
                </div>
              </div>

              {dashboard.lowStockVariants?.length > 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                    Low Stock Variants ({dashboard.lowStockVariants.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {dashboard.lowStockVariants.map((v: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-xl px-3 py-2 border border-amber-200 flex justify-between">
                        <span className="truncate font-semibold">{v.productName} ({v.colorName})</span>
                        <span className="font-extrabold text-amber-700">{v.stockQuantity} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-[#EDE8F7] p-5 space-y-3">
                <h3 className="font-serif-display text-xl font-extrabold">Recent Orders</h3>
                {dashboard.recentOrders?.length === 0 ? (
                  <p className="text-xs text-[#64597A]">No orders placed yet.</p>
                ) : (
                  <div className="divide-y divide-[#EDE8F7] text-xs">
                    {dashboard.recentOrders?.map((o: any) => (
                      <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">#{o.orderNumber} · {o.customerName}</p>
                          <p className="text-[#64597A] capitalize">{o.orderStatus} · {o.paymentMethod}</p>
                        </div>
                        <span className="font-extrabold tabular-nums">{formatINR(o.grandTotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRODUCTS TAB */}
          {tab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-display text-2xl font-extrabold">
                  Products &amp; Inventory ({products.length})
                </h2>
                <button
                  type="button"
                  onClick={openNewProductForm}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              {showProductForm && (
                <form
                  onSubmit={handleSaveProduct}
                  className="bg-white rounded-3xl border border-[#E2D9F3] p-6 space-y-5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-[#EDE8F7] pb-3">
                    <h3 className="font-serif-display text-xl font-extrabold">
                      {editingProduct ? `Edit: ${editingProduct.name}` : 'Create New Product'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="text-xs font-bold text-[#64597A] hover:text-rose-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Category</label>
                      <select
                        value={prodForm.categoryId}
                        onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                        className={inputCls}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Product Name (EN) *</label>
                      <input
                        type="text"
                        required
                        value={prodForm.name}
                        onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Product Name (HI)</label>
                      <input
                        type="text"
                        value={prodForm.nameHi}
                        onChange={(e) => setProdForm({ ...prodForm, nameHi: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">SKU *</label>
                      <input
                        type="text"
                        required
                        value={prodForm.sku}
                        onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Selling Price (₹) *</label>
                      <input
                        type="number"
                        required
                        value={prodForm.sellingPrice}
                        onChange={(e) =>
                          setProdForm({ ...prodForm, sellingPrice: Number(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Original MRP (₹) *</label>
                      <input
                        type="number"
                        required
                        value={prodForm.originalPrice}
                        onChange={(e) =>
                          setProdForm({ ...prodForm, originalPrice: Number(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Fabric</label>
                      <input
                        type="text"
                        value={prodForm.fabric}
                        onChange={(e) => setProdForm({ ...prodForm, fabric: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Embroidery / Work Details</label>
                      <input
                        type="text"
                        value={prodForm.workDetails}
                        onChange={(e) => setProdForm({ ...prodForm, workDetails: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-[#5E5474] mb-1">Description (EN) *</label>
                      <textarea
                        rows={3}
                        required
                        value={prodForm.description}
                        onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-bold">
                    {[
                      ['isActive', 'Active'],
                      ['isBestSeller', 'Best Seller'],
                      ['isNewArrival', 'New Arrival'],
                      ['isFeatured', 'Featured'],
                    ].map(([key, lbl]) => (
                      <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(prodForm as any)[key]}
                          onChange={(e) =>
                            setProdForm({ ...prodForm, [key]: e.target.checked })
                          }
                        />
                        <span>{lbl}</span>
                      </label>
                    ))}
                  </div>

                  <FiveImageUploader
                    images={prodForm.images}
                    onChange={(imgs) => setProdForm({ ...prodForm, images: imgs })}
                    availableColors={Array.from(
                      new Set(prodForm.variants.map((v) => v.colorName).filter(Boolean))
                    )}
                    onUploadingChange={setProductUploading}
                  />

                  {/* Variants & Stock */}
                  <div className="space-y-3 border-t border-[#EDE8F7] pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider">
                        Colour &amp; Size Variants (Synced to Inventory)
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setProdForm({
                            ...prodForm,
                            variants: [
                              ...prodForm.variants,
                              {
                                id: `tmp_${Date.now()}`,
                                sku: `${prodForm.sku}-V${prodForm.variants.length + 1}`,
                                colorName: 'Ivory',
                                colorHex: '#F3ECE1',
                                sizeName: 'Standard',
                                priceOverride: null,
                                stockQuantity: 10,
                                imageUrl: '',
                                isActive: true,
                              },
                            ],
                          })
                        }
                        className="px-3 py-1.5 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-xs font-bold cursor-pointer"
                      >
                        + Add Variant
                      </button>
                    </div>

                    {prodForm.variants.map((v, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center bg-[#FAFAFF] p-3 rounded-xl border border-[#EDE8F7]">
                        <input
                          type="text"
                          value={v.colorName}
                          onChange={(e) => {
                            const next = [...prodForm.variants];
                            next[idx] = { ...next[idx], colorName: e.target.value };
                            setProdForm({ ...prodForm, variants: next });
                          }}
                          placeholder="Color"
                          className={inputCls}
                        />
                        <input
                          type="color"
                          value={v.colorHex}
                          onChange={(e) => {
                            const next = [...prodForm.variants];
                            next[idx] = { ...next[idx], colorHex: e.target.value };
                            setProdForm({ ...prodForm, variants: next });
                          }}
                          className="h-9 w-full rounded-lg border border-[#E2D9F3]"
                        />
                        <input
                          type="text"
                          value={v.sizeName}
                          onChange={(e) => {
                            const next = [...prodForm.variants];
                            next[idx] = { ...next[idx], sizeName: e.target.value };
                            setProdForm({ ...prodForm, variants: next });
                          }}
                          placeholder="Size"
                          className={inputCls}
                        />
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => {
                            const next = [...prodForm.variants];
                            next[idx] = { ...next[idx], sku: e.target.value };
                            setProdForm({ ...prodForm, variants: next });
                          }}
                          placeholder="SKU"
                          className={inputCls}
                        />
                        <input
                          type="number"
                          value={v.stockQuantity}
                          onChange={(e) => {
                            const next = [...prodForm.variants];
                            next[idx] = { ...next[idx], stockQuantity: Number(e.target.value) };
                            setProdForm({ ...prodForm, variants: next });
                          }}
                          placeholder="Stock"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProdForm({
                              ...prodForm,
                              variants: prodForm.variants.filter((_, i) => i !== idx),
                            })
                          }
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={productUploading}
                    className="px-7 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {editingProduct ? 'Save Product Changes' : 'Publish Product'}
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center gap-4"
                  >
                    <img
                      src={p.images[0]?.url || ''}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover bg-[#FFF0F6] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-xs text-[#64597A]">
                        {formatINR(p.sellingPrice)} · Stock: {p.totalStock} · {p.variants.length}{' '}
                        variants
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditProductForm(p)}
                        className="p-2 rounded-xl border border-[#E2D9F3] hover:border-[#7C3AED] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 text-[#7C3AED]" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteProduct(p.id);
                          notify('Product deleted.', 'info');
                          await loadTabData('products');
                          void refreshBootstrap();
                        }}
                        className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif-display text-2xl font-extrabold">
                  Orders ({orders.length})
                </h2>
                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="px-4 py-2 rounded-full bg-white border border-[#E2D9F3] text-xs font-bold"
                >
                  <option value="all">All Statuses</option>
                  <option value="placed">Placed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#EDE8F7] p-8 text-center text-xs text-[#64597A]">
                  No orders match this filter.
                </div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="bg-white rounded-2xl border border-[#EDE8F7] p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDE8F7] pb-3">
                      <div>
                        <p className="text-sm font-extrabold">#{o.orderNumber}</p>
                        <p className="text-xs text-[#64597A]">
                          {o.customerName} · {o.customerEmail} · {o.customerPhone}
                        </p>
                      </div>
                      <span className="text-base font-extrabold tabular-nums">
                        {formatINR(o.grandTotal)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <select
                        value={o.orderStatus}
                        onChange={async (e) => {
                          await adminUpdateOrder(o.id, o.orderNumber, {
                            orderStatus: e.target.value,
                          });
                          notify('Order status updated.', 'success');
                          await loadTabData('orders');
                        }}
                        className={inputCls}
                      >
                        {['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map(
                          (st) => (
                            <option key={st} value={st}>
                              Status: {st}
                            </option>
                          )
                        )}
                      </select>
                      <select
                        value={o.paymentStatus}
                        onChange={async (e) => {
                          await adminUpdateOrder(o.id, o.orderNumber, {
                            paymentStatus: e.target.value,
                          });
                          notify('Payment status updated.', 'success');
                          await loadTabData('orders');
                        }}
                        className={inputCls}
                      >
                        {['pending', 'paid', 'failed', 'refunded'].map((st) => (
                          <option key={st} value={st}>
                            Payment: {st}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        defaultValue={o.courierName || ''}
                        placeholder="Courier name"
                        onBlur={async (e) => {
                          if (e.target.value !== (o.courierName || '')) {
                            await adminUpdateOrder(o.id, o.orderNumber, {
                              courierName: e.target.value,
                            });
                            notify('Courier saved.', 'success');
                          }
                        }}
                        className={inputCls}
                      />
                      <input
                        type="text"
                        defaultValue={o.trackingNumber || ''}
                        placeholder="Tracking number"
                        onBlur={async (e) => {
                          if (e.target.value !== (o.trackingNumber || '')) {
                            await adminUpdateOrder(o.id, o.orderNumber, {
                              trackingNumber: e.target.value,
                            });
                            notify('Tracking ID saved.', 'success');
                          }
                        }}
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* BANNERS TAB */}
          {tab === 'banners' && (
            <div className="space-y-6">
              <h2 className="font-serif-display text-2xl font-extrabold">Homepage Banners</h2>
              <form
                onSubmit={handleSaveBanner}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4"
              >
                <h3 className="text-sm font-extrabold">
                  {editingBanner ? 'Edit Banner' : 'Add New Banner'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={bannerForm.heading}
                    onChange={(e) => setBannerForm({ ...bannerForm, heading: e.target.value })}
                    placeholder="Heading (EN) *"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={bannerForm.headingHi}
                    onChange={(e) => setBannerForm({ ...bannerForm, headingHi: e.target.value })}
                    placeholder="Heading (HI)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={bannerForm.subheading}
                    onChange={(e) => setBannerForm({ ...bannerForm, subheading: e.target.value })}
                    placeholder="Subheading (EN)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={bannerForm.ctaText}
                    onChange={(e) => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                    placeholder="CTA Button Text"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={bannerForm.ctaUrl}
                    onChange={(e) => setBannerForm({ ...bannerForm, ctaUrl: e.target.value })}
                    placeholder="CTA Link (/collections/hijabs)"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={bannerForm.sortOrder}
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, sortOrder: Number(e.target.value) })
                    }
                    placeholder="Sort Order"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SingleMediaUploadField
                    label="Desktop Banner Image *"
                    value={bannerForm.desktopImageUrl}
                    onChange={(url) => setBannerForm({ ...bannerForm, desktopImageUrl: url })}
                    folder="banners"
                  />
                  <SingleMediaUploadField
                    label="Mobile Banner Image"
                    value={bannerForm.mobileImageUrl}
                    onChange={(url) => setBannerForm({ ...bannerForm, mobileImageUrl: url })}
                    folder="banners"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {editingBanner ? 'Update Banner' : 'Add Banner'}
                  </button>
                  {editingBanner && (
                    <button
                      type="button"
                      onClick={() => setEditingBanner(null)}
                      className="text-xs font-bold text-[#64597A] cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-[#EDE8F7] overflow-hidden">
                    <img
                      src={b.desktopImageUrl}
                      alt={b.heading}
                      referrerPolicy="no-referrer"
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{b.heading}</p>
                        <p className="text-xs text-[#64597A]">{b.ctaUrl}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBanner(b);
                            setBannerForm({
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
                            });
                          }}
                          className="p-2 rounded-xl border border-[#E2D9F3] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4 text-[#7C3AED]" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminDeleteBanner(b.id);
                            notify('Banner deleted.', 'info');
                            await loadTabData('banners');
                            void refreshBootstrap();
                          }}
                          className="p-2 rounded-xl border border-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REVIEWS TAB */}
          {tab === 'reviews' && (
            <div className="space-y-6">
              <h2 className="font-serif-display text-2xl font-extrabold">
                Customer Reviews Moderation ({reviews.length})
              </h2>

              <form
                onSubmit={handleSaveReview}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4"
              >
                <h3 className="text-sm font-extrabold">
                  {editingReview ? 'Edit Review' : 'Add Verified Review'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    required
                    value={reviewForm.productId}
                    onChange={(e) => setReviewForm({ ...reviewForm, productId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select Product *</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={reviewForm.customerName}
                    onChange={(e) => setReviewForm({ ...reviewForm, customerName: e.target.value })}
                    placeholder="Customer Name *"
                    className={inputCls}
                  />
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                    className={inputCls}
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {r} Stars
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    placeholder="Headline"
                    className={inputCls}
                  />
                  <select
                    value={reviewForm.status}
                    onChange={(e) =>
                      setReviewForm({
                        ...reviewForm,
                        status: e.target.value as 'pending' | 'approved' | 'rejected',
                      })
                    }
                    className={inputCls}
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs font-bold px-2">
                    <input
                      type="checkbox"
                      checked={reviewForm.isVerifiedPurchase}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, isVerifiedPurchase: e.target.checked })
                      }
                    />
                    Verified Purchase
                  </label>
                </div>
                <textarea
                  rows={2}
                  required
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="Review comment *"
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  {editingReview ? 'Save Review' : 'Publish Review'}
                </button>
              </form>

              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <p className="text-xs font-extrabold text-[#7C3AED]">
                        {rev.customerName} · {rev.rating}★ ·{' '}
                        <span className="uppercase">{rev.status}</span>
                      </p>
                      <p className="text-xs text-[#4D4463]">{rev.comment}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await adminSaveReview(rev.id, {
                            productId: rev.productId || '',
                            productName: rev.productName,
                            productSlug: rev.productSlug,
                            customerName: rev.customerName,
                            customerEmail: rev.customerEmail,
                            rating: rev.rating,
                            title: rev.title,
                            comment: rev.comment,
                            imagesJson: rev.imagesJson,
                            isVerifiedPurchase: rev.isVerifiedPurchase,
                            status: 'approved',
                          });
                          notify('Review approved.', 'success');
                          await loadTabData('reviews');
                          void refreshBootstrap();
                        }}
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-700 cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminSaveReview(rev.id, {
                            productId: rev.productId || '',
                            productName: rev.productName,
                            productSlug: rev.productSlug,
                            customerName: rev.customerName,
                            customerEmail: rev.customerEmail,
                            rating: rev.rating,
                            title: rev.title,
                            comment: rev.comment,
                            imagesJson: rev.imagesJson,
                            isVerifiedPurchase: rev.isVerifiedPurchase,
                            status: 'rejected',
                          });
                          notify('Review rejected.', 'info');
                          await loadTabData('reviews');
                        }}
                        className="p-2 rounded-xl bg-amber-50 text-amber-700 cursor-pointer"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteReview(rev.id);
                          notify('Review deleted.', 'info');
                          await loadTabData('reviews');
                          void refreshBootstrap();
                        }}
                        className="p-2 rounded-xl bg-rose-50 text-rose-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BLOGS CMS TAB */}
          {tab === 'blogs' && (
            <div className="space-y-6">
              <h2 className="font-serif-display text-2xl font-extrabold">ZARIFLY Journal CMS</h2>
              <form
                onSubmit={handleSaveBlog}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={blogForm.title}
                    onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                    placeholder="Article Title (EN) *"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={blogForm.titleHi}
                    onChange={(e) => setBlogForm({ ...blogForm, titleHi: e.target.value })}
                    placeholder="Article Title (HI)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={blogForm.category}
                    onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                    placeholder="Category (Hijab Guide, Craftsmanship...)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={blogForm.authorName}
                    onChange={(e) => setBlogForm({ ...blogForm, authorName: e.target.value })}
                    placeholder="Author Name"
                    className={inputCls}
                  />
                </div>
                <SingleMediaUploadField
                  label="Featured Blog Cover Image"
                  value={blogForm.featuredImageUrl}
                  onChange={(url) => setBlogForm({ ...blogForm, featuredImageUrl: url })}
                  folder="blogs"
                />
                <textarea
                  rows={2}
                  required
                  value={blogForm.excerpt}
                  onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                  placeholder="Short excerpt *"
                  className={inputCls}
                />
                <textarea
                  rows={5}
                  required
                  value={blogForm.content}
                  onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                  placeholder="Full article content (separate paragraphs with blank lines) *"
                  className={inputCls}
                />
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={blogForm.isPublished}
                      onChange={(e) => setBlogForm({ ...blogForm, isPublished: e.target.checked })}
                    />
                    Publish Live
                  </label>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {editingBlog ? 'Update Article' : 'Publish Article'}
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{b.title}</p>
                      <p className="text-xs text-[#64597A]">{b.category} · {b.isPublished ? 'Published' : 'Draft'}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBlog(b);
                          setBlogForm({
                            slug: b.slug,
                            title: b.title,
                            titleHi: b.titleHi || '',
                            excerpt: b.excerpt,
                            excerptHi: b.excerptHi || '',
                            content: b.content,
                            contentHi: b.contentHi || '',
                            featuredImageUrl: b.featuredImageUrl,
                            authorName: b.authorName,
                            category: b.category,
                            seoTitle: b.seoTitle || '',
                            seoDescription: b.seoDescription || '',
                            isPublished: b.isPublished,
                            publishedAt: b.publishedAt,
                          });
                        }}
                        className="p-2 rounded-xl border border-[#E2D9F3] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 text-[#7C3AED]" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteBlog(b.id);
                          notify('Article deleted.', 'info');
                          await loadTabData('blogs');
                          void refreshBootstrap();
                        }}
                        className="p-2 rounded-xl border border-rose-200 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REELS TAB */}
          {tab === 'reels' && (
            <div className="space-y-6">
              <h2 className="font-serif-display text-2xl font-extrabold">Shoppable Reels</h2>
              <form
                onSubmit={handleSaveReel}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={reelForm.title}
                    onChange={(e) => setReelForm({ ...reelForm, title: e.target.value })}
                    placeholder="Reel Title *"
                    className={inputCls}
                  />
                  <select
                    value={reelForm.productId}
                    onChange={(e) => setReelForm({ ...reelForm, productId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Tag Linked Product (Optional)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={reelForm.caption}
                  onChange={(e) => setReelForm({ ...reelForm, caption: e.target.value })}
                  placeholder="Caption"
                  className={inputCls}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SingleMediaUploadField
                    label="Reel Thumbnail Image *"
                    value={reelForm.thumbnailUrl}
                    onChange={(url) => setReelForm({ ...reelForm, thumbnailUrl: url })}
                    folder="reels"
                  />
                  <SingleMediaUploadField
                    label="Reel Video (MP4 / WebM)"
                    value={reelForm.videoUrl}
                    onChange={(url) => setReelForm({ ...reelForm, videoUrl: url })}
                    folder="reels"
                    accept="video/mp4,video/webm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  {editingReel ? 'Update Reel' : 'Add Reel'}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {reels.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#EDE8F7] p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={r.thumbnailUrl}
                        alt={r.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-16 rounded-xl object-cover shrink-0"
                      />
                      <p className="text-xs font-bold truncate">{r.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminDeleteReel(r.id);
                        notify('Reel deleted.', 'info');
                        await loadTabData('reels');
                        void refreshBootstrap();
                      }}
                      className="p-2 rounded-xl border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOMERS TAB */}
          {tab === 'customers' && (
            <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4">
              <h2 className="font-serif-display text-2xl font-extrabold">
                Registered Customers ({customers.length})
              </h2>
              <div className="divide-y divide-[#EDE8F7] text-xs">
                {customers.map((c) => (
                  <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">{c.fullName || 'Guest'} ({c.role})</p>
                      <p className="text-[#64597A]">{c.email} · {c.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold">{c.orderCount} orders</p>
                      <p className="text-[#64597A]">{formatINR(c.totalSpent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MARKETING TAB */}
          {tab === 'marketing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4">
                <h2 className="font-serif-display text-2xl font-extrabold">Coupons</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await adminCreateCoupon(couponForm);
                    notify('Coupon created.', 'success');
                    setCouponForm({ ...couponForm, code: '', description: '' });
                    await loadTabData('marketing');
                  }}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    placeholder="CODE (e.g. EID15)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    required
                    value={couponForm.description}
                    onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                    placeholder="Description"
                    className={inputCls}
                  />
                  <select
                    value={couponForm.discountType}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discountType: e.target.value as 'percent' | 'fixed' })
                    }
                    className={inputCls}
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Flat (₹)</option>
                  </select>
                  <input
                    type="number"
                    required
                    value={couponForm.discountValue}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })
                    }
                    placeholder="Value"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase cursor-pointer"
                  >
                    Create
                  </button>
                </form>

                <div className="divide-y divide-[#EDE8F7] text-xs">
                  {coupons.map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-[#7C3AED]">{c.code}</span> — {c.description}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteCoupon(c.id);
                          notify('Coupon deleted.', 'info');
                          await loadTabData('marketing');
                        }}
                        className="text-rose-600 font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-3">
                  <h3 className="font-serif-display text-xl font-extrabold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#FF4D8D]" />
                    Subscribers ({subscribers.length})
                  </h3>
                  <div className="divide-y divide-[#EDE8F7] text-xs max-h-64 overflow-y-auto">
                    {subscribers.map((s) => (
                      <p key={s.id} className="py-2">
                        <strong>{s.email}</strong> · {new Date(s.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-3">
                  <h3 className="font-serif-display text-xl font-extrabold">
                    Contact Messages ({messages.length})
                  </h3>
                  <div className="divide-y divide-[#EDE8F7] text-xs max-h-64 overflow-y-auto">
                    {messages.map((m) => (
                      <div key={m.id} className="py-2.5 space-y-0.5">
                        <p className="font-bold">{m.name} ({m.email}) — {m.subject}</p>
                        <p className="text-[#5E5474]">{m.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS & AUDIT TAB */}
          {tab === 'settings' && (
            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await adminSaveSettings(settings);
                  await refreshBootstrap();
                  notify('Website & shipping settings saved to Firestore.', 'success');
                }}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-5"
              >
                <h2 className="font-serif-display text-2xl font-extrabold">
                  Website &amp; Shipping Settings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={settings.announcementEn || ''}
                    onChange={(e) => setSettings({ ...settings, announcementEn: e.target.value })}
                    placeholder="Announcement Bar (EN)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={settings.announcementHi || ''}
                    onChange={(e) => setSettings({ ...settings, announcementHi: e.target.value })}
                    placeholder="Announcement Bar (HI)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={settings.whatsappNumber || ''}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    placeholder="WhatsApp Number (919619586126)"
                    className={inputCls}
                  />
                  <input
                    type="email"
                    value={settings.supportEmail || ''}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    placeholder="Support Email"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={settings.freeShippingThreshold ?? 1999}
                    onChange={(e) =>
                      setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })
                    }
                    placeholder="Free Shipping Threshold (₹)"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={settings.flatShippingFee ?? 120}
                    onChange={(e) =>
                      setSettings({ ...settings, flatShippingFee: Number(e.target.value) })
                    }
                    placeholder="Flat Shipping Fee (₹)"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SingleMediaUploadField
                    label="Official Brand Logo"
                    value={settings.logoUrl || ''}
                    onChange={(url) => setSettings({ ...settings, logoUrl: url })}
                    folder="branding"
                  />
                  <SingleMediaUploadField
                    label="Founder Portrait (Sama Shaikh)"
                    value={settings.founderPortraitUrl || ''}
                    onChange={(url) => setSettings({ ...settings, founderPortraitUrl: url })}
                    folder="founder"
                  />
                </div>

                <button
                  type="submit"
                  className="px-7 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  Save All Settings
                </button>
              </form>

              <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-3">
                <h3 className="font-serif-display text-xl font-extrabold">
                  Admin Activity Audit Log ({logs.length})
                </h3>
                <div className="divide-y divide-[#EDE8F7] text-xs max-h-72 overflow-y-auto">
                  {logs.map((l) => (
                    <div key={l.id} className="py-2 flex justify-between gap-2">
                      <span>
                        <strong className="text-[#7C3AED]">{l.action}</strong> ({l.entityType}) —{' '}
                        {l.details || l.entityId}
                      </span>
                      <span className="text-[#64597A] shrink-0">
                        {new Date(l.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
