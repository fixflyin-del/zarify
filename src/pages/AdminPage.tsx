import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  Database,
  Download,
  Edit3,
  Eye,
  Film,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Settings,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { SEO } from '../components/SEO';
import { ZariflyLogo } from '../components/ZariflyLogo';
import { FiveImageUploader } from '../components/FiveImageUploader';
import type {
  Banner,
  BlogPost,
  Category,
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
  | 'customers'
  | 'banners'
  | 'reels'
  | 'reviews'
  | 'blogs'
  | 'coupons'
  | 'settings';

const ORDER_STATUSES = [
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
];

const STUDIO_IMAGE_PRESETS = [
  { label: 'Hero: Royal Hijabs', url: '/src/assets/images/hero_royal_hijabs_1795096959947.jpg' },
  { label: 'Hero: Zardozi Dupattas', url: '/src/assets/images/hero_zardozi_dupattas_1795096993927.jpg' },
  { label: 'Hero: Elegant Naqaabs', url: '/src/assets/images/hero_elegant_naqaabs_1795097028833.jpg' },
  { label: 'Zardozi Craftsmanship', url: '/src/assets/images/craftsmanship_zardozi_1795097178304.jpg' },
  { label: 'Premium Hijabs', url: '/src/assets/images/cat_premium_hijabs_1795097097750.jpg' },
  { label: 'Signature Naqaabs', url: '/src/assets/images/cat_signature_naqaabs_1795097125293.jpg' },
  { label: 'Designer Dupattas', url: '/src/assets/images/cat_designer_dupattas_1795097149980.jpg' },
];

const BLOG_CATEGORIES = [
  'Modest Fashion',
  'Hijab Styling',
  'Zardozi Heritage',
  'Bridal & Festive',
  'Fabric Care',
  'Naqaab Comfort',
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uploadSingleToCloudinary(file: File, folder: string): Promise<string> {
  const sig = await apiRequest<{
    configured: boolean;
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  }>('/api/admin/cloudinary/signature', {
    method: 'POST',
    body: JSON.stringify({ folder }),
  });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', String(sig.timestamp));
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  }
  return data.secure_url as string;
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFF] border border-[#E2D9F3] text-xs text-[#181326] outline-none focus:border-[#7C3AED] transition-colors';

export function AdminPage() {
  const { user, authLoading, loginWithEmail, loginWithGoogle, logout, refreshBootstrap, notify } =
    useStore();
  const [tab, setTab] = useState<AdminTab>('overview');

  // Admin Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Admin Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [customers, setCustomers] = useState<any[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [logs, setLogs] = useState<any[]>([]);

  // Modals
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [editingReel, setEditingReel] = useState<any | null>(null);
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [editingBlog, setEditingBlog] = useState<any | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 999,
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const loadTabData = async (targetTab: AdminTab) => {
    try {
      if (targetTab === 'overview') {
        const res = await apiRequest('/api/admin/dashboard');
        setDashboard(res);
      } else if (targetTab === 'products') {
        const res = await apiRequest<{ products: Product[]; categories: Category[] }>(
          '/api/admin/products'
        );
        setProducts(res.products || []);
        setCategories(res.categories || []);
      } else if (targetTab === 'orders') {
        const qs = new URLSearchParams();
        if (orderStatusFilter !== 'all') qs.set('status', orderStatusFilter);
        if (orderSearch.trim()) qs.set('search', orderSearch.trim());
        const res = await apiRequest<{ orders: Order[] }>(`/api/admin/orders?${qs.toString()}`);
        setOrders(res.orders || []);
      } else if (targetTab === 'customers') {
        const res = await apiRequest<{ customers: any[] }>('/api/admin/customers');
        setCustomers(res.customers || []);
      } else if (targetTab === 'banners') {
        const res = await apiRequest<{ banners: Banner[] }>('/api/admin/banners');
        setBanners(res.banners || []);
      } else if (targetTab === 'reels') {
        const [rRes, pRes] = await Promise.all([
          apiRequest<{ reels: ReelItem[] }>('/api/admin/reels'),
          apiRequest<{ products: Product[] }>('/api/admin/products'),
        ]);
        setReels(rRes.reels || []);
        setProducts(pRes.products || []);
      } else if (targetTab === 'reviews') {
        const [revRes, prodRes] = await Promise.all([
          apiRequest<{ reviews: ReviewItem[] }>('/api/admin/reviews'),
          apiRequest<{ products: Product[] }>('/api/admin/products'),
        ]);
        setReviews(revRes.reviews || []);
        setProducts(prodRes.products || []);
      } else if (targetTab === 'blogs') {
        const res = await apiRequest<{ blogs: BlogPost[] }>('/api/admin/blogs');
        setBlogs(res.blogs || []);
      } else if (targetTab === 'coupons') {
        const [cRes, sRes, mRes] = await Promise.all([
          apiRequest<{ coupons: any[] }>('/api/admin/coupons'),
          apiRequest<{ subscribers: any[] }>('/api/admin/subscribers'),
          apiRequest<{ messages: any[] }>('/api/admin/messages'),
        ]);
        setCoupons(cRes.coupons || []);
        setSubscribers(sRes.subscribers || []);
        setMessages(mRes.messages || []);
      } else if (targetTab === 'settings') {
        const [setRes, logRes] = await Promise.all([
          apiRequest<{ settings: StoreSettings }>('/api/admin/settings'),
          apiRequest<{ logs: any[] }>('/api/admin/activity-logs'),
        ]);
        setSettings(setRes.settings || {});
        setLogs(logRes.logs || []);
      }
    } catch (err: any) {
      notify(err?.message || 'Unable to load admin data.', 'error');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadTabData(tab);
    }
  }, [isAdmin, tab, orderStatusFilter]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoggingIn(true);
      const u = await loginWithEmail(loginEmail, loginPass);
      if (u.role !== 'admin' && u.role !== 'super_admin') {
        notify('This account does not have Admin permissions.', 'error');
      }
    } catch (err: any) {
      notify(err?.message || 'Admin login failed.', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCloudinaryPick = async (
    file: File | undefined,
    folder: string,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    try {
      setUploadingAsset(true);
      const url = await uploadSingleToCloudinary(file, folder);
      onUrl(url);
      notify('Image uploaded to Cloudinary!', 'success');
    } catch (err: any) {
      notify(
        err?.message ||
          'Cloudinary not configured yet — you can paste any image URL or choose a studio preset below.',
        'error'
      );
    } finally {
      setUploadingAsset(false);
    }
  };

  // Non-admin gate
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] text-sm font-semibold text-[#64597A]">
        Loading Admin Portal...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <SEO
          title="Admin Portal | ZARIFLY Boutique"
          description="Secure role-based admin login for ZARIFLY boutique management."
          canonicalPath="/admin"
        />
        <div className="min-h-screen bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[32px] border border-[#E9DDFC] p-8 sm:p-10 space-y-6 shadow-[0_22px_60px_rgba(124,58,237,0.12)]">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <ZariflyLogo size="lg" />
              </div>
              <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
                ZARIFLY Admin Portal
              </h1>
              <p className="text-xs text-[#64597A]">
                Manage Products, Hero Banners, Customer Reviews, Blog Articles, Orders &amp; Store Settings.
              </p>
            </div>

            {user && (
              <div className="bg-red-50 rounded-2xl border border-red-200 p-3.5 text-xs text-[#DC2626] space-y-2">
                <p>
                  Signed in as <strong>{user.email}</strong> (role: {user.role}), which does not
                  have Admin privileges.
                </p>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="underline font-bold"
                >
                  Sign out to switch account
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => loginWithGoogle().catch((e) => notify(e.message, 'error'))}
              className="w-full py-3.5 rounded-full border-2 border-[#181326] text-xs font-extrabold uppercase tracking-wider text-[#181326] hover:bg-[#F3EEFF] hover:border-[#7C3AED] transition-colors"
            >
              Sign In with Authorized Google Account
            </button>

            <form onSubmit={handleAdminLogin} className="space-y-4 pt-3 border-t border-[#EDE8F7]">
              <div>
                <label className="block text-xs font-bold text-[#5E5474] mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@zarifly.com"
                  className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E5474] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                />
              </div>
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all shadow-md"
              >
                {loggingIn ? 'Authenticating...' : 'Enter Admin Dashboard'}
              </button>
            </form>

            <div className="bg-[#FAFAFF] rounded-2xl border border-[#EDE8F7] p-3.5 text-[11px] text-[#64597A] space-y-1">
              <p className="font-bold text-[#181326]">Authorized Admin Access</p>
              <p>
                Sign in with your authorized Google account or use bootstrap email{' '}
                <strong className="text-[#7C3AED]">admin@zarifly.com</strong>.
              </p>
            </div>

            <div className="text-center">
              <Link to="/" className="text-xs font-bold text-[#7C3AED] hover:text-[#FF4D8D] hover:underline">
                Return to ZARIFLY Storefront
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // PRODUCT SAVE HANDLER
  const openNewProduct = () => {
    setEditingProduct({
      categoryId: categories[0]?.id || 1,
      name: '',
      nameHi: '',
      slug: '',
      sku: `ZRF-${Date.now().toString().slice(-4)}`,
      description: '',
      descriptionHi: '',
      fabric: 'Pure Silk-Chiffon',
      workDetails: 'Handcrafted Zari Border',
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
          sku: `ZRF-${Date.now().toString().slice(-4)}-IVR-STD`,
          colorName: 'Rose Pink',
          colorHex: '#FF4D8D',
          sizeName: 'Standard',
          priceOverride: null,
          stockQuantity: 10,
          imageUrl: '',
          isActive: true,
        },
      ] as ProductVariant[],
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingImages) {
      notify('Please wait for all image uploads to complete before saving.', 'error');
      return;
    }
    if (!editingProduct.images || editingProduct.images.length === 0) {
      notify('Please upload or add at least 1 square product image (up to 5).', 'error');
      return;
    }

    try {
      const payload = {
        ...editingProduct,
        categoryId: Number(editingProduct.categoryId),
        sellingPrice: Number(editingProduct.sellingPrice),
        originalPrice: Number(editingProduct.originalPrice),
        slug: editingProduct.slug || slugify(editingProduct.name),
        variants: editingProduct.variants.map((v: ProductVariant) => ({
          ...v,
          priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
          stockQuantity: Number(v.stockQuantity),
        })),
      };

      if (editingProduct.id) {
        await apiRequest(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('Product updated successfully!', 'success');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('New product created!', 'success');
      }
      setEditingProduct(null);
      loadTabData('products');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save product.', 'error');
    }
  };

  // BANNER SAVE HANDLER (Add + Edit)
  const openNewBanner = () => {
    setEditingBanner({
      heading: '',
      headingHi: '',
      subheading: '',
      subheadingHi: '',
      ctaText: 'Shop Collection',
      ctaTextHi: 'कलेक्शन देखें',
      ctaUrl: '/shop',
      desktopImageUrl: STUDIO_IMAGE_PRESETS[0].url,
      mobileImageUrl: STUDIO_IMAGE_PRESETS[0].url,
      sortOrder: banners.length + 1,
      isActive: true,
    });
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBanner.id) {
        await apiRequest(`/api/admin/banners/${editingBanner.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingBanner),
        });
        notify('Hero banner updated!', 'success');
      } else {
        await apiRequest('/api/admin/banners', {
          method: 'POST',
          body: JSON.stringify(editingBanner),
        });
        notify('Hero banner added!', 'success');
      }
      setEditingBanner(null);
      loadTabData('banners');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save banner.', 'error');
    }
  };

  // REEL SAVE HANDLER (Add + Edit)
  const openNewReel = () => {
    setEditingReel({
      title: '',
      caption: '',
      videoUrl: '',
      thumbnailUrl: STUDIO_IMAGE_PRESETS[4].url,
      productId: '',
      sortOrder: reels.length + 1,
      isActive: true,
    });
  };

  const handleSaveReel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...editingReel,
        productId: editingReel.productId ? Number(editingReel.productId) : null,
      };
      if (editingReel.id) {
        await apiRequest(`/api/admin/reels/${editingReel.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('Lookbook reel updated!', 'success');
      } else {
        await apiRequest('/api/admin/reels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('Lookbook reel added!', 'success');
      }
      setEditingReel(null);
      loadTabData('reels');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save reel.', 'error');
    }
  };

  // REVIEW SAVE HANDLER (Add + Edit)
  const openNewReview = () => {
    setEditingReview({
      productId: products[0]?.id || 1,
      customerName: '',
      customerEmail: '',
      rating: 5,
      title: '',
      comment: '',
      isVerifiedPurchase: true,
      status: 'approved',
    });
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReview.id) {
        await apiRequest(`/api/admin/reviews/${editingReview.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            customerName: editingReview.customerName,
            rating: Number(editingReview.rating),
            title: editingReview.title || '',
            comment: editingReview.comment,
            isVerifiedPurchase: Boolean(editingReview.isVerifiedPurchase),
            status: editingReview.status || 'approved',
          }),
        });
        notify('Review updated!', 'success');
      } else {
        await apiRequest('/api/admin/reviews', {
          method: 'POST',
          body: JSON.stringify({
            productId: Number(editingReview.productId),
            customerName: editingReview.customerName,
            customerEmail: editingReview.customerEmail || '',
            rating: Number(editingReview.rating),
            title: editingReview.title || '',
            comment: editingReview.comment,
            isVerifiedPurchase: Boolean(editingReview.isVerifiedPurchase),
            status: editingReview.status || 'approved',
          }),
        });
        notify('Customer review added!', 'success');
      }
      setEditingReview(null);
      loadTabData('reviews');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save review.', 'error');
    }
  };

  // BLOG SAVE HANDLER (Add + Edit)
  const openNewBlog = () => {
    setEditingBlog({
      slug: '',
      title: '',
      titleHi: '',
      excerpt: '',
      excerptHi: '',
      content: '',
      contentHi: '',
      featuredImageUrl: STUDIO_IMAGE_PRESETS[4].url,
      authorName: 'Sama Shaikh',
      category: 'Modest Fashion',
      seoTitle: '',
      seoDescription: '',
      isPublished: true,
    });
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...editingBlog,
        slug: editingBlog.slug ? slugify(editingBlog.slug) : slugify(editingBlog.title),
      };
      if (editingBlog.id) {
        await apiRequest(`/api/admin/blogs/${editingBlog.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify('Blog article updated!', 'success');
      } else {
        await apiRequest('/api/admin/blogs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('New blog article published!', 'success');
      }
      setEditingBlog(null);
      loadTabData('blogs');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save blog article.', 'error');
    }
  };

  const handleUpdateOrder = async (orderId: number, updates: Record<string, any>) => {
    try {
      await apiRequest(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      notify('Order updated.', 'success');
      loadTabData('orders');
    } catch (err: any) {
      notify(err?.message || 'Unable to update order.', 'error');
    }
  };

  const handleRefundOrder = async (orderId: number) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
      });
      notify(res.message || 'Refund initiated.', 'success');
      loadTabData('orders');
    } catch (err: any) {
      notify(err?.message || 'Refund failed.', 'error');
    }
  };

  const downloadOrdersCsv = () => {
    const header = [
      'OrderNumber',
      'Date',
      'Customer',
      'Email',
      'Phone',
      'TotalINR',
      'Payment',
      'Status',
    ];
    const rows = orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toISOString(),
      `"${o.customerName}"`,
      o.customerEmail,
      o.customerPhone,
      o.grandTotal,
      `${o.paymentMethod}/${o.paymentStatus}`,
      o.orderStatus,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zarifly-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'banners', label: 'Hero Banners', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'blogs', label: 'Blog CMS', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'reels', label: 'Reels', icon: <Film className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'coupons', label: 'Coupons & Leads', icon: <Tag className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings & Logs', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      <SEO
        title="ZARIFLY Admin Dashboard"
        description="Complete e-commerce administration dashboard for ZARIFLY."
        canonicalPath="/admin"
      />

      <div className="min-h-screen bg-[#FAFAFF] flex flex-col lg:flex-row">
        {/* Vibrant Deep Ink Sidebar */}
        <aside className="w-full lg:w-64 bg-[#181326] text-white flex flex-col justify-between shrink-0">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Link to="/" className="bg-white/95 rounded-xl px-2.5 py-1">
                <ZariflyLogo size="sm" />
              </Link>
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-[10px] font-extrabold uppercase tracking-wider text-white">
                Admin
              </span>
            </div>

            <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all text-left ${
                    tab === item.id
                      ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-[0_6px_18px_rgba(255,77,141,0.35)]'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-5 sm:p-6 border-t border-white/10 space-y-3 text-xs">
            <p className="text-white/65 truncate">{user.email}</p>
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-1 font-bold text-[#67E8F9] hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                View Store
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 text-white/75 hover:text-[#FF9EC2] font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Admin Workspace */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 overflow-x-hidden space-y-8">
          {/* 1. OVERVIEW */}
          {tab === 'overview' && dashboard && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF4D8D]">
                    ZARIFLY Control Studio
                  </p>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    Dashboard Analytics
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold border ${
                      dashboard.storageMode === 'postgresql'
                        ? 'bg-[#ECFDF5] border-[#10B981]/30 text-[#059669]'
                        : 'bg-[#FFF7ED] border-[#F59E0B]/40 text-[#B45309]'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    {dashboard.storageMode === 'postgresql'
                      ? 'PostgreSQL Connected'
                      : 'Preview Mode (Add DATABASE_URL in Vercel)'}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-white border border-[#E2D9F3] font-semibold text-[#5E5474]">
                    PayU:{' '}
                    <strong
                      className={
                        dashboard.integrations.payu.configured
                          ? 'text-[#10B981]'
                          : 'text-[#7C3AED]'
                      }
                    >
                      {dashboard.integrations.payu.configured
                        ? `Connected (${dashboard.integrations.payu.env})`
                        : 'Ready'}
                    </strong>
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-white border border-[#E2D9F3] font-semibold text-[#5E5474]">
                    Cloudinary:{' '}
                    <strong
                      className={
                        dashboard.integrations.cloudinary.configured
                          ? 'text-[#10B981]'
                          : 'text-[#7C3AED]'
                      }
                    >
                      {dashboard.integrations.cloudinary.configured ? 'Connected' : 'URL/Studio Mode'}
                    </strong>
                  </span>
                </div>
              </div>

              {dashboard.storageMode !== 'postgresql' && (
                <div className="bg-gradient-to-r from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] rounded-3xl border border-[#E9DDFC] p-5 text-xs text-[#3D3452] space-y-1.5">
                  <p className="font-extrabold text-[#181326] text-sm">
                    Vercel Preview Storage Active — Connect PostgreSQL for Permanent Cloud Saves
                  </p>
                  <p>
                    Your store, hero banners, categories, products, and Admin Panel are live right now!
                    To persist edits permanently across serverless restarts on Vercel, add a free{' '}
                    <strong>Neon / Supabase / Vercel Postgres</strong> connection string as{' '}
                    <code className="px-1.5 py-0.5 rounded bg-white border border-[#E2D9F3] font-bold">
                      DATABASE_URL
                    </code>{' '}
                    in Vercel Project Settings → Environment Variables and redeploy.
                  </p>
                </div>
              )}

              {/* Quick Shortcuts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: '+ Add / Edit Products',
                    sub: '5 images & variants',
                    target: 'products' as AdminTab,
                    grad: 'from-[#FF4D8D] to-[#EC4899]',
                  },
                  {
                    label: 'Edit Hero Banners',
                    sub: 'Top slider & CTAs',
                    target: 'banners' as AdminTab,
                    grad: 'from-[#7C3AED] to-[#6366F1]',
                  },
                  {
                    label: 'Manage Reviews',
                    sub: 'Add, edit, approve',
                    target: 'reviews' as AdminTab,
                    grad: 'from-[#06B6D4] to-[#0284C7]',
                  },
                  {
                    label: 'Write Blog Article',
                    sub: 'Hindi & English CMS',
                    target: 'blogs' as AdminTab,
                    grad: 'from-[#FF7A59] to-[#F59E0B]',
                  },
                ].map((q) => (
                  <button
                    key={q.target}
                    type="button"
                    onClick={() => setTab(q.target)}
                    className={`p-4 rounded-3xl bg-gradient-to-r ${q.grad} text-white text-left shadow-md hover:brightness-110 transition-all`}
                  >
                    <p className="text-xs sm:text-sm font-extrabold">{q.label}</p>
                    <p className="text-[11px] text-white/85 mt-0.5">{q.sub}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', val: formatINR(dashboard.metrics.totalRevenue) },
                  { label: 'Total Orders', val: dashboard.metrics.totalOrders },
                  { label: 'Pending / Processing', val: dashboard.metrics.pendingOrders },
                  { label: 'Completed Orders', val: dashboard.metrics.completedOrders },
                  { label: 'Cancelled / Returned', val: dashboard.metrics.cancelledOrders },
                  { label: 'Registered Customers', val: dashboard.metrics.totalCustomers },
                  { label: 'Active Catalogue', val: dashboard.metrics.totalProducts },
                  { label: 'Low Stock Variants (≤5)', val: dashboard.metrics.lowStockCount },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-white rounded-3xl border border-[#EDE8F7] p-5 space-y-1 shadow-xs"
                  >
                    <p className="text-xs font-semibold text-[#64597A]">{kpi.label}</p>
                    <p className="font-serif-display text-3xl font-extrabold text-[#181326] tabular-nums">
                      {kpi.val}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4 shadow-xs">
                  <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    Low Stock Alerts
                  </h2>
                  {dashboard.lowStockVariants.length === 0 ? (
                    <p className="text-xs text-[#64597A]">
                      All product variants have healthy inventory.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EDE8F7] text-xs">
                      {dashboard.lowStockVariants.map((v: any) => (
                        <div key={v.id} className="py-2.5 flex justify-between gap-2">
                          <div>
                            <p className="font-bold text-[#181326]">{v.productName}</p>
                            <p className="text-[#64597A]">
                              {v.colorName} · {v.sizeName} ({v.sku})
                            </p>
                          </div>
                          <span className="font-extrabold tabular-nums text-[#DC2626]">
                            {v.stockQuantity} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-4 shadow-xs">
                  <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    Recent Orders
                  </h2>
                  {dashboard.recentOrders.length === 0 ? (
                    <p className="text-xs text-[#64597A]">No orders placed yet.</p>
                  ) : (
                    <div className="divide-y divide-[#EDE8F7] text-xs">
                      {dashboard.recentOrders.map((o: Order) => (
                        <div key={o.id} className="py-2.5 flex justify-between gap-2">
                          <div>
                            <p className="font-bold text-[#181326] tabular-nums">
                              {o.orderNumber} · {o.customerName}
                            </p>
                            <p className="text-[#64597A] capitalize">
                              {o.orderStatus.replace(/_/g, ' ')} · {o.paymentMethod.toUpperCase()}
                            </p>
                          </div>
                          <span className="font-extrabold tabular-nums text-[#7C3AED]">
                            {formatINR(o.grandTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. PRODUCTS MANAGEMENT */}
          {tab === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    Product Catalogue ({products.length})
                  </h1>
                  <p className="text-xs text-[#64597A] mt-1">
                    Add, edit, or delete Hijabs, Naqaabs, Dupattas, 5-image galleries, colour/size
                    variants, and stock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProduct}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add New Product
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-[#EDE8F7] overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFF] border-b border-[#EDE8F7] text-[#64597A]">
                    <tr>
                      <th className="p-4">Product</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Variants &amp; Stock</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE8F7]">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAFAFF]/70">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.images[0]?.url}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover bg-[#FFF0F6] border border-[#EDE8F7]"
                            />
                            <div>
                              <p className="font-bold text-[#181326]">{p.name}</p>
                              <p className="text-[#64597A] tabular-nums">
                                {p.sku} · {p.images.length} photos
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-[#5E5474]">{p.category?.name}</td>
                        <td className="p-4 tabular-nums font-extrabold text-[#181326]">
                          {formatINR(p.sellingPrice)}
                        </td>
                        <td className="p-4 tabular-nums text-[#5E5474]">
                          {p.variants.length} variants · {p.totalStock} in stock
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              p.isActive
                                ? 'bg-[#ECFDF5] text-[#059669]'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {p.isActive ? 'Active' : 'Hidden'}
                          </span>
                          {p.isBestSeller && (
                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#FF4D8D] text-[10px] font-bold">
                              Best Seller
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#E2D9F3] text-[#7C3AED] font-bold hover:bg-[#F3EEFF]"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/products/${p.id}`, { method: 'DELETE' });
                              notify('Product deleted.', 'info');
                              loadTabData('products');
                              refreshBootstrap();
                            }}
                            className="p-1.5 rounded-full border border-red-200 text-[#DC2626] hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add / Edit Product Modal */}
              {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#181326]/60 backdrop-blur-sm">
                  <form
                    onSubmit={handleSaveProduct}
                    className="bg-white rounded-[30px] border border-[#E9DDFC] w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-[#EDE8F7]">
                      <h2 className="font-serif-display text-3xl font-extrabold text-[#181326]">
                        {editingProduct.id ? 'Edit Product' : 'Create New Product'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="p-2 rounded-full bg-[#FAFAFF] text-[#5E5474] hover:text-[#181326]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Product Name (EN) *
                        </label>
                        <input
                          required
                          value={editingProduct.name}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              name: e.target.value,
                              slug: editingProduct.id ? editingProduct.slug : slugify(e.target.value),
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Product Name (Hindi)
                        </label>
                        <input
                          value={editingProduct.nameHi || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, nameHi: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">Category *</label>
                        <select
                          value={editingProduct.categoryId}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              categoryId: Number(e.target.value),
                            })
                          }
                          className={inputCls}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block mb-1 font-bold text-[#5E5474]">Master SKU *</label>
                          <input
                            required
                            value={editingProduct.sku}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, sku: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-bold text-[#5E5474]">SEO Slug *</label>
                          <input
                            required
                            value={editingProduct.slug}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, slug: e.target.value })
                            }
                            placeholder="auto-generated-slug"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Selling Price (INR) *
                        </label>
                        <input
                          type="number"
                          required
                          value={editingProduct.sellingPrice}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              sellingPrice: Number(e.target.value),
                            })
                          }
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Original Price (INR) *
                        </label>
                        <input
                          type="number"
                          required
                          value={editingProduct.originalPrice}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              originalPrice: Number(e.target.value),
                            })
                          }
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">Fabric</label>
                        <input
                          value={editingProduct.fabric || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, fabric: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Embroidery / Work Details
                        </label>
                        <input
                          value={editingProduct.workDetails || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, workDetails: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Description (EN) *
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={editingProduct.description}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, description: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-5 text-xs font-semibold text-[#181326]">
                      {[
                        { key: 'isActive', label: 'Active (Visible)' },
                        { key: 'isBestSeller', label: 'Best Seller' },
                        { key: 'isNewArrival', label: 'New Arrival' },
                        { key: 'isFeatured', label: 'Featured on Homepage' },
                      ].map((flag) => (
                        <label key={flag.key} className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editingProduct[flag.key])}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                [flag.key]: e.target.checked,
                              })
                            }
                            className="accent-[#FF4D8D] w-4 h-4"
                          />
                          <span>{flag.label}</span>
                        </label>
                      ))}
                    </div>

                    <FiveImageUploader
                      images={editingProduct.images || []}
                      onChange={(imgs) => setEditingProduct({ ...editingProduct, images: imgs })}
                      availableColors={Array.from(
                        new Set(
                          (editingProduct.variants || []).map((v: ProductVariant) => v.colorName)
                        )
                      )}
                      onUploadingChange={setUploadingImages}
                    />

                    {/* Colour & Size Variants */}
                    <div className="space-y-3 pt-2 border-t border-[#EDE8F7]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#181326]">
                          Colour &amp; Size Variants (Separate Inventory)
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingProduct({
                              ...editingProduct,
                              variants: [
                                ...editingProduct.variants,
                                {
                                  sku: `${editingProduct.sku}-V${editingProduct.variants.length + 1}`,
                                  colorName: 'Berry Pink',
                                  colorHex: '#FF4D8D',
                                  sizeName: 'Standard',
                                  priceOverride: null,
                                  stockQuantity: 10,
                                  imageUrl: '',
                                  isActive: true,
                                },
                              ],
                            })
                          }
                          className="text-xs font-extrabold text-[#7C3AED] hover:text-[#FF4D8D]"
                        >
                          + Add Variant
                        </button>
                      </div>

                      <div className="space-y-2">
                        {editingProduct.variants.map((v: ProductVariant, idx: number) => (
                          <div
                            key={idx}
                            className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#FAFAFF] p-3 rounded-2xl border border-[#EDE8F7] text-xs"
                          >
                            <input
                              required
                              value={v.sku}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], sku: e.target.value };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              placeholder="Variant SKU"
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2D9F3]"
                            />
                            <input
                              required
                              value={v.colorName}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], colorName: e.target.value };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              placeholder="Colour"
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2D9F3]"
                            />
                            <input
                              type="color"
                              value={v.colorHex}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], colorHex: e.target.value };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              className="w-full h-8 rounded-xl bg-white border border-[#E2D9F3] p-0.5"
                            />
                            <input
                              required
                              value={v.sizeName}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], sizeName: e.target.value };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              placeholder="Size"
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2D9F3]"
                            />
                            <input
                              type="number"
                              min={0}
                              required
                              value={v.stockQuantity}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], stockQuantity: Number(e.target.value) };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              placeholder="Stock"
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2D9F3] tabular-nums"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={v.priceOverride ?? ''}
                                onChange={(e) => {
                                  const copy = [...editingProduct.variants];
                                  copy[idx] = {
                                    ...copy[idx],
                                    priceOverride: e.target.value ? Number(e.target.value) : null,
                                  };
                                  setEditingProduct({ ...editingProduct, variants: copy });
                                }}
                                placeholder="Price (opt)"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-[#E2D9F3] tabular-nums"
                              />
                              {editingProduct.variants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingProduct({
                                      ...editingProduct,
                                      variants: editingProduct.variants.filter(
                                        (_: any, i: number) => i !== idx
                                      ),
                                    })
                                  }
                                  className="p-1.5 text-[#DC2626]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#EDE8F7]">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="px-5 py-2.5 rounded-full border border-[#E2D9F3] text-xs font-bold uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={uploadingImages}
                        className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider disabled:opacity-45 shadow-md"
                      >
                        {uploadingImages ? 'Uploading Images...' : 'Save Product'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 3. HERO BANNERS MANAGEMENT (Add, Edit & Change Banner Slides) */}
          {tab === 'banners' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    Hero Banner Slider ({banners.length})
                  </h1>
                  <p className="text-xs text-[#64597A] mt-1">
                    Add new slides or click Edit to change any banner photo, headline, button text,
                    or link.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewBanner}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Hero Banner
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-[#EDE8F7] overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="relative h-40 bg-[#181326]">
                      <img
                        src={b.desktopImageUrl}
                        alt={b.heading}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#181326]/75 via-[#181326]/30 to-transparent p-4 flex flex-col justify-end text-white">
                        <p className="font-serif-display text-lg font-extrabold leading-tight">
                          {b.heading}
                        </p>
                        {b.subheading && (
                          <p className="text-[11px] text-white/80 line-clamp-1">{b.subheading}</p>
                        )}
                      </div>
                      <span
                        className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          b.isActive ? 'bg-[#10B981] text-white' : 'bg-black/60 text-white/80'
                        }`}
                      >
                        {b.isActive ? `Slide #${b.sortOrder} · Active` : 'Hidden'}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-[#181326] truncate">
                          Button: {b.ctaText} → <span className="text-[#7C3AED]">{b.ctaUrl}</span>
                        </p>
                        {b.headingHi && (
                          <p className="text-[#64597A] truncate">Hindi: {b.headingHi}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingBanner({ ...b })}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold hover:bg-[#7C3AED] hover:text-white transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/banners/${b.id}`, { method: 'DELETE' });
                            notify('Banner deleted.', 'info');
                            loadTabData('banners');
                            refreshBootstrap();
                          }}
                          className="p-2 rounded-full border border-red-200 text-[#DC2626] hover:bg-red-50"
                          title="Delete Banner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add / Edit Banner Modal */}
              {editingBanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#181326]/60 backdrop-blur-sm">
                  <form
                    onSubmit={handleSaveBanner}
                    className="bg-white rounded-[30px] border border-[#E9DDFC] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-4 text-xs shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EDE8F7]">
                      <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                        {editingBanner.id ? 'Edit Hero Banner' : 'Add New Hero Banner'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingBanner(null)}
                        className="p-1.5 rounded-full bg-[#FAFAFF] text-[#64597A]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {editingBanner.desktopImageUrl && (
                      <div className="relative h-32 rounded-2xl overflow-hidden border border-[#EDE8F7]">
                        <img
                          src={editingBanner.desktopImageUrl}
                          alt="Banner preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#181326]/75 via-[#181326]/30 to-transparent p-4 flex flex-col justify-center text-white">
                          <p className="font-serif-display text-lg font-extrabold">
                            {editingBanner.heading || 'Banner Heading Preview'}
                          </p>
                          <p className="text-[11px] text-white/85">
                            {editingBanner.subheading || 'Banner subtitle preview'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Heading (English) *
                        </label>
                        <input
                          required
                          value={editingBanner.heading}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, heading: e.target.value })
                          }
                          placeholder="e.g. Royal Hijabs, Modern Grace"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Heading (Hindi)
                        </label>
                        <input
                          value={editingBanner.headingHi || ''}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, headingHi: e.target.value })
                          }
                          placeholder="शाही हिजाब, आधुनिक नज़ाकत"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Subheading (English)
                        </label>
                        <input
                          value={editingBanner.subheading || ''}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, subheading: e.target.value })
                          }
                          placeholder="Short catchy tagline"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Subheading (Hindi)
                        </label>
                        <input
                          value={editingBanner.subheadingHi || ''}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, subheadingHi: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Button Text (EN)
                        </label>
                        <input
                          value={editingBanner.ctaText || ''}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, ctaText: e.target.value })
                          }
                          placeholder="Shop Hijabs"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Button Link URL
                        </label>
                        <input
                          value={editingBanner.ctaUrl || ''}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, ctaUrl: e.target.value })
                          }
                          placeholder="/collections/hijabs"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#5E5474]">Banner Image URL *</label>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold cursor-pointer hover:bg-[#7C3AED] hover:text-white transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingAsset ? 'Uploading...' : 'Upload via Cloudinary'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleCloudinaryPick(e.target.files?.[0], 'banners', (url) =>
                                setEditingBanner({
                                  ...editingBanner,
                                  desktopImageUrl: url,
                                  mobileImageUrl: url,
                                })
                              )
                            }
                          />
                        </label>
                      </div>
                      <input
                        required
                        value={editingBanner.desktopImageUrl}
                        onChange={(e) =>
                          setEditingBanner({
                            ...editingBanner,
                            desktopImageUrl: e.target.value,
                            mobileImageUrl: e.target.value,
                          })
                        }
                        placeholder="https://... or /src/assets/images/..."
                        className={inputCls}
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {STUDIO_IMAGE_PRESETS.slice(0, 4).map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() =>
                              setEditingBanner({
                                ...editingBanner,
                                desktopImageUrl: preset.url,
                                mobileImageUrl: preset.url,
                              })
                            }
                            className="px-2.5 py-1 rounded-full bg-[#FAFAFF] border border-[#E2D9F3] text-[11px] font-semibold text-[#5E5474] hover:border-[#FF4D8D] hover:text-[#FF4D8D]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-3">
                        <label className="font-bold text-[#5E5474]">Slide Order</label>
                        <input
                          type="number"
                          min={1}
                          value={editingBanner.sortOrder ?? 1}
                          onChange={(e) =>
                            setEditingBanner({
                              ...editingBanner,
                              sortOrder: Number(e.target.value),
                            })
                          }
                          className="w-20 px-3 py-1.5 rounded-xl bg-[#FAFAFF] border border-[#E2D9F3] tabular-nums"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 font-bold text-[#181326] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingBanner.isActive !== false}
                          onChange={(e) =>
                            setEditingBanner({ ...editingBanner, isActive: e.target.checked })
                          }
                          className="accent-[#FF4D8D] w-4 h-4"
                        />
                        Active on Homepage
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#EDE8F7]">
                      <button
                        type="button"
                        onClick={() => setEditingBanner(null)}
                        className="px-5 py-2.5 rounded-full border border-[#E2D9F3] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider shadow-md"
                      >
                        Save Banner
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 4. REVIEWS MANAGEMENT (Add, Edit, Approve, Reject, Delete) */}
          {tab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    Customer Reviews ({reviews.length})
                  </h1>
                  <p className="text-xs text-[#64597A] mt-1">
                    Add verified customer reviews, edit ratings/comments, approve or reject pending
                    submissions, or delete reviews.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewReview}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer Review
                </button>
              </div>

              {reviews.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-12 text-center space-y-3">
                  <p className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    No Reviews Yet
                  </p>
                  <p className="text-xs text-[#64597A]">
                    Click &ldquo;Add Customer Review&rdquo; above to add verified customer feedback
                    or wait for shoppers to submit reviews.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-white rounded-3xl border border-[#EDE8F7] p-5 flex flex-col lg:flex-row justify-between gap-4 text-xs shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-[#181326] text-sm">
                            {rev.productName}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[#FF4D8D] font-extrabold">
                            {Array.from({ length: rev.rating }).map((_, idx) => (
                              <Star key={idx} className="w-3.5 h-3.5 fill-[#FF4D8D]" />
                            ))}
                            <span className="ml-1">{rev.rating}/5</span>
                          </span>
                          {rev.isVerifiedPurchase && (
                            <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-extrabold">
                              Verified Purchase
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              rev.status === 'approved'
                                ? 'bg-[#F3EEFF] text-[#7C3AED]'
                                : rev.status === 'rejected'
                                  ? 'bg-red-50 text-[#DC2626]'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {rev.status}
                          </span>
                        </div>
                        {rev.title && <p className="font-bold text-[#181326]">{rev.title}</p>}
                        <p className="text-[#4D4463] leading-relaxed">{rev.comment}</p>
                        <p className="text-[#64597A]">
                          By <strong className="text-[#181326]">{rev.customerName}</strong>
                          {rev.customerEmail ? ` (${rev.customerEmail})` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {rev.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/reviews/${rev.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'approved' }),
                              });
                              notify('Review approved!', 'success');
                              loadTabData('reviews');
                              refreshBootstrap();
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-[#10B981] text-white font-bold"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                        )}
                        {rev.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/reviews/${rev.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'rejected' }),
                              });
                              notify('Review rejected.', 'info');
                              loadTabData('reviews');
                              refreshBootstrap();
                            }}
                            className="px-3.5 py-2 rounded-full border border-[#E2D9F3] text-[#5E5474] font-bold hover:border-[#181326]"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingReview({ ...rev })}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold hover:bg-[#7C3AED] hover:text-white transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/reviews/${rev.id}`, { method: 'DELETE' });
                            notify('Review deleted.', 'info');
                            loadTabData('reviews');
                            refreshBootstrap();
                          }}
                          className="p-2 rounded-full border border-red-200 text-[#DC2626] hover:bg-red-50"
                          title="Delete Review"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Edit Review Modal */}
              {editingReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#181326]/60 backdrop-blur-sm">
                  <form
                    onSubmit={handleSaveReview}
                    className="bg-white rounded-[30px] border border-[#E9DDFC] w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-4 text-xs shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EDE8F7]">
                      <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                        {editingReview.id ? 'Edit Customer Review' : 'Add Customer Review'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingReview(null)}
                        className="p-1.5 rounded-full bg-[#FAFAFF] text-[#64597A]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {!editingReview.id && (
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Select Product *
                        </label>
                        <select
                          required
                          value={editingReview.productId}
                          onChange={(e) =>
                            setEditingReview({
                              ...editingReview,
                              productId: Number(e.target.value),
                            })
                          }
                          className={inputCls}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatINR(p.sellingPrice)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Customer Name *
                        </label>
                        <input
                          required
                          value={editingReview.customerName || ''}
                          onChange={(e) =>
                            setEditingReview({ ...editingReview, customerName: e.target.value })
                          }
                          placeholder="e.g. Ayesha Siddiqui"
                          className={inputCls}
                        />
                      </div>
                      {!editingReview.id && (
                        <div>
                          <label className="block mb-1 font-bold text-[#5E5474]">
                            Customer Email (optional)
                          </label>
                          <input
                            type="email"
                            value={editingReview.customerEmail || ''}
                            onChange={(e) =>
                              setEditingReview({ ...editingReview, customerEmail: e.target.value })
                            }
                            placeholder="ayesha@example.com"
                            className={inputCls}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-[#5E5474]">Star Rating *</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setEditingReview({ ...editingReview, rating: star })}
                            className="p-1.5 rounded-xl bg-[#FAFAFF] border border-[#EDE8F7]"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                star <= Number(editingReview.rating)
                                  ? 'fill-[#FF4D8D] text-[#FF4D8D]'
                                  : 'text-[#D6CEE8]'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="font-extrabold text-[#181326] ml-2">
                          {editingReview.rating} / 5 Stars
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-[#5E5474]">
                        Review Headline
                      </label>
                      <input
                        value={editingReview.title || ''}
                        onChange={(e) =>
                          setEditingReview({ ...editingReview, title: e.target.value })
                        }
                        placeholder="e.g. Gorgeous silk drape and fine Zari work!"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-[#5E5474]">
                        Review Comment *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={editingReview.comment || ''}
                        onChange={(e) =>
                          setEditingReview({ ...editingReview, comment: e.target.value })
                        }
                        placeholder="Write the customer's detailed review..."
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">Status</label>
                        <select
                          value={editingReview.status || 'approved'}
                          onChange={(e) =>
                            setEditingReview({ ...editingReview, status: e.target.value })
                          }
                          className={inputCls}
                        >
                          <option value="approved">Approved (Live on Store)</option>
                          <option value="pending">Pending Moderation</option>
                          <option value="rejected">Rejected (Hidden)</option>
                        </select>
                      </div>
                      <label className="inline-flex items-center gap-2 font-bold text-[#181326] pt-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editingReview.isVerifiedPurchase)}
                          onChange={(e) =>
                            setEditingReview({
                              ...editingReview,
                              isVerifiedPurchase: e.target.checked,
                            })
                          }
                          className="accent-[#10B981] w-4 h-4"
                        />
                        Verified Purchase Badge
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#EDE8F7]">
                      <button
                        type="button"
                        onClick={() => setEditingReview(null)}
                        className="px-5 py-2.5 rounded-full border border-[#E2D9F3] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider shadow-md"
                      >
                        Save Review
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 5. BLOG CMS (Write, Edit & Publish Blogs in EN & HI) */}
          {tab === 'blogs' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    ZARIFLY Blog CMS ({blogs.length})
                  </h1>
                  <p className="text-xs text-[#64597A] mt-1">
                    Write, edit, and publish style guides, Hijab tutorials, and Zardozi stories in
                    English &amp; Hindi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewBlog}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Write New Blog
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-[#EDE8F7] p-4 flex gap-4 items-center text-xs shadow-xs"
                  >
                    <img
                      src={b.featuredImageUrl}
                      alt={b.title}
                      className="w-24 h-24 rounded-2xl object-cover shrink-0 bg-[#FFF0F6]"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[10px] font-extrabold">
                          {b.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            b.isPublished
                              ? 'bg-[#ECFDF5] text-[#059669]'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {b.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="font-serif-display text-lg font-extrabold text-[#181326] line-clamp-1">
                        {b.title}
                      </p>
                      <p className="text-[#64597A] truncate">
                        /blog/{b.slug} · By {b.authorName}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingBlog({ ...b })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold hover:bg-[#7C3AED] hover:text-white transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <Link
                          to={`/blog/${b.slug}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#E2D9F3] text-[#5E5474] font-bold hover:border-[#7C3AED]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Read
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/blogs/${b.id}`, { method: 'DELETE' });
                            notify('Blog article deleted.', 'info');
                            loadTabData('blogs');
                            refreshBootstrap();
                          }}
                          className="p-1.5 rounded-full border border-red-200 text-[#DC2626] hover:bg-red-50"
                          title="Delete Blog"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Write / Edit Blog Modal */}
              {editingBlog && (
                <div className="fixed inset-0 z-50 bg-[#181326]/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <form
                    onSubmit={handleSaveBlog}
                    className="bg-white rounded-[30px] border border-[#E9DDFC] w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-4 text-xs shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EDE8F7]">
                      <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
                        {editingBlog.id ? 'Edit Blog Article' : 'Write New Blog Article'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingBlog(null)}
                        className="p-1.5 rounded-full bg-[#FAFAFF] text-[#64597A]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Article Title (English) *
                        </label>
                        <input
                          required
                          value={editingBlog.title}
                          onChange={(e) =>
                            setEditingBlog({
                              ...editingBlog,
                              title: e.target.value,
                              slug: editingBlog.id ? editingBlog.slug : slugify(e.target.value),
                            })
                          }
                          placeholder="e.g. 5 Effortless Silk Hijab Drapes for Eid"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Article Title (Hindi)
                        </label>
                        <input
                          value={editingBlog.titleHi || ''}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, titleHi: e.target.value })
                          }
                          placeholder="ईद के लिए 5 शानदार सिल्क हिजाब स्टाइल"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">SEO Slug *</label>
                        <input
                          required
                          value={editingBlog.slug}
                          onChange={(e) => setEditingBlog({ ...editingBlog, slug: e.target.value })}
                          placeholder="silk-hijab-drapes-for-eid"
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block mb-1 font-bold text-[#5E5474]">Category</label>
                          <select
                            value={editingBlog.category || 'Modest Fashion'}
                            onChange={(e) =>
                              setEditingBlog({ ...editingBlog, category: e.target.value })
                            }
                            className={inputCls}
                          >
                            {BLOG_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1 font-bold text-[#5E5474]">Author</label>
                          <input
                            value={editingBlog.authorName || 'Sama Shaikh'}
                            onChange={(e) =>
                              setEditingBlog({ ...editingBlog, authorName: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#5E5474]">Featured Cover Image *</label>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold cursor-pointer hover:bg-[#7C3AED] hover:text-white transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingAsset ? 'Uploading...' : 'Upload Image'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleCloudinaryPick(e.target.files?.[0], 'blogs', (url) =>
                                setEditingBlog({ ...editingBlog, featuredImageUrl: url })
                              )
                            }
                          />
                        </label>
                      </div>
                      <input
                        required
                        value={editingBlog.featuredImageUrl}
                        onChange={(e) =>
                          setEditingBlog({ ...editingBlog, featuredImageUrl: e.target.value })
                        }
                        placeholder="Image URL"
                        className={inputCls}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {STUDIO_IMAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() =>
                              setEditingBlog({ ...editingBlog, featuredImageUrl: preset.url })
                            }
                            className="px-2.5 py-1 rounded-full bg-[#FAFAFF] border border-[#E2D9F3] text-[11px] font-semibold text-[#5E5474] hover:border-[#FF4D8D] hover:text-[#FF4D8D]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Short Summary / Excerpt (EN) *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={editingBlog.excerpt}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, excerpt: e.target.value })
                          }
                          placeholder="1-2 sentence hook shown on the blog cards..."
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          Short Summary (Hindi)
                        </label>
                        <textarea
                          rows={2}
                          value={editingBlog.excerptHi || ''}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, excerptHi: e.target.value })
                          }
                          placeholder="हिंदी सारांश (वैकल्पिक)"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-[#5E5474]">
                        Full Blog Content (English) * — separate paragraphs with a blank line
                      </label>
                      <textarea
                        required
                        rows={7}
                        value={editingBlog.content}
                        onChange={(e) =>
                          setEditingBlog({ ...editingBlog, content: e.target.value })
                        }
                        placeholder="Write your full article here..."
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-bold text-[#5E5474]">
                        Full Blog Content (Hindi — optional)
                      </label>
                      <textarea
                        rows={4}
                        value={editingBlog.contentHi || ''}
                        onChange={(e) =>
                          setEditingBlog({ ...editingBlog, contentHi: e.target.value })
                        }
                        placeholder="पूरा लेख हिंदी में लिखें..."
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          SEO Title (optional)
                        </label>
                        <input
                          value={editingBlog.seoTitle || ''}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, seoTitle: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-bold text-[#5E5474]">
                          SEO Meta Description (optional)
                        </label>
                        <input
                          value={editingBlog.seoDescription || ''}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, seoDescription: e.target.value })
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#EDE8F7]">
                      <label className="inline-flex items-center gap-2 font-bold text-[#181326] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingBlog.isPublished !== false}
                          onChange={(e) =>
                            setEditingBlog({ ...editingBlog, isPublished: e.target.checked })
                          }
                          className="accent-[#10B981] w-4 h-4"
                        />
                        Publish Live on Storefront
                      </label>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingBlog(null)}
                          className="px-5 py-2.5 rounded-full border border-[#E2D9F3] font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider shadow-md"
                        >
                          Save Article
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 6. REELS MANAGEMENT (Add + Edit + Delete) */}
          {tab === 'reels' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <div>
                  <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                    Homepage Lookbook Reels ({reels.length})
                  </h1>
                  <p className="text-xs text-[#64597A] mt-1">
                    Manage vertical 9:16 shoppable style reels linked directly to products.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewReel}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Add Reel
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reels.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-3xl border border-[#EDE8F7] p-3 space-y-2.5 text-xs shadow-xs"
                  >
                    <img
                      src={r.thumbnailUrl}
                      alt={r.title}
                      className="aspect-[9/16] w-full rounded-2xl object-cover bg-[#181326]"
                    />
                    <p className="font-bold text-[#181326] truncate">{r.title}</p>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingReel({
                            ...r,
                            productId: r.productId ? String(r.productId) : '',
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F3EEFF] text-[#7C3AED] font-bold"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/reels/${r.id}`, { method: 'DELETE' });
                          notify('Reel deleted.', 'info');
                          loadTabData('reels');
                          refreshBootstrap();
                        }}
                        className="text-[#DC2626] font-bold hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingReel && (
                <div className="fixed inset-0 z-50 bg-[#181326]/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <form
                    onSubmit={handleSaveReel}
                    className="bg-white rounded-[30px] border border-[#E9DDFC] w-full max-w-xl p-6 sm:p-8 space-y-4 text-xs shadow-2xl"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EDE8F7]">
                      <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                        {editingReel.id ? 'Edit Lookbook Reel' : 'Add Lookbook Reel'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingReel(null)}
                        className="p-1.5 rounded-full bg-[#FAFAFF] text-[#64597A]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <input
                      required
                      value={editingReel.title}
                      onChange={(e) => setEditingReel({ ...editingReel, title: e.target.value })}
                      placeholder="Reel Title *"
                      className={inputCls}
                    />
                    <input
                      required
                      value={editingReel.thumbnailUrl}
                      onChange={(e) =>
                        setEditingReel({ ...editingReel, thumbnailUrl: e.target.value })
                      }
                      placeholder="Thumbnail Image URL *"
                      className={inputCls}
                    />
                    <input
                      value={editingReel.videoUrl || ''}
                      onChange={(e) => setEditingReel({ ...editingReel, videoUrl: e.target.value })}
                      placeholder="MP4 Video URL (optional)"
                      className={inputCls}
                    />
                    <select
                      value={editingReel.productId || ''}
                      onChange={(e) =>
                        setEditingReel({ ...editingReel, productId: e.target.value })
                      }
                      className={inputCls}
                    >
                      <option value="">Link to Product (optional)</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editingReel.caption || ''}
                      onChange={(e) => setEditingReel({ ...editingReel, caption: e.target.value })}
                      placeholder="Caption"
                      className={inputCls}
                    />
                    <div className="flex justify-end gap-2 pt-3 border-t border-[#EDE8F7]">
                      <button
                        type="button"
                        onClick={() => setEditingReel(null)}
                        className="px-5 py-2.5 rounded-full border border-[#E2D9F3] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider"
                      >
                        Save Reel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 7. ORDERS MANAGEMENT */}
          {tab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDE8F7] pb-5">
                <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                  Orders Management
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadTabData('orders')}
                    placeholder="Search order # or customer..."
                    className="px-3.5 py-2 rounded-full bg-white border border-[#E2D9F3] outline-none"
                  />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-full bg-white border border-[#E2D9F3]"
                  >
                    <option value="all">All Statuses</option>
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={downloadOrdersCsv}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#181326] bg-white font-bold hover:bg-[#181326] hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-12 text-center text-sm text-[#64597A]">
                  No orders found for the current filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl border border-[#EDE8F7] p-5 space-y-4 text-xs shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#EDE8F7]">
                        <div>
                          <p className="font-extrabold text-sm text-[#181326] tabular-nums">
                            #{order.orderNumber} · {order.customerName}
                          </p>
                          <p className="text-[#64597A]">
                            {order.customerEmail} · {order.customerPhone} ·{' '}
                            {new Date(order.createdAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-extrabold tabular-nums text-[#7C3AED]">
                            {formatINR(order.grandTotal)}
                          </p>
                          <p className="uppercase font-bold text-[#FF4D8D]">
                            {order.paymentMethod} · {order.paymentStatus}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-[11px] font-bold text-[#64597A] mb-1">
                            Order Status
                          </label>
                          <select
                            value={order.orderStatus}
                            onChange={(e) =>
                              handleUpdateOrder(order.id, { orderStatus: e.target.value })
                            }
                            className={`${inputCls} capitalize`}
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#64597A] mb-1">
                            Courier Name
                          </label>
                          <input
                            defaultValue={order.courierName || ''}
                            onBlur={(e) =>
                              handleUpdateOrder(order.id, { courierName: e.target.value })
                            }
                            placeholder="BlueDart / Delhivery"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#64597A] mb-1">
                            Tracking Number
                          </label>
                          <input
                            defaultValue={order.trackingNumber || ''}
                            onBlur={(e) =>
                              handleUpdateOrder(order.id, { trackingNumber: e.target.value })
                            }
                            placeholder="AWB Tracking ID"
                            className={inputCls}
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            to={`/order-confirmation?order=${encodeURIComponent(order.orderNumber)}`}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full border border-[#E2D9F3] font-bold hover:border-[#7C3AED]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Invoice
                          </Link>
                          {order.paymentStatus !== 'refunded' && (
                            <button
                              type="button"
                              onClick={() => handleRefundOrder(order.id)}
                              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full border border-red-200 text-[#DC2626] font-bold hover:bg-red-50"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              Refund
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. CUSTOMERS */}
          {tab === 'customers' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326] border-b border-[#EDE8F7] pb-5">
                Registered Customers ({customers.length})
              </h1>
              <div className="bg-white rounded-3xl border border-[#EDE8F7] overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFF] border-b border-[#EDE8F7] text-[#64597A]">
                    <tr>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Orders</th>
                      <th className="p-4">Total Spent</th>
                      <th className="p-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE8F7]">
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="p-4">
                          <p className="font-bold text-[#181326]">{c.fullName}</p>
                          <p className="text-[#64597A]">{c.email}</p>
                        </td>
                        <td className="p-4">{c.phone || '—'}</td>
                        <td className="p-4 capitalize font-semibold">{c.role}</td>
                        <td className="p-4 tabular-nums">{c.orderCount}</td>
                        <td className="p-4 tabular-nums font-bold">{formatINR(c.totalSpent)}</td>
                        <td className="p-4">
                          {new Date(c.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. COUPONS, SUBSCRIBERS & INQUIRIES */}
          {tab === 'coupons' && (
            <div className="space-y-8">
              <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326] border-b border-[#EDE8F7] pb-5">
                Coupons, Newsletter &amp; Inquiries
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/coupons', {
                    method: 'POST',
                    body: JSON.stringify(newCoupon),
                  });
                  notify('Coupon created!', 'success');
                  setNewCoupon({
                    code: '',
                    description: '',
                    discountType: 'percentage',
                    discountValue: 10,
                    minOrderAmount: 999,
                  });
                  loadTabData('coupons');
                }}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs shadow-xs"
              >
                <input
                  required
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="Code (e.g. FESTIVE15)"
                  className={inputCls}
                />
                <select
                  value={newCoupon.discountType}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                  className={inputCls}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Flat INR (₹)</option>
                </select>
                <input
                  type="number"
                  required
                  value={newCoupon.discountValue}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })
                  }
                  placeholder="Value"
                  className={`${inputCls} tabular-nums`}
                />
                <input
                  type="number"
                  value={newCoupon.minOrderAmount}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, minOrderAmount: Number(e.target.value) })
                  }
                  placeholder="Min Order (₹)"
                  className={`${inputCls} tabular-nums`}
                />
                <button
                  type="submit"
                  className="py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider"
                >
                  Add Coupon
                </button>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-5 space-y-3 shadow-xs">
                  <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    Active Coupons
                  </h2>
                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center py-2 border-b border-[#EDE8F7]"
                    >
                      <div>
                        <p className="font-extrabold text-[#7C3AED]">{c.code}</p>
                        <p className="text-[#64597A]">
                          {c.discountType === 'percentage'
                            ? `${c.discountValue}% off`
                            : `₹${c.discountValue} off`}{' '}
                          · Min ₹{c.minOrderAmount}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
                          loadTabData('coupons');
                        }}
                        className="text-[#DC2626]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-5 space-y-3 shadow-xs">
                  <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    Subscribers ({subscribers.length})
                  </h2>
                  {subscribers.length === 0 ? (
                    <p className="text-[#64597A]">No subscribers yet.</p>
                  ) : (
                    subscribers.map((s) => (
                      <div
                        key={s.id}
                        className="py-1.5 border-b border-[#EDE8F7] flex justify-between"
                      >
                        <span>{s.email}</span>
                        <span className="text-[#64597A]">
                          {new Date(s.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-[#EDE8F7] p-5 space-y-3 shadow-xs">
                  <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    Contact Messages ({messages.length})
                  </h2>
                  {messages.length === 0 ? (
                    <p className="text-[#64597A]">No messages received yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="py-2 border-b border-[#EDE8F7] space-y-1">
                        <p className="font-bold text-[#181326]">
                          {m.name} · {m.subject}
                        </p>
                        <p className="text-[#5E5474]">{m.message}</p>
                        <p className="text-[#64597A]">{m.email}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 10. WEBSITE SETTINGS & AUDIT LOGS */}
          {tab === 'settings' && (
            <div className="space-y-8">
              <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326] border-b border-[#EDE8F7] pb-5">
                Website Settings &amp; Activity Logs
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/settings', {
                    method: 'PUT',
                    body: JSON.stringify(settings),
                  });
                  notify('Storefront settings saved!', 'success');
                  refreshBootstrap();
                }}
                className="bg-white rounded-3xl border border-[#EDE8F7] p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shadow-xs"
              >
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Announcement Bar (English)
                  </label>
                  <input
                    value={settings.announcementEn || ''}
                    onChange={(e) => setSettings({ ...settings, announcementEn: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Announcement Bar (Hindi)
                  </label>
                  <input
                    value={settings.announcementHi || ''}
                    onChange={(e) => setSettings({ ...settings, announcementHi: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Original Zarifly Logo URL (optional)
                  </label>
                  <input
                    value={settings.logoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Founder Sama Shaikh Portrait URL
                  </label>
                  <input
                    value={settings.founderPortraitUrl || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, founderPortraitUrl: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">
                    WhatsApp Support Number
                  </label>
                  <input
                    value={settings.whatsappNumber || ''}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">Official Email</label>
                  <input
                    value={settings.supportEmail || ''}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Free Shipping Threshold (INR)
                  </label>
                  <input
                    type="number"
                    value={settings.freeShippingThreshold ?? 1999}
                    onChange={(e) =>
                      setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })
                    }
                    className={`${inputCls} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5E5474] mb-1">
                    Flat Shipping Fee (INR)
                  </label>
                  <input
                    type="number"
                    value={settings.flatShippingFee ?? 120}
                    onChange={(e) =>
                      setSettings({ ...settings, flatShippingFee: Number(e.target.value) })
                    }
                    className={`${inputCls} tabular-nums`}
                  />
                </div>
                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="px-7 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white uppercase tracking-wider font-extrabold shadow-md"
                  >
                    Save Storefront Settings
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-3xl border border-[#EDE8F7] p-6 space-y-3 text-xs shadow-xs">
                <h2 className="font-serif-display text-2xl font-extrabold text-[#181326] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#FF4D8D]" />
                  Recent Admin Activity Logs
                </h2>
                <div className="divide-y divide-[#EDE8F7]">
                  {logs.length === 0 ? (
                    <p className="text-[#64597A] py-2">No activity logged yet.</p>
                  ) : (
                    logs.map((l) => (
                      <div key={l.id} className="py-2 flex justify-between gap-2">
                        <span>
                          <strong className="text-[#7C3AED]">{l.action}</strong> ({l.entityType} #
                          {l.entityId}) by {l.adminEmail}
                        </span>
                        <span className="text-[#64597A]">
                          {new Date(l.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
