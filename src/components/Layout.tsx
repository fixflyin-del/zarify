import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  Facebook,
  Heart,
  Home,
  Instagram,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User as UserIcon,
  X,
  Youtube,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import { FOUNDER_SOCIALS } from '../lib/brandAssets';
import { ZariflyLogo } from './ZariflyLogo';
import { QuickViewModal } from './ProductCard';

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    lang,
    setLang,
    t,
    user,
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    updateCartItem,
    removeCartItem,
    wishlistIds,
    bootstrap,
    toasts,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const settings = bootstrap?.settings || {};
  const whatsappNum = (settings.whatsappNumber || '919619586126').replace(/\D/g, '');

  const getWhatsappContextMessage = () => {
    if (location.pathname.startsWith('/products/')) {
      return 'Hello Zarifly, I need help with a product I am viewing on your boutique.';
    }
    if (location.pathname === '/cart' || location.pathname === '/checkout') {
      return 'Hello Zarifly, I have a question regarding my bag and checkout order.';
    }
    if (location.pathname === '/contact-us') {
      return 'Hello Zarifly, I would like to connect with your boutique concierge.';
    }
    return 'Hello Zarifly, I need help with your Hijabs, Naqaabs, and Dupattas collection.';
  };

  const isPdp = location.pathname.startsWith('/products/');
  const isCheckoutOrCart = location.pathname === '/cart' || location.pathname === '/checkout';
  const showFloatingCart = cart.itemCount > 0 && !isPdp && !isCheckoutOrCart;
  const showFloatingWhatsapp =
    location.pathname === '/' ||
    location.pathname.startsWith('/products/') ||
    location.pathname === '/cart' ||
    location.pathname === '/checkout' ||
    location.pathname === '/contact-us' ||
    location.pathname.startsWith('/collections/') ||
    location.pathname === '/shop';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const desktopNavItems = [
    { to: '/', label: t('nav.home') },
    { to: '/shop', label: t('nav.shop') },
    { to: '/collections/hijabs', label: t('nav.hijabs') },
    { to: '/collections/naqaabs', label: t('nav.naqaabs') },
    { to: '/collections/dupattas', label: t('nav.dupattas') },
    { to: '/founder', label: t('nav.founder') },
  ];

  const mobileTabs = [
    {
      key: 'home',
      to: '/',
      label: lang === 'hi' ? 'होम' : 'Home',
      icon: Home,
      active: location.pathname === '/',
      color: 'from-[#FF4D8D] to-[#FF7A59]',
    },
    {
      key: 'explore',
      to: '/shop',
      label: lang === 'hi' ? 'खोजें' : 'Explore',
      icon: Compass,
      active:
        location.pathname === '/shop' ||
        location.pathname.startsWith('/collections/') ||
        location.pathname.startsWith('/products/'),
      color: 'from-[#7C3AED] to-[#EC4899]',
    },
    {
      key: 'wishlist',
      to: '/wishlist',
      label: lang === 'hi' ? 'पसंद' : 'Wishlist',
      icon: Heart,
      badge: wishlistIds.length,
      active: location.pathname === '/wishlist',
      color: 'from-[#FF4D8D] to-[#7C3AED]',
    },
    {
      key: 'orders',
      to: user ? '/account' : '/track-order',
      label: lang === 'hi' ? 'ऑर्डर' : 'Orders',
      icon: Package,
      active:
        location.pathname === '/track-order' ||
        location.pathname === '/order-confirmation',
      color: 'from-[#06B6D4] to-[#7C3AED]',
    },
    {
      key: 'profile',
      to: isAdmin ? '/admin' : user ? '/account' : '/login',
      label: lang === 'hi' ? 'प्रोफ़ाइल' : 'Profile',
      icon: UserIcon,
      active: location.pathname === '/account' || location.pathname === '/login',
      color: 'from-[#FF7A59] to-[#FF4D8D]',
    },
  ];

  const freeShippingPct = Math.min(
    100,
    Math.round((cart.subtotal / Math.max(1, cart.freeShippingThreshold)) * 100)
  );
  const remainingForFreeShipping = Math.max(0, cart.freeShippingThreshold - cart.subtotal);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFF] text-[#181326]">
      {/* Vibrant Crisp Glass Sticky Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-white/94 backdrop-blur-xl shadow-[0_8px_28px_rgba(124,58,237,0.08)] border-b border-[#EDE9FE]'
            : 'bg-white/88 backdrop-blur-md border-b border-[#F3E8FF]'
        }`}
      >
        {/* Mobile App Top Bar (< lg) */}
        <div className="lg:hidden h-14 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#181326] hover:bg-[#F3EEFF] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setSearchOpen((s) => !s)}
              aria-label={t('nav.search')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#181326] hover:bg-[#FFF0F6] transition-colors"
            >
              <Search className="w-[18px] h-[18px]" />
            </motion.button>
          </div>

          <Link to="/" aria-label="ZARIFLY Home" className="flex items-center justify-center">
            <ZariflyLogo size="sm" />
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              aria-label="Switch language"
              className="h-8 px-2.5 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[11px] font-bold tracking-wide hover:bg-[#EDE9FE] transition-colors whitespace-nowrap"
            >
              {lang === 'en' ? 'हिन्दी' : 'EN'}
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              aria-label={t('nav.cart')}
              className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF4D8D] to-[#7C3AED] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(255,77,141,0.35)]"
            >
              <ShoppingBag className="w-[17px] h-[17px]" />
              {cart.itemCount > 0 && (
                <motion.span
                  key={cart.itemCount}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#06B6D4] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white"
                >
                  {cart.itemCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        {/* Desktop Flagship Header (>= lg) */}
        <div className="hidden lg:flex max-w-[1440px] mx-auto px-8 h-[70px] items-center justify-between gap-8">
          <Link to="/" aria-label="ZARIFLY Home" className="shrink-0 group">
            <ZariflyLogo size="md" className="group-hover:scale-[1.03] transition-transform" />
          </Link>

          <nav aria-label="Primary Navigation" className="flex items-center gap-7">
            {desktopNavItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-2 text-[14px] font-semibold tracking-tight whitespace-nowrap shrink-0 transition-colors ${
                    active ? 'text-[#7C3AED]' : 'text-[#4B445C] hover:text-[#FF4D8D]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#7C3AED] to-[#06B6D4]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => setSearchOpen((s) => !s)}
              aria-label={t('nav.search')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#181326] bg-[#FAFAFF] hover:bg-[#FFF0F6] hover:text-[#FF4D8D] transition-colors"
            >
              <Search className="w-[18px] h-[18px]" />
            </motion.button>

            <div
              className="inline-flex items-center rounded-full bg-[#F3EEFF] p-1 text-[11px] font-bold"
              role="group"
              aria-label="Language switcher"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] text-white shadow-xs'
                    : 'text-[#5B5270] hover:text-[#181326]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                  lang === 'hi'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] text-white shadow-xs'
                    : 'text-[#5B5270] hover:text-[#181326]'
                }`}
              >
                हिन्दी
              </button>
            </div>

            <Link
              to={isAdmin ? '/admin' : user ? '/account' : '/login'}
              aria-label={t('nav.account')}
              title={isAdmin ? 'Admin Dashboard' : user ? user.fullName : t('auth.signIn')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#181326] bg-[#FAFAFF] hover:bg-[#ECFEFF] hover:text-[#06B6D4] transition-colors"
            >
              <UserIcon className="w-[18px] h-[18px]" />
            </Link>

            <Link
              to="/wishlist"
              aria-label={t('nav.wishlist')}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#181326] bg-[#FAFAFF] hover:bg-[#FFF0F6] hover:text-[#FF4D8D] transition-colors"
            >
              <Heart className="w-[18px] h-[18px]" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF4D8D] text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
                  {wishlistIds.length}
                </span>
              )}
            </Link>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              aria-label={t('nav.cart')}
              className="inline-flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#9333EA] to-[#7C3AED] text-white text-xs font-bold tracking-wide hover:brightness-105 transition-all shadow-[0_8px_22px_rgba(124,58,237,0.28)] whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('nav.cart')}</span>
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#7C3AED] text-[11px] font-extrabold flex items-center justify-center tabular-nums">
                {cart.itemCount}
              </span>
            </motion.button>
          </div>
        </div>

        {/* Expandable Search Bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16 }}
              className="border-t border-[#EDE9FE] bg-white px-4 py-3"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="max-w-2xl mx-auto flex items-center gap-2.5 bg-[#FAFAFF] border-2 border-[#E9D5FF] focus-within:border-[#7C3AED] rounded-full pl-4 pr-1.5 py-1.5 transition-colors"
              >
                <Search className="w-4 h-4 text-[#7C3AED] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'hi'
                      ? 'हिजाब, नक़ाब, ज़रदोज़ी दुपट्टा खोजें...'
                      : 'Search hijabs, Korean Nidha naqaabs, Zardozi dupattas...'
                  }
                  className="w-full text-sm bg-transparent outline-none text-[#181326] placeholder:text-[#8E84A3]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white hover:brightness-105 transition-all whitespace-nowrap"
                >
                  {t('nav.search')}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#786D8F] hover:bg-[#F3EEFF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Full-Height App Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-[#181326]/55 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-[84vw] max-w-xs h-full bg-white flex flex-col justify-between p-5 overflow-y-auto rounded-r-[30px] shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#F3E8FF]">
                  <ZariflyLogo size="sm" />
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className="w-10 h-10 rounded-full bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="mt-4 flex flex-col gap-1">
                  {[
                    { to: '/', label: t('nav.home') },
                    { to: '/shop', label: t('nav.shop') },
                    { to: '/collections/hijabs', label: t('nav.hijabs') },
                    { to: '/collections/naqaabs', label: t('nav.naqaabs') },
                    { to: '/collections/dupattas', label: t('nav.dupattas') },
                    { to: '/founder', label: t('nav.founder') },
                    { to: '/about-us', label: t('nav.about') },
                    { to: '/blog', label: t('nav.blog') },
                    { to: '/track-order', label: t('nav.trackOrder') },
                    { to: '/contact-us', label: t('nav.contact') },
                    ...(isAdmin ? [{ to: '/admin', label: 'Admin Dashboard' }] : []),
                  ].map((item) => {
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all ${
                          active
                            ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                            : 'text-[#181326] hover:bg-[#F3EEFF]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-5 mt-5 border-t border-[#F3E8FF] space-y-3">
                <div className="flex items-center gap-2.5">
                  <a
                    href={settings.instagramUrl || FOUNDER_SOCIALS.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="w-10 h-10 rounded-full bg-[#FFF0F6] flex items-center justify-center text-[#FF4D8D] hover:scale-105 transition-transform"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a
                    href={settings.facebookUrl || FOUNDER_SOCIALS.facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="w-10 h-10 rounded-full bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED] hover:scale-105 transition-transform"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                  <a
                    href={settings.youtubeUrl || FOUNDER_SOCIALS.youtube}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                    className="w-10 h-10 rounded-full bg-[#FFF4F0] flex items-center justify-center text-[#FF5733] hover:scale-105 transition-transform"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                </div>
                <div className="text-xs text-[#6B6180] space-y-1">
                  <p>WhatsApp: +91 9619586126</p>
                  <p>{settings.supportEmail || 'info@zarifly.com'}</p>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0.9, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Stylish Colourful Dark-Ink Footer */}
      <footer className="bg-[#181326] text-[#ECE7F8] mt-14 pb-24 lg:pb-0 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 right-0 w-96 h-96 rounded-full bg-[#7C3AED]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[#FF4D8D]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-[#06B6D4]/12 blur-3xl"
        />

        <div className="relative max-w-[1440px] mx-auto px-5 sm:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-10 border-b border-white/10">
            <div className="lg:col-span-4 space-y-4">
              <ZariflyLogo size="lg" light />
              <p className="text-sm leading-relaxed text-[#BEB5D4] max-w-sm">
                {t('footer.about')}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href={settings.instagramUrl || FOUNDER_SOCIALS.instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF4D8D] to-[#FF7A59] flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href={settings.facebookUrl || FOUNDER_SOCIALS.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href={settings.youtubeUrl || FOUNDER_SOCIALS.youtube}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF3B5C] to-[#FF7A59] flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-base font-bold text-white mb-4">{t('footer.shop')}</h3>
              <ul className="space-y-2.5 text-sm text-[#BEB5D4]">
                <li>
                  <Link to="/shop" className="hover:text-[#FF4D8D] transition-colors">
                    {t('nav.shop')}
                  </Link>
                </li>
                <li>
                  <Link to="/collections/hijabs" className="hover:text-[#FF4D8D] transition-colors">
                    {t('nav.hijabs')}
                  </Link>
                </li>
                <li>
                  <Link to="/collections/naqaabs" className="hover:text-[#06B6D4] transition-colors">
                    {t('nav.naqaabs')}
                  </Link>
                </li>
                <li>
                  <Link to="/collections/dupattas" className="hover:text-[#FF7A59] transition-colors">
                    {t('nav.dupattas')}
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-[#C084FC] transition-colors">
                    {t('nav.blog')}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h3 className="text-base font-bold text-white mb-4">{t('footer.policies')}</h3>
              <ul className="space-y-2.5 text-sm text-[#BEB5D4]">
                <li>
                  <Link to="/founder" className="hover:text-[#FF4D8D] transition-colors">
                    {t('nav.founder')} — Sama Shaikh
                  </Link>
                </li>
                <li>
                  <Link to="/about-us" className="hover:text-[#FF4D8D] transition-colors">
                    {t('nav.about')}
                  </Link>
                </li>
                <li>
                  <Link to="/track-order" className="hover:text-[#06B6D4] transition-colors">
                    {t('nav.trackOrder')}
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-[#C084FC] transition-colors">
                    {t('footer.faq')}
                  </Link>
                </li>
                <li>
                  <Link to="/shipping-policy" className="hover:text-[#C084FC] transition-colors">
                    {t('footer.shipping')}
                  </Link>
                </li>
                <li>
                  <Link to="/return-refund-policy" className="hover:text-[#C084FC] transition-colors">
                    {t('footer.returns')}
                  </Link>
                </li>
                <li>
                  <Link to="/cancellation-policy" className="hover:text-[#C084FC] transition-colors">
                    {t('footer.cancellation')}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h3 className="text-base font-bold text-white mb-4">{t('footer.connect')}</h3>
              <ul className="space-y-3 text-sm text-[#BEB5D4]">
                <li>
                  <a
                    href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
                      'Hello Zarifly, I need assistance with your boutique collection.'
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:text-[#10B981] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-[#10B981]" />
                    <span>+91 9619586126</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${settings.supportEmail || 'info@zarifly.com'}`}
                    className="hover:text-[#FF4D8D] transition-colors"
                  >
                    {settings.supportEmail || 'info@zarifly.com'}
                  </a>
                </li>
                <li>
                  <Link to="/contact-us" className="hover:text-[#06B6D4] transition-colors">
                    {t('nav.contact')}
                  </Link>
                </li>
                <li className="pt-2 text-xs text-[#9489AE]">
                  <Link to="/privacy-policy" className="hover:text-white transition-colors mr-2.5">
                    {t('footer.privacy')}
                  </Link>
                  <span aria-hidden="true" className="mr-2.5">·</span>
                  <Link to="/terms-and-conditions" className="hover:text-white transition-colors">
                    {t('footer.terms')}
                  </Link>
                </li>
                <li className="pt-1">
                  <Link
                    to="/admin"
                    className="text-xs text-[#9489AE] hover:text-[#FF4D8D] transition-colors"
                  >
                    Boutique Admin Portal
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9489AE]">
            <p>© {new Date().getFullYear()} ZARIFLY by Sama Shaikh. {t('footer.rights')}</p>
            <p>Modern Modest Fashion · Handcrafted in India</p>
          </div>
        </div>
      </footer>

      {/* Mobile Funky 5-Tab Bottom Navigation Bar (< lg) */}
      {!isPdp && (
        <nav
          aria-label="Mobile App Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#EDE9FE] shadow-[0_-8px_28px_rgba(124,58,237,0.1)] pb-safe"
        >
          <div className="grid grid-cols-5 h-16 px-1">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.key}
                  to={tab.to}
                  className="relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-center"
                >
                  {tab.active && (
                    <motion.span
                      layoutId="mobile-tab-pill"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className={`absolute top-1.5 w-11 h-7 rounded-full bg-gradient-to-r ${tab.color} opacity-15`}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    <Icon
                      className={`w-[20px] h-[20px] transition-colors ${
                        tab.active ? 'text-[#7C3AED] stroke-[2.3]' : 'text-[#877D9E] stroke-[1.8]'
                      }`}
                    />
                    {tab.badge && tab.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF4D8D] text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                        {tab.badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`relative z-10 text-[10px] font-bold tracking-tight transition-colors ${
                      tab.active ? 'text-[#7C3AED]' : 'text-[#877D9E]'
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Floating Mobile Shopping Bag Action Pill */}
      <AnimatePresence>
        {showFloatingCart && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="lg:hidden fixed bottom-20 left-4 z-30 inline-flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-[0_10px_28px_rgba(124,58,237,0.38)]"
          >
            <span className="w-6 h-6 rounded-full bg-white text-[#7C3AED] text-xs font-extrabold flex items-center justify-center tabular-nums">
              {cart.itemCount}
            </span>
            <span className="text-xs font-bold tabular-nums">{formatINR(cart.grandTotal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp Concierge Button */}
      {showFloatingWhatsapp && (
        <motion.a
          whileHover={{ y: -2, scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
            getWhatsappContextMessage()
          )}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp Concierge"
          className={`fixed right-4 lg:right-6 z-30 inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 rounded-full bg-[#10B981] text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] hover:bg-[#059669] transition-colors text-xs font-bold ${
            isPdp ? 'bottom-24 lg:bottom-6' : 'bottom-20 lg:bottom-6'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline whitespace-nowrap">{t('whatsapp.help')}</span>
        </motion.a>
      )}

      {/* Slide-Over / Bottom-Sheet Shopping Bag Drawer */}
      <AnimatePresence>
        {cartDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-stretch justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartDrawerOpen(false)}
              className="absolute inset-0 bg-[#181326]/55 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full lg:max-w-md bg-[#FAFAFF] h-[90vh] lg:h-full rounded-t-[32px] lg:rounded-t-none lg:rounded-l-[32px] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="lg:hidden pt-3 pb-1 flex justify-center bg-white">
                <span className="w-10 h-1.5 rounded-full bg-[#E9D5FF]" />
              </div>
              <div className="px-6 py-4 border-b border-[#EDE9FE] flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-xl font-extrabold text-[#181326]">{t('cart.title')}</h2>
                  <p className="text-xs text-[#6B6180] tabular-nums">
                    {cart.itemCount} {cart.itemCount === 1 ? 'piece' : 'pieces'} selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  aria-label="Close bag"
                  className="w-10 h-10 rounded-full bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED] hover:bg-[#EDE9FE]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.items.length > 0 && (
                <div className="px-6 py-3 bg-gradient-to-r from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] border-b border-[#EDE9FE] space-y-1.5">
                  <p className="text-xs font-semibold text-[#181326]">
                    {remainingForFreeShipping > 0 ? (
                      <>
                        Add{' '}
                        <strong className="text-[#FF4D8D] tabular-nums">
                          {formatINR(remainingForFreeShipping)}
                        </strong>{' '}
                        more for FREE delivery
                      </>
                    ) : (
                      t('cart.freeShippingUnlocked')
                    )}
                  </p>
                  <div className="h-2 rounded-full bg-white overflow-hidden">
                    <div
                      style={{ width: `${freeShippingPct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#7C3AED] to-[#06B6D4] transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3.5">
                {cart.items.length === 0 ? (
                  <div className="py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-[#FFF0F6] mx-auto flex items-center justify-center">
                      <ShoppingBag className="w-7 h-7 text-[#FF4D8D]" />
                    </div>
                    <p className="text-sm text-[#6B6180]">{t('cart.empty')}</p>
                    <Link
                      to="/shop"
                      onClick={() => setCartDrawerOpen(false)}
                      className="inline-block px-7 py-3 rounded-full text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-md"
                    >
                      {t('cart.continue')}
                    </Link>
                  </div>
                ) : (
                  cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3.5 p-3.5 rounded-2xl bg-white shadow-xs border border-[#EDE9FE]"
                    >
                      <Link
                        to={`/products/${item.productSlug}`}
                        onClick={() => setCartDrawerOpen(false)}
                        className="w-20 h-20 rounded-xl bg-[#FFF0F6] shrink-0 overflow-hidden"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/products/${item.productSlug}`}
                            onClick={() => setCartDrawerOpen(false)}
                            className="text-sm font-bold text-[#181326] hover:text-[#7C3AED] truncate"
                          >
                            {item.productName}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            aria-label={t('cart.remove')}
                            className="text-[#9C91B4] hover:text-[#E11D48] p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-[#6B6180] mt-0.5">
                          {item.colorName} · {item.sizeName}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full bg-[#F3EEFF] p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                item.quantity > 1
                                  ? updateCartItem(item.id, { quantity: item.quantity - 1 })
                                  : removeCartItem(item.id)
                              }
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[#7C3AED] hover:bg-white"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= item.stockQuantity}
                              onClick={() =>
                                updateCartItem(item.id, { quantity: item.quantity + 1 })
                              }
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[#7C3AED] hover:bg-white disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-extrabold tabular-nums text-[#181326]">
                            {formatINR(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.items.length > 0 && (
                <div className="p-5 bg-white border-t border-[#EDE9FE] space-y-4">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-[#6B6180]">
                      <span>{t('cart.subtotal')}</span>
                      <span className="tabular-nums">{formatINR(cart.subtotal)}</span>
                    </div>
                    {cart.discountAmount > 0 && (
                      <div className="flex justify-between text-[#FF4D8D] font-semibold">
                        <span>{t('cart.discount')}</span>
                        <span className="tabular-nums">-{formatINR(cart.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6B6180]">
                      <span>{t('cart.shipping')}</span>
                      <span className="tabular-nums">
                        {cart.shippingFee === 0 ? t('cart.free') : formatINR(cart.shippingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-[#181326] pt-2 border-t border-[#F3E8FF]">
                      <span>{t('cart.total')}</span>
                      <span className="tabular-nums">{formatINR(cart.grandTotal)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      to="/cart"
                      onClick={() => setCartDrawerOpen(false)}
                      className="py-3.5 rounded-full text-center text-xs font-bold uppercase tracking-wider border-2 border-[#181326] text-[#181326] hover:bg-[#F3EEFF] transition-colors"
                    >
                      View Bag
                    </Link>
                    <Link
                      to="/checkout"
                      onClick={() => setCartDrawerOpen(false)}
                      className="py-3.5 rounded-full text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white hover:brightness-105 transition-all shadow-md"
                    >
                      {t('cart.checkout')}
                    </Link>
                  </div>
                </div>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <QuickViewModal />

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 lg:bottom-6 lg:top-auto lg:left-6 lg:right-auto z-50 space-y-2 max-w-xs sm:max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`pointer-events-auto px-4 py-3 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md ${
                toast.tone === 'error'
                  ? 'bg-[#E11D48] text-white'
                  : toast.tone === 'success'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] text-white'
                    : 'bg-white text-[#181326] border border-[#EDE9FE]'
              }`}
            >
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
