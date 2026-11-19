import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  Download,
  Edit3,
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
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { SEO } from '../components/SEO';
import { ZariflyLogo } from '../components/ZariflyLogo';
import { FiveImageUploader } from '../components/FiveImageUploader';
import type { Banner, BlogPost, Category, Order, Product, ProductImage, ProductVariant, ReelItem, ReviewItem, StoreSettings } from '../types';

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

  // Product Editor Modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Blog Editor Modal
  const [editingBlog, setEditingBlog] = useState<any | null>(null);

  // Banner / Reel / Coupon quick creation states
  const [newBanner, setNewBanner] = useState({
    heading: '',
    headingHi: '',
    subheading: '',
    ctaText: 'Shop Collection',
    ctaUrl: '/shop',
    desktopImageUrl: '',
    mobileImageUrl: '',
    sortOrder: 1,
    isActive: true,
  });
  const [newReel, setNewReel] = useState({
    title: '',
    caption: '',
    videoUrl: '',
    thumbnailUrl: '',
    productId: '',
    sortOrder: 1,
    isActive: true,
  });
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
        const res = await apiRequest<{ reviews: ReviewItem[] }>('/api/admin/reviews');
        setReviews(res.reviews || []);
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

  // Non-admin gate
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] text-sm">Loading...</div>;
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
                Admin Portal
              </h1>
              <p className="text-xs text-[#64597A]">
                Authorized ZARIFLY administrators only. Customer accounts cannot access this panel.
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
      workDetails: 'Handcrafted Gold Zari Border',
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
          colorName: 'Warm Ivory',
          colorHex: '#F3ECE1',
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
        slug:
          editingProduct.slug ||
          editingProduct.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, ''),
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
        notify('Product updated successfully.', 'success');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('New product created.', 'success');
      }
      setEditingProduct(null);
      loadTabData('products');
      refreshBootstrap();
    } catch (err: any) {
      notify(err?.message || 'Unable to save product.', 'error');
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
    const header = ['OrderNumber', 'Date', 'Customer', 'Email', 'Phone', 'TotalINR', 'Payment', 'Status'];
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
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'banners', label: 'Hero Banners', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'reels', label: 'Reels', icon: <Film className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'blogs', label: 'Blog CMS', icon: <BookOpen className="w-4 h-4" /> },
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

      <div className="min-h-screen bg-[#FAF7F2] flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 bg-[#1C1917] text-[#E7E0D5] flex flex-col justify-between shrink-0">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Link to="/">
                <ZariflyLogo size="sm" light />
              </Link>
              <span className="text-[10px] uppercase tracking-wider text-[#C6A25A]">Admin</span>
            </div>

            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors text-left ${
                    tab === item.id
                      ? 'bg-[#C6A25A] text-[#1C1917]'
                      : 'text-[#C2B8AA] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 border-t border-white/10 space-y-3 text-xs">
            <p className="text-[#A39A8E] truncate">{user.email}</p>
            <div className="flex items-center justify-between">
              <Link to="/" className="text-[#E2C686] hover:underline">
                View Store
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 text-[#C2B8AA] hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 p-5 sm:p-8 lg:p-10 overflow-x-hidden space-y-8">
          {/* 1. OVERVIEW */}
          {tab === 'overview' && dashboard && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E6DDD0] pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#8A6B2F]">Boutique Overview</p>
                  <h1 className="font-serif-display text-4xl text-[#1C1917]">Dashboard Analytics</h1>
                </div>
                <div className="text-xs text-[#57534E] space-x-3">
                  <span>
                    PayU:{' '}
                    <strong className={dashboard.integrations.payu.configured ? 'text-[#166534]' : 'text-[#8A6B2F]'}>
                      {dashboard.integrations.payu.configured
                        ? `Connected (${dashboard.integrations.payu.env})`
                        : 'Awaiting Credentials'}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Cloudinary:{' '}
                    <strong className={dashboard.integrations.cloudinary.configured ? 'text-[#166534]' : 'text-[#8A6B2F]'}>
                      {dashboard.integrations.cloudinary.configured
                        ? 'Connected'
                        : 'Awaiting Credentials'}
                    </strong>
                  </span>
                </div>
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
                  <div key={kpi.label} className="bg-white border border-[#E6DDD0] p-5 space-y-1">
                    <p className="text-xs text-[#78716C]">{kpi.label}</p>
                    <p className="font-serif-display text-3xl text-[#1C1917] tabular-nums">
                      {kpi.val}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E6DDD0] p-6 space-y-4">
                  <h2 className="font-serif-display text-2xl text-[#1C1917]">Low Stock Alerts</h2>
                  {dashboard.lowStockVariants.length === 0 ? (
                    <p className="text-xs text-[#78716C]">All product variants have healthy inventory.</p>
                  ) : (
                    <div className="divide-y divide-[#F2ECE1] text-xs">
                      {dashboard.lowStockVariants.map((v: any) => (
                        <div key={v.id} className="py-2.5 flex justify-between gap-2">
                          <div>
                            <p className="font-medium text-[#1C1917]">{v.productName}</p>
                            <p className="text-[#78716C]">
                              {v.colorName} · {v.sizeName} ({v.sku})
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums text-[#991B1B]">
                            {v.stockQuantity} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#E6DDD0] p-6 space-y-4">
                  <h2 className="font-serif-display text-2xl text-[#1C1917]">Recent Orders</h2>
                  {dashboard.recentOrders.length === 0 ? (
                    <p className="text-xs text-[#78716C]">No orders placed yet.</p>
                  ) : (
                    <div className="divide-y divide-[#F2ECE1] text-xs">
                      {dashboard.recentOrders.map((o: Order) => (
                        <div key={o.id} className="py-2.5 flex justify-between gap-2">
                          <div>
                            <p className="font-medium text-[#1C1917] tabular-nums">
                              {o.orderNumber} · {o.customerName}
                            </p>
                            <p className="text-[#78716C] capitalize">
                              {o.orderStatus.replace(/_/g, ' ')} · {o.paymentMethod.toUpperCase()}
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums">
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
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6DDD0] pb-5">
                <div>
                  <h1 className="font-serif-display text-4xl text-[#1C1917]">Product Catalogue</h1>
                  <p className="text-xs text-[#78716C] mt-1">
                    Manage Hijabs, Naqaabs, Dupattas, 5-image galleries, colour/size variants, and stock.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProduct}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#36231C]"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              <div className="bg-white border border-[#E6DDD0] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-[#57534E]">
                    <tr>
                      <th className="p-3.5">Product</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Price</th>
                      <th className="p-3.5">Variants &amp; Stock</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE1]">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.images[0]?.url}
                              alt={p.name}
                              className="w-11 h-11 object-cover bg-[#F4EFE6] border border-[#E6DDD0]"
                            />
                            <div>
                              <p className="font-medium text-[#1C1917]">{p.name}</p>
                              <p className="text-[#78716C] tabular-nums">
                                {p.sku} · {p.images.length} images
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">{p.category?.name}</td>
                        <td className="p-3.5 tabular-nums font-medium">
                          {formatINR(p.sellingPrice)}
                        </td>
                        <td className="p-3.5 tabular-nums">
                          {p.variants.length} variants · {p.totalStock} in stock
                        </td>
                        <td className="p-3.5">
                          {p.isActive ? 'Active' : 'Hidden'}
                          {p.isBestSeller ? ' · Best Seller' : ''}
                          {p.isNewArrival ? ' · New' : ''}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="p-1.5 border border-[#E6DDD0] hover:border-[#1C1917]"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/products/${p.id}`, { method: 'DELETE' });
                              notify('Product deleted.', 'info');
                              loadTabData('products');
                              refreshBootstrap();
                            }}
                            className="p-1.5 border border-[#E6DDD0] text-[#991B1B] hover:border-[#991B1B]"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <form
                    onSubmit={handleSaveProduct}
                    className="bg-white border border-[#E6DDD0] w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-[#EFE8DC]">
                      <h2 className="font-serif-display text-3xl text-[#1C1917]">
                        {editingProduct.id ? 'Edit Product' : 'Create New Product'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="p-1.5 text-[#57534E]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block mb-1 text-[#57534E]">Product Name (EN) *</label>
                        <input
                          required
                          value={editingProduct.name}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Product Name (Hindi)</label>
                        <input
                          value={editingProduct.nameHi || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, nameHi: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Category *</label>
                        <select
                          value={editingProduct.categoryId}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              categoryId: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
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
                          <label className="block mb-1 text-[#57534E]">Master SKU *</label>
                          <input
                            required
                            value={editingProduct.sku}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, sku: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                          />
                        </div>
                        <div>
                          <label className="block mb-1 text-[#57534E]">SEO Slug *</label>
                          <input
                            required
                            value={editingProduct.slug}
                            onChange={(e) =>
                              setEditingProduct({ ...editingProduct, slug: e.target.value })
                            }
                            placeholder="auto-generated-slug"
                            className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Selling Price (INR) *</label>
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
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Original Price (INR) *</label>
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
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Fabric</label>
                        <input
                          value={editingProduct.fabric || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, fabric: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[#57534E]">Embroidery / Work Details</label>
                        <input
                          value={editingProduct.workDetails || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, workDetails: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block mb-1 text-[#57534E]">Description (EN) *</label>
                        <textarea
                          required
                          rows={3}
                          value={editingProduct.description}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, description: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                        />
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-5 text-xs">
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
                            className="accent-[#1C1917]"
                          />
                          <span>{flag.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* 5-Image Simultaneous Cloudinary Uploader */}
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

                    {/* Colour & Size Variant Inventory Matrix */}
                    <div className="space-y-3 pt-2 border-t border-[#EFE8DC]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]">
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
                                  colorName: 'Champagne Gold',
                                  colorHex: '#C6A25A',
                                  sizeName: 'Standard',
                                  priceOverride: null,
                                  stockQuantity: 10,
                                  imageUrl: '',
                                  isActive: true,
                                },
                              ],
                            })
                          }
                          className="text-xs text-[#8A6B2F] underline"
                        >
                          + Add Variant
                        </button>
                      </div>

                      <div className="space-y-2">
                        {editingProduct.variants.map((v: ProductVariant, idx: number) => (
                          <div
                            key={idx}
                            className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#FAF7F2] p-2.5 border border-[#E6DDD0] text-xs"
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
                              className="px-2 py-1.5 bg-white border border-[#DFD3C0]"
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
                              className="px-2 py-1.5 bg-white border border-[#DFD3C0]"
                            />
                            <input
                              type="color"
                              value={v.colorHex}
                              onChange={(e) => {
                                const copy = [...editingProduct.variants];
                                copy[idx] = { ...copy[idx], colorHex: e.target.value };
                                setEditingProduct({ ...editingProduct, variants: copy });
                              }}
                              className="w-full h-8 bg-white border border-[#DFD3C0] p-0.5"
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
                              className="px-2 py-1.5 bg-white border border-[#DFD3C0]"
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
                              className="px-2 py-1.5 bg-white border border-[#DFD3C0] tabular-nums"
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
                                className="w-full px-2 py-1.5 bg-white border border-[#DFD3C0] tabular-nums"
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
                                  className="p-1 text-[#991B1B]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#EFE8DC]">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="px-5 py-2.5 border border-[#DFD3C0] text-xs uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={uploadingImages}
                        className="px-6 py-2.5 bg-[#1C1917] text-white text-xs font-medium uppercase tracking-wider disabled:opacity-45"
                      >
                        {uploadingImages ? 'Uploading Images...' : 'Save Product'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 3. ORDERS MANAGEMENT */}
          {tab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6DDD0] pb-5">
                <h1 className="font-serif-display text-4xl text-[#1C1917]">Orders Management</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadTabData('orders')}
                    placeholder="Search order # or customer..."
                    className="px-3 py-2 bg-white border border-[#DFD3C0]"
                  />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#DFD3C0]"
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#1C1917] bg-white hover:bg-[#FAF7F2]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white border border-[#E6DDD0] p-10 text-center text-sm text-[#78716C]">
                  No orders found for the current filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-white border border-[#E6DDD0] p-5 space-y-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#F2ECE1]">
                        <div>
                          <p className="font-semibold text-sm text-[#1C1917] tabular-nums">
                            #{order.orderNumber} · {order.customerName}
                          </p>
                          <p className="text-[#78716C]">
                            {order.customerEmail} · {order.customerPhone} ·{' '}
                            {new Date(order.createdAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold tabular-nums">
                            {formatINR(order.grandTotal)}
                          </p>
                          <p className="uppercase text-[#8A6B2F]">
                            {order.paymentMethod} · {order.paymentStatus}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-[11px] text-[#78716C] mb-1">Order Status</label>
                          <select
                            value={order.orderStatus}
                            onChange={(e) =>
                              handleUpdateOrder(order.id, { orderStatus: e.target.value })
                            }
                            className="w-full px-2.5 py-2 bg-[#FAF7F2] border border-[#DFD3C0] capitalize"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#78716C] mb-1">Courier Name</label>
                          <input
                            defaultValue={order.courierName || ''}
                            onBlur={(e) =>
                              handleUpdateOrder(order.id, { courierName: e.target.value })
                            }
                            placeholder="BlueDart / Delhivery"
                            className="w-full px-2.5 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#78716C] mb-1">Tracking Number</label>
                          <input
                            defaultValue={order.trackingNumber || ''}
                            onBlur={(e) =>
                              handleUpdateOrder(order.id, { trackingNumber: e.target.value })
                            }
                            placeholder="AWB Tracking ID"
                            className="w-full px-2.5 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            to={`/order-confirmation?order=${encodeURIComponent(order.orderNumber)}`}
                            className="inline-flex items-center gap-1 px-3 py-2 border border-[#E6DDD0] hover:border-[#1C1917]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Invoice
                          </Link>
                          {order.paymentStatus !== 'refunded' && (
                            <button
                              type="button"
                              onClick={() => handleRefundOrder(order.id)}
                              className="inline-flex items-center gap-1 px-3 py-2 border border-[#991B1B] text-[#991B1B] hover:bg-red-50"
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

          {/* 4. CUSTOMERS */}
          {tab === 'customers' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Registered Customers ({customers.length})
              </h1>
              <div className="bg-white border border-[#E6DDD0] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-[#57534E]">
                    <tr>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Orders</th>
                      <th className="p-3.5">Total Spent</th>
                      <th className="p-3.5">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE1]">
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="p-3.5">
                          <p className="font-medium text-[#1C1917]">{c.fullName}</p>
                          <p className="text-[#78716C]">{c.email}</p>
                        </td>
                        <td className="p-3.5">{c.phone || '—'}</td>
                        <td className="p-3.5 capitalize">{c.role}</td>
                        <td className="p-3.5 tabular-nums">{c.orderCount}</td>
                        <td className="p-3.5 tabular-nums font-medium">{formatINR(c.totalSpent)}</td>
                        <td className="p-3.5">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. HERO BANNERS */}
          {tab === 'banners' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Hero Banner Slider
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/banners', {
                    method: 'POST',
                    body: JSON.stringify(newBanner),
                  });
                  notify('Banner added.', 'success');
                  setNewBanner({
                    heading: '',
                    headingHi: '',
                    subheading: '',
                    ctaText: 'Shop Collection',
                    ctaUrl: '/shop',
                    desktopImageUrl: '',
                    mobileImageUrl: '',
                    sortOrder: banners.length + 1,
                    isActive: true,
                  });
                  loadTabData('banners');
                  refreshBootstrap();
                }}
                className="bg-white border border-[#E6DDD0] p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                <input
                  required
                  value={newBanner.heading}
                  onChange={(e) => setNewBanner({ ...newBanner, heading: e.target.value })}
                  placeholder="Banner Heading (English) *"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <input
                  value={newBanner.headingHi}
                  onChange={(e) => setNewBanner({ ...newBanner, headingHi: e.target.value })}
                  placeholder="Banner Heading (Hindi)"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <input
                  required
                  value={newBanner.desktopImageUrl}
                  onChange={(e) => setNewBanner({ ...newBanner, desktopImageUrl: e.target.value })}
                  placeholder="Desktop Banner Image URL *"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <input
                  value={newBanner.ctaUrl}
                  onChange={(e) => setNewBanner({ ...newBanner, ctaUrl: e.target.value })}
                  placeholder="Destination URL (e.g. /collections/hijabs)"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 bg-[#1C1917] text-white uppercase tracking-wider"
                >
                  Add Hero Slide
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map((b) => (
                  <div key={b.id} className="bg-white border border-[#E6DDD0] p-4 space-y-3 text-xs">
                    <img
                      src={b.desktopImageUrl}
                      alt={b.heading}
                      className="aspect-[16/9] w-full object-cover bg-[#F2ECE1]"
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-serif-display text-lg text-[#1C1917]">{b.heading}</p>
                        <p className="text-[#78716C]">{b.ctaUrl}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/banners/${b.id}`, { method: 'DELETE' });
                          loadTabData('banners');
                          refreshBootstrap();
                        }}
                        className="p-2 text-[#991B1B]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. REELS MANAGEMENT */}
          {tab === 'reels' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Homepage Lookbook Reels (9:16)
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/reels', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...newReel,
                      productId: newReel.productId ? Number(newReel.productId) : null,
                    }),
                  });
                  notify('Reel added.', 'success');
                  setNewReel({
                    title: '',
                    caption: '',
                    videoUrl: '',
                    thumbnailUrl: '',
                    productId: '',
                    sortOrder: reels.length + 1,
                    isActive: true,
                  });
                  loadTabData('reels');
                  refreshBootstrap();
                }}
                className="bg-white border border-[#E6DDD0] p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                <input
                  required
                  value={newReel.title}
                  onChange={(e) => setNewReel({ ...newReel, title: e.target.value })}
                  placeholder="Reel Title *"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <input
                  required
                  value={newReel.thumbnailUrl}
                  onChange={(e) => setNewReel({ ...newReel, thumbnailUrl: e.target.value })}
                  placeholder="Thumbnail Image URL *"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <input
                  value={newReel.videoUrl}
                  onChange={(e) => setNewReel({ ...newReel, videoUrl: e.target.value })}
                  placeholder="Cloudinary MP4 Video URL (autoplay muted)"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <select
                  value={newReel.productId}
                  onChange={(e) => setNewReel({ ...newReel, productId: e.target.value })}
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                >
                  <option value="">Link to Product (optional)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newReel.caption}
                  onChange={(e) => setNewReel({ ...newReel, caption: e.target.value })}
                  placeholder="Caption"
                  className="sm:col-span-2 px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 bg-[#1C1917] text-white uppercase tracking-wider"
                >
                  Add Reel
                </button>
              </form>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reels.map((r) => (
                  <div key={r.id} className="bg-white border border-[#E6DDD0] p-3 space-y-2 text-xs">
                    <img
                      src={r.thumbnailUrl}
                      alt={r.title}
                      className="aspect-[9/16] w-full object-cover bg-[#1C1917]"
                    />
                    <p className="font-medium text-[#1C1917] truncate">{r.title}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/reels/${r.id}`, { method: 'DELETE' });
                        loadTabData('reels');
                        refreshBootstrap();
                      }}
                      className="text-[#991B1B] underline"
                    >
                      Delete Reel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. REVIEWS MODERATION */}
          {tab === 'reviews' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Genuine Review Moderation
              </h1>
              {reviews.length === 0 ? (
                <div className="bg-white border border-[#E6DDD0] p-10 text-center text-sm text-[#78716C]">
                  No customer reviews have been submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-white border border-[#E6DDD0] p-5 flex flex-col sm:flex-row justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5">
                        <p className="font-semibold text-[#1C1917]">
                          {rev.productName} · {rev.rating} ★{' '}
                          {rev.isVerifiedPurchase && (
                            <span className="text-[#166534]">· Verified Purchase</span>
                          )}
                        </p>
                        <p className="text-[#44403C]">{rev.comment}</p>
                        <p className="text-[#78716C]">
                          By {rev.customerName} ({rev.customerEmail}) · Status:{' '}
                          <strong className="uppercase">{rev.status}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/reviews/${rev.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'approved' }),
                            });
                            loadTabData('reviews');
                            refreshBootstrap();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#166534] text-white"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/reviews/${rev.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'rejected' }),
                            });
                            loadTabData('reviews');
                          }}
                          className="px-3 py-1.5 border border-[#DFD3C0]"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. BLOG CMS */}
          {tab === 'blogs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#E6DDD0] pb-5">
                <h1 className="font-serif-display text-4xl text-[#1C1917]">Blog Management</h1>
                <button
                  type="button"
                  onClick={() =>
                    setEditingBlog({
                      slug: '',
                      title: '',
                      titleHi: '',
                      excerpt: '',
                      excerptHi: '',
                      content: '',
                      contentHi: '',
                      featuredImageUrl: '/src/assets/images/cat_premium_hijabs_1795097097750.jpg',
                      authorName: 'Sama Shaikh',
                      category: 'Modest Fashion',
                      seoTitle: '',
                      seoDescription: '',
                      isPublished: true,
                    })
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] text-white text-xs uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" /> New Article
                </button>
              </div>

              <div className="space-y-3">
                {blogs.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-[#E6DDD0] p-4 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <p className="font-serif-display text-xl text-[#1C1917]">{b.title}</p>
                      <p className="text-[#78716C]">
                        /blog/{b.slug} · {b.category} · {b.isPublished ? 'Published' : 'Draft'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBlog(b)}
                        className="px-3 py-1.5 border border-[#E6DDD0]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/blogs/${b.id}`, { method: 'DELETE' });
                          loadTabData('blogs');
                        }}
                        className="px-3 py-1.5 border border-[#E6DDD0] text-[#991B1B]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingBlog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (editingBlog.id) {
                        await apiRequest(`/api/admin/blogs/${editingBlog.id}`, {
                          method: 'PUT',
                          body: JSON.stringify(editingBlog),
                        });
                      } else {
                        await apiRequest('/api/admin/blogs', {
                          method: 'POST',
                          body: JSON.stringify(editingBlog),
                        });
                      }
                      setEditingBlog(null);
                      loadTabData('blogs');
                      notify('Blog saved.', 'success');
                    }}
                    className="bg-white border border-[#E6DDD0] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-3 text-xs"
                  >
                    <h2 className="font-serif-display text-2xl">Blog Editor</h2>
                    <input
                      required
                      value={editingBlog.title}
                      onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                      placeholder="Title (EN) *"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                    />
                    <input
                      required
                      value={editingBlog.slug}
                      onChange={(e) => setEditingBlog({ ...editingBlog, slug: e.target.value })}
                      placeholder="SEO Slug *"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                    />
                    <input
                      required
                      value={editingBlog.featuredImageUrl}
                      onChange={(e) =>
                        setEditingBlog({ ...editingBlog, featuredImageUrl: e.target.value })
                      }
                      placeholder="Featured Image URL *"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                    />
                    <textarea
                      required
                      rows={2}
                      value={editingBlog.excerpt}
                      onChange={(e) => setEditingBlog({ ...editingBlog, excerpt: e.target.value })}
                      placeholder="Excerpt *"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                    />
                    <textarea
                      required
                      rows={6}
                      value={editingBlog.content}
                      onChange={(e) => setEditingBlog({ ...editingBlog, content: e.target.value })}
                      placeholder="Article Body *"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingBlog(null)}
                        className="px-4 py-2 border border-[#DFD3C0]"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-2 bg-[#1C1917] text-white">
                        Save Article
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 9. COUPONS, SUBSCRIBERS & INQUIRIES */}
          {tab === 'coupons' && (
            <div className="space-y-8">
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Coupons, Newsletter &amp; Inquiries
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/coupons', {
                    method: 'POST',
                    body: JSON.stringify(newCoupon),
                  });
                  notify('Coupon created.', 'success');
                  setNewCoupon({
                    code: '',
                    description: '',
                    discountType: 'percentage',
                    discountValue: 10,
                    minOrderAmount: 999,
                  });
                  loadTabData('coupons');
                }}
                className="bg-white border border-[#E6DDD0] p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs"
              >
                <input
                  required
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="Code (e.g. FESTIVE15)"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                />
                <select
                  value={newCoupon.discountType}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
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
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                />
                <input
                  type="number"
                  value={newCoupon.minOrderAmount}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, minOrderAmount: Number(e.target.value) })
                  }
                  placeholder="Min Order (₹)"
                  className="px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                />
                <button type="submit" className="py-2 bg-[#1C1917] text-white uppercase tracking-wider">
                  Add Coupon
                </button>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                <div className="bg-white border border-[#E6DDD0] p-5 space-y-3">
                  <h2 className="font-serif-display text-2xl">Active Coupons</h2>
                  {coupons.map((c) => (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b border-[#F2ECE1]">
                      <div>
                        <p className="font-semibold text-[#1C1917]">{c.code}</p>
                        <p className="text-[#78716C]">
                          {c.discountType === 'percentage' ? `${c.discountValue}% off` : `₹${c.discountValue} off`} · Min ₹{c.minOrderAmount}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
                          loadTabData('coupons');
                        }}
                        className="text-[#991B1B]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-[#E6DDD0] p-5 space-y-3">
                  <h2 className="font-serif-display text-2xl">
                    Newsletter Subscribers ({subscribers.length})
                  </h2>
                  {subscribers.length === 0 ? (
                    <p className="text-[#78716C]">No subscribers yet.</p>
                  ) : (
                    subscribers.map((s) => (
                      <div key={s.id} className="py-1.5 border-b border-[#F2ECE1] flex justify-between">
                        <span>{s.email}</span>
                        <span className="text-[#78716C]">
                          {new Date(s.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-white border border-[#E6DDD0] p-5 space-y-3">
                  <h2 className="font-serif-display text-2xl">Contact Messages ({messages.length})</h2>
                  {messages.length === 0 ? (
                    <p className="text-[#78716C]">No messages received yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="py-2 border-b border-[#F2ECE1] space-y-1">
                        <p className="font-medium text-[#1C1917]">
                          {m.name} · {m.subject}
                        </p>
                        <p className="text-[#57534E]">{m.message}</p>
                        <p className="text-[#78716C]">{m.email}</p>
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
              <h1 className="font-serif-display text-4xl text-[#1C1917] border-b border-[#E6DDD0] pb-5">
                Website Settings &amp; Activity Logs
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/settings', {
                    method: 'PUT',
                    body: JSON.stringify(settings),
                  });
                  notify('Storefront settings saved.', 'success');
                  refreshBootstrap();
                }}
                className="bg-white border border-[#E6DDD0] p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
              >
                <div className="sm:col-span-2">
                  <label className="block text-[#57534E] mb-1">Announcement Bar (English)</label>
                  <input
                    value={settings.announcementEn || ''}
                    onChange={(e) => setSettings({ ...settings, announcementEn: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#57534E] mb-1">Announcement Bar (Hindi)</label>
                  <input
                    value={settings.announcementHi || ''}
                    onChange={(e) => setSettings({ ...settings, announcementHi: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">Original Zarifly Logo Image URL (optional)</label>
                  <input
                    value={settings.logoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    placeholder="Cloudinary URL for official Zarifly logo"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">Official Sama Shaikh Founder Portrait URL</label>
                  <input
                    value={settings.founderPortraitUrl || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, founderPortraitUrl: e.target.value })
                    }
                    placeholder="Cloudinary URL for Sama Shaikh portrait"
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">WhatsApp Support Number</label>
                  <input
                    value={settings.whatsappNumber || ''}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">Official Email</label>
                  <input
                    value={settings.supportEmail || ''}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">Free Shipping Threshold (INR)</label>
                  <input
                    type="number"
                    value={settings.freeShippingThreshold ?? 1999}
                    onChange={(e) =>
                      setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] mb-1">Flat Shipping Fee (INR)</label>
                  <input
                    type="number"
                    value={settings.flatShippingFee ?? 120}
                    onChange={(e) =>
                      setSettings({ ...settings, flatShippingFee: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#DFD3C0] tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="px-7 py-3 bg-[#1C1917] text-white uppercase tracking-wider font-medium"
                  >
                    Save Storefront Settings
                  </button>
                </div>
              </form>

              <div className="bg-white border border-[#E6DDD0] p-6 space-y-3 text-xs">
                <h2 className="font-serif-display text-2xl flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#8A6B2F]" />
                  Recent Admin Activity Logs
                </h2>
                <div className="divide-y divide-[#F2ECE1]">
                  {logs.map((l) => (
                    <div key={l.id} className="py-2 flex justify-between gap-2">
                      <span>
                        <strong>{l.action}</strong> ({l.entityType} #{l.entityId}) by {l.adminEmail}
                      </span>
                      <span className="text-[#78716C]">
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
    </>
  );
}
