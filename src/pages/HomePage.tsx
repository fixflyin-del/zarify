import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Flame,
  Instagram,
  LayoutGrid,
  Mail,
  Quote,
  Sparkles,
  Star,
  Youtube,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiRequest } from '../lib/api';
import { FOUNDER_SOCIALS, OFFICIAL_FOUNDER_PORTRAIT } from '../lib/brandAssets';
import { SEO } from '../components/SEO';
import { ProductCard } from '../components/ProductCard';
import { ReelsSection } from '../components/ReelsSection';
import type { Product } from '../types';

const SIGNATURE_CRAFT = [
  {
    num: '01',
    title: 'Zari Work',
    titleHi: 'ज़री कारीगरी',
    desc: 'Fine metallic threads woven along scalloped borders for modern festive luminosity.',
    descHi: 'किनारों पर महीन ज़री के धागों से बुनी गई उत्कृष्ट बेल।',
    accent: 'bg-gradient-to-br from-[#FF4D8D] to-[#FF7A59] text-white',
    cardHover: 'hover:border-[#FF4D8D]/50',
  },
  {
    num: '02',
    title: 'Zardozi',
    titleHi: 'ज़रदोज़ी कढ़ाई',
    desc: 'Hand-worked bullion dabka wire and micro pearls stitched on wooden adda frames.',
    descHi: 'कुशल कारीगरों द्वारा लकड़ी के अड्डे पर हाथ से की गई पारंपरिक दबका और मोती कढ़ाई।',
    accent: 'bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white',
    cardHover: 'hover:border-[#7C3AED]/50',
  },
  {
    num: '03',
    title: 'Handcrafted Hijabs',
    titleHi: 'हस्तनिर्मित हिजाब',
    desc: 'Featherlight silk-chiffon and modal blends calibrated for effortless drape all day.',
    descHi: 'हल्के सिल्क-शिफॉन और मोडल ब्लेंड जो दिनभर आराम और स्टाइल दें।',
    accent: 'bg-gradient-to-br from-[#06B6D4] to-[#0EA5E9] text-white',
    cardHover: 'hover:border-[#06B6D4]/50',
  },
  {
    num: '04',
    title: 'Designer Dupattas',
    titleHi: 'डिज़ाइनर दुपट्टे',
    desc: 'Statement organza and crushed tissue dupattas finished with Nakashi florals and tassels.',
    descHi: 'नक्काशी और हस्तनिर्मित मोतियों वाले शाही ऑर्गेंज़ा और टिश्यू दुपट्टे।',
    accent: 'bg-gradient-to-br from-[#FF7A59] to-[#EC4899] text-white',
    cardHover: 'hover:border-[#FF7A59]/50',
  },
];

const CATEGORY_CHIP_STYLES = [
  {
    bg: 'bg-[#FFF0F6] hover:bg-[#FFE0EE]',
    border: 'border-[#FF4D8D]/35 hover:border-[#FF4D8D]',
    text: 'text-[#C81D63]',
    ring: 'ring-[#FF4D8D]/40',
    dot: 'bg-[#FF4D8D]',
  },
  {
    bg: 'bg-[#F3EEFF] hover:bg-[#E7DCFF]',
    border: 'border-[#7C3AED]/35 hover:border-[#7C3AED]',
    text: 'text-[#5B21B6]',
    ring: 'ring-[#7C3AED]/40',
    dot: 'bg-[#7C3AED]',
  },
  {
    bg: 'bg-[#ECFEFF] hover:bg-[#D2FAFF]',
    border: 'border-[#06B6D4]/35 hover:border-[#06B6D4]',
    text: 'text-[#0E7490]',
    ring: 'ring-[#06B6D4]/40',
    dot: 'bg-[#06B6D4]',
  },
];

export function HomePage() {
  const { bootstrap, bootstrapLoading, lang, t, notify } = useStore();
  const [slideIdx, setSlideIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [trendingTab, setTrendingTab] = useState<'all' | 'hijabs' | 'naqaabs' | 'dupattas'>('all');
  const [trendingPage, setTrendingPage] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNews, setSubmittingNews] = useState(false);

  const heroTouchStartX = useRef<number | null>(null);
  const trendingTrackRef = useRef<HTMLDivElement | null>(null);

  const banners = bootstrap?.banners || [];
  const categories = bootstrap?.categories || [];
  const bestSellers = bootstrap?.bestSellers || [];
  const newArrivals = bootstrap?.newArrivals || [];
  const reels = bootstrap?.reels || [];
  const reviews = bootstrap?.reviews || [];
  const settings = bootstrap?.settings || {};

  // Combine unique real DB products for the trending carousel
  const allTrendingProducts: Product[] = Array.from(
    new Map([...bestSellers, ...newArrivals].map((p) => [p.id, p])).values()
  );

  const filteredTrending =
    trendingTab === 'all'
      ? allTrendingProducts
      : allTrendingProducts.filter((p) => p.category?.slug === trendingTab);

  const displayedTrending =
    filteredTrending.length > 0 ? filteredTrending : allTrendingProducts;

  // Auto-slide Slim Top Banner
  useEffect(() => {
    if (banners.length <= 1 || heroPaused) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % banners.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [banners.length, heroPaused]);

  useEffect(() => {
    setTrendingPage(0);
    if (trendingTrackRef.current) {
      trendingTrackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [trendingTab]);

  const currentBanner = banners[slideIdx] || null;
  const founderPortraitSrc =
    settings.founderPortraitUrl?.trim() || OFFICIAL_FOUNDER_PORTRAIT;

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    heroTouchStartX.current = e.touches[0].clientX;
  };

  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    if (heroTouchStartX.current === null || banners.length <= 1) return;
    const dx = e.changedTouches[0].clientX - heroTouchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) setSlideIdx((i) => (i + 1) % banners.length);
      else setSlideIdx((i) => (i - 1 + banners.length) % banners.length);
    }
    heroTouchStartX.current = null;
  };

  const scrollTrending = (dir: -1 | 1) => {
    const el = trendingTrackRef.current;
    if (!el) return;
    const step = Math.max(260, el.clientWidth * 0.72);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const handleTrendingScroll = () => {
    const el = trendingTrackRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollWidth - el.clientWidth);
    const totalDots = Math.max(1, Math.min(4, displayedTrending.length));
    const idx = Math.min(totalDots - 1, Math.round((el.scrollLeft / maxScroll) * (totalDots - 1)));
    setTrendingPage(idx);
  };

  const scrollTrendingToDot = (idx: number) => {
    const el = trendingTrackRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const totalDots = Math.max(1, Math.min(4, displayedTrending.length));
    const target = totalDots > 1 ? (idx / (totalDots - 1)) * maxScroll : 0;
    el.scrollTo({ left: target, behavior: 'smooth' });
    setTrendingPage(idx);
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    try {
      setSubmittingNews(true);
      await apiRequest('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail.trim() }),
      });
      setNewsletterEmail('');
      notify(t('home.newsletterSuccess'), 'success');
    } catch (err: any) {
      notify(err?.message || t('common.errorGeneric'), 'error');
    } finally {
      setSubmittingNews(false);
    }
  };

  const trendingDotCount = Math.max(1, Math.min(4, displayedTrending.length));

  return (
    <>
      <SEO
        title="ZARIFLY — Modern Modest Fashion, Handcrafted Hijabs, Naqaabs & Dupattas"
        description="Shop colourful handcrafted Zari, Zardozi, and Nakashi embroidered hijabs, breathable Korean Nidha naqaabs, and designer dupattas by Sama Shaikh."
        canonicalPath="/"
        image="/src/assets/images/hero_zari_hijab_1795097056066.jpg"
      />

      {/* SECTION A: SLIM ULTRA-COMPACT TOP BANNER SLIDER (~100x400 WIDE STRIP FEEL) */}
      <section className="bg-[#FAFAFF] pt-2.5 sm:pt-4 pb-1">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-8">
          <div
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
            className="relative w-full h-[112px] sm:h-[148px] lg:h-[178px] rounded-[20px] sm:rounded-[26px] bg-gradient-to-r from-[#181326] via-[#4C1D95] to-[#BE185D] overflow-hidden shadow-[0_12px_32px_rgba(124,58,237,0.18)]"
          >
            {bootstrapLoading || !currentBanner ? (
              <div className="w-full h-full animate-pulse bg-gradient-to-r from-[#7C3AED]/40 via-[#FF4D8D]/40 to-[#06B6D4]/40" />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentBanner.id}
                  initial={{ opacity: 0.25, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.25 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  <picture>
                    {currentBanner.mobileImageUrl && (
                      <source media="(max-width: 640px)" srcSet={currentBanner.mobileImageUrl} />
                    )}
                    <img
                      src={currentBanner.desktopImageUrl}
                      alt={currentBanner.heading}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                  </picture>

                  {/* Funky Stylish Colourful Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#181326]/92 via-[#4C1D95]/65 to-[#FF4D8D]/35" />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#06B6D4]/30 blur-2xl"
                  />

                  <div className="relative h-full px-4 sm:px-10 lg:px-14 flex items-center justify-between gap-3 sm:gap-6">
                    <div className="min-w-0 max-w-2xl text-white space-y-1 sm:space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[9px] sm:text-[10px] font-bold tracking-[0.14em] uppercase text-[#67E8F9]">
                        <Sparkles className="w-2.5 h-2.5 text-[#FF9EC2]" />
                        {t('hero.kicker')}
                      </span>

                      <h1 className="font-serif-display text-base sm:text-2xl lg:text-[32px] font-extrabold leading-tight text-white line-clamp-1 sm:line-clamp-2 drop-shadow-xs">
                        {lang === 'hi' && currentBanner.headingHi
                          ? currentBanner.headingHi
                          : currentBanner.heading}
                      </h1>

                      {(currentBanner.subheading || currentBanner.subheadingHi) && (
                        <p className="hidden md:block text-xs lg:text-sm text-white/85 line-clamp-1 max-w-xl">
                          {lang === 'hi' && currentBanner.subheadingHi
                            ? currentBanner.subheadingHi
                            : currentBanner.subheading}
                        </p>
                      )}
                    </div>

                    <Link
                      to={currentBanner.ctaUrl || '/shop'}
                      className="group shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-[11px] sm:text-xs font-extrabold tracking-wide uppercase shadow-[0_8px_22px_rgba(255,77,141,0.45)] hover:brightness-110 transition-all"
                    >
                      <span className="whitespace-nowrap">
                        {lang === 'hi' && currentBanner.ctaTextHi
                          ? currentBanner.ctaTextHi
                          : currentBanner.ctaText}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Slim Banner Compact Arrows & Animated Colourful Dots */}
            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSlideIdx((i) => (i - 1 + banners.length) % banners.length)}
                  aria-label="Previous banner slide"
                  className="hidden sm:flex absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/18 backdrop-blur-md text-white border border-white/25 items-center justify-center hover:bg-[#FF4D8D] hover:border-[#FF4D8D] transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((i) => (i + 1) % banners.length)}
                  aria-label="Next banner slide"
                  className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/18 backdrop-blur-md text-white border border-white/25 items-center justify-center hover:bg-[#FF4D8D] hover:border-[#FF4D8D] transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-[#181326]/45 backdrop-blur-md px-2.5 py-1 rounded-full">
                  {banners.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSlideIdx(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === slideIdx
                          ? 'w-6 bg-gradient-to-r from-[#FF4D8D] to-[#06B6D4]'
                          : 'w-1.5 bg-white/55 hover:bg-white/90'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* SECTION B: HORIZONTAL COMPACT FUNKY CATEGORY BUTTONS STRIP */}
      <section className="bg-[#FAFAFF] pt-2.5 pb-4 sm:py-4">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-8">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1">
            {/* All Shop Chip */}
            <Link
              to="/shop"
              className="group shrink-0 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-[0_6px_18px_rgba(255,77,141,0.3)] hover:brightness-105 transition-all"
            >
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4 text-white" />
              </span>
              <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                {lang === 'hi' ? 'सभी देखें' : 'All Styles'}
              </span>
            </Link>

            {/* Real Categories (Hijabs, Naqaabs, Dupattas) as Compact Horizontal Buttons */}
            {categories.map((cat, idx) => {
              const style = CATEGORY_CHIP_STYLES[idx % CATEGORY_CHIP_STYLES.length];
              return (
                <Link
                  key={cat.id}
                  to={`/collections/${cat.slug}`}
                  className={`group shrink-0 inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full border transition-all shadow-xs ${style.bg} ${style.border}`}
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden ring-2 shrink-0 ${style.ring}`}>
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <span className={`text-xs sm:text-sm font-bold whitespace-nowrap ${style.text}`}>
                    {lang === 'hi' && cat.nameHi ? cat.nameHi : cat.name}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} opacity-75`} />
                </Link>
              );
            })}

            {/* Quick Funky Discovery Chips */}
            <Link
              to="/shop?newArrival=true"
              className="shrink-0 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-[#FFF4F0] hover:bg-[#FFE6DC] border border-[#FF7A59]/35 hover:border-[#FF7A59] text-[#C2410C] transition-all shadow-xs"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7A59] to-[#FF4D8D] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                {lang === 'hi' ? 'नए स्टाइल्स' : 'New Drops'}
              </span>
            </Link>

            <Link
              to="/shop?sort=bestselling"
              className="shrink-0 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-[#FDF2F8] hover:bg-[#FCE7F3] border border-[#EC4899]/35 hover:border-[#EC4899] text-[#BE185D] transition-all shadow-xs"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EC4899] to-[#7C3AED] text-white flex items-center justify-center shrink-0">
                <Flame className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                {lang === 'hi' ? 'ट्रेंडिंग' : 'Best Sellers'}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION C: TRENDING COLLECTIONS HORIZONTAL CAROUSEL (ABOVE THE FOLD!) */}
      <section className="py-8 sm:py-14 bg-gradient-to-b from-[#FFF0F6]/55 via-[#FAFAFF] to-[#F3EEFF]/55 border-y border-[#E9DDFC]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 sm:mb-8">
            <div className="space-y-1">
              <p className="text-[11px] font-extrabold tracking-[0.2em] uppercase text-[#FF4D8D]">
                Trending Now · Fresh Drops
              </p>
              <h2 className="font-serif-display text-2xl sm:text-4xl font-extrabold text-[#181326]">
                {t('home.bestSellersTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-[#64597A]">{t('home.bestSellersSub')}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
              {/* Funky Colourful Category Filter Tabs */}
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-[#E9DDFC] shadow-xs overflow-x-auto max-w-full no-scrollbar">
                {[
                  { id: 'all', label: lang === 'hi' ? 'सभी' : 'All' },
                  { id: 'hijabs', label: t('nav.hijabs') },
                  { id: 'naqaabs', label: t('nav.naqaabs') },
                  { id: 'dupattas', label: t('nav.dupattas') },
                ].map((item) => {
                  const active = trendingTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTrendingTab(item.id as any)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                        active
                          ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                          : 'text-[#64597A] hover:text-[#7C3AED]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Desktop Carousel Arrows */}
              <div className="hidden md:flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => scrollTrending(-1)}
                  aria-label="Scroll products left"
                  className="w-10 h-10 rounded-full bg-white border border-[#E2D9F3] text-[#181326] flex items-center justify-center hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] hover:text-white hover:border-transparent transition-all shadow-xs"
                >
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => scrollTrending(1)}
                  aria-label="Scroll products right"
                  className="w-10 h-10 rounded-full bg-white border border-[#E2D9F3] text-[#181326] flex items-center justify-center hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] hover:text-white hover:border-transparent transition-all shadow-xs"
                >
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>

          {bootstrapLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="aspect-[3/4] rounded-[24px] bg-white/80 animate-pulse border border-[#EDE8F7]"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Horizontal Swipe Carousel: ~2 products visible on mobile, 4 on desktop */}
              <div
                ref={trendingTrackRef}
                onScroll={handleTrendingScroll}
                className="flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory pb-3 no-scrollbar"
              >
                {displayedTrending.map((product, index) => (
                  <div
                    key={product.id}
                    className="w-[46vw] min-w-[164px] sm:w-[44vw] md:w-[31%] lg:w-[calc(25%-15px)] shrink-0 snap-start"
                  >
                    <ProductCard product={product} index={index} />
                  </div>
                ))}
              </div>

              {/* Animated Carousel Pagination Dots + View All */}
              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: trendingDotCount }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => scrollTrendingToDot(idx)}
                      aria-label={`Carousel page ${idx + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === trendingPage
                          ? 'w-8 bg-gradient-to-r from-[#FF4D8D] via-[#7C3AED] to-[#06B6D4]'
                          : 'w-2 bg-[#D6CBEB] hover:bg-[#FF4D8D]'
                      }`}
                    />
                  ))}
                </div>
                <Link
                  to="/shop"
                  className="text-xs font-extrabold tracking-[0.1em] uppercase text-[#7C3AED] hover:text-[#FF4D8D] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>{t('home.viewAll')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* SECTION D: ZARIFLY SIGNATURE COLLECTION (FUNKY COLOURFUL EDITORIAL SECTION) */}
      <section className="py-14 sm:py-22 bg-gradient-to-br from-[#F3EEFF] via-[#FFFFFF] to-[#ECFEFF] relative overflow-hidden">
        {/* Animated Funky Floating Shapes */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
          className="pointer-events-none absolute top-14 right-[10%] w-16 h-16 rounded-full border-2 border-[#FF4D8D]/40"
        />
        <motion.div
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-16 left-[5%] w-32 h-32 rounded-full bg-[#06B6D4]/20 blur-2xl"
        />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Layered Editorial Fashion Photography */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55 }}
              className="lg:col-span-6 relative pb-10 sm:pb-12"
            >
              <div className="relative rounded-[30px] overflow-hidden shadow-[0_24px_60px_rgba(124,58,237,0.16)] border-4 border-white aspect-[4/3]">
                <img
                  src="/src/assets/images/craft_zardozi_macro_1795097056186.jpg"
                  alt="Zarifly Signature Zari and Zardozi hand embroidery detail"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Layered Overlapping Fashion Inset */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="absolute -bottom-2 right-3 sm:right-6 w-36 sm:w-48 aspect-square rounded-[24px] overflow-hidden border-4 border-white shadow-[0_18px_40px_rgba(255,77,141,0.22)] bg-[#FFF0F6]"
              >
                <img
                  src="/src/assets/images/prod_dupatta_rose_nakashi_1795097080211.jpg"
                  alt="Rose Nakashi Designer Dupatta"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* Funky Colourful Accent Dots */}
              <div
                aria-hidden="true"
                className="hidden sm:grid grid-cols-3 gap-2.5 absolute -top-5 -left-4"
              >
                {[0, 1, 2, 3, 4, 5].map((d) => (
                  <span
                    key={d}
                    className={`w-2.5 h-2.5 rounded-full ${
                      d % 3 === 0
                        ? 'bg-[#FF4D8D]'
                        : d % 3 === 1
                          ? 'bg-[#7C3AED]'
                          : 'bg-[#06B6D4]'
                    }`}
                  />
                ))}
              </div>
            </motion.div>

            {/* Right Editorial Story & 4 Signature Highlights */}
            <div className="lg:col-span-6 space-y-7">
              <div className="space-y-2.5">
                <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
                  Zarifly Signature Collection
                </p>
                <h2 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-[#181326] leading-tight">
                  {t('home.craftTitle')}
                </h2>
                <p className="text-sm sm:text-base text-[#5E5474] leading-relaxed">
                  {t('home.craftSub')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SIGNATURE_CRAFT.map((item, idx) => (
                  <motion.div
                    key={item.num}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.08, duration: 0.4 }}
                    className={`bg-white/95 backdrop-blur-xs rounded-[22px] p-5 border border-[#EDE8F7] shadow-[0_6px_22px_rgba(24,19,38,0.05)] ${item.cardHover} transition-colors space-y-2.5`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-extrabold tabular-nums shadow-sm ${item.accent}`}
                    >
                      {item.num}
                    </span>
                    <h3 className="font-serif-display text-xl font-bold text-[#181326]">
                      {lang === 'hi' ? item.titleHi : item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-[#64597A] leading-relaxed">
                      {lang === 'hi' ? item.descHi : item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div>
                <Link
                  to="/collections/dupattas"
                  className="inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] text-white text-xs font-extrabold tracking-[0.12em] uppercase hover:brightness-110 transition-all shadow-[0_12px_28px_rgba(124,58,237,0.28)]"
                >
                  <span>Explore Signature Craftsmanship</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION E: ZARIFLY REELS (VERTICAL 9:16 VIDEO CAROUSEL) */}
      <ReelsSection reels={reels} />

      {/* SECTION F: FOUNDER SPOTLIGHT — SAMA SHAIKH (ACTUAL SUPPLIED PORTRAIT) */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] relative overflow-hidden">
        {/* Animated Colourful Background Glows */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-[8%] w-80 h-80 rounded-full bg-[#FF4D8D]/25 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-[5%] w-80 h-80 rounded-full bg-[#06B6D4]/25 blur-3xl"
        />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="bg-white/90 backdrop-blur-md rounded-[34px] p-6 sm:p-10 lg:p-14 border border-[#E9DDFC] shadow-[0_24px_65px_rgba(124,58,237,0.1)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Asymmetric Framed Portrait of Sama Shaikh */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55 }}
                className="lg:col-span-5 relative flex justify-center"
              >
                {/* Animated Violet-Pink Orbital Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-3 sm:-inset-4 rounded-[40px] border-2 border-dashed border-[#FF4D8D]/45"
                />

                {/* Animated Funky Corner Dots */}
                <motion.span
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-4 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#FF7A59] shadow-md z-10"
                />
                <motion.span
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-3 -left-3 w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] shadow-md z-10"
                />

                <div className="relative w-full max-w-[420px] aspect-square rounded-[30px] overflow-hidden border-[5px] border-white shadow-[0_20px_50px_rgba(24,19,38,0.16)] bg-[#F3EEFF]">
                  <img
                    src={founderPortraitSrc}
                    alt="Sama Shaikh — Founder & Face of ZARIFLY"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#181326]/80 via-[#181326]/20 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white">
                    <div>
                      <p className="font-serif-display text-2xl font-extrabold leading-none">
                        Sama Shaikh
                      </p>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#67E8F9] mt-1">
                        Founder · ZARIFLY
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Founder Story & Official Social Buttons */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="h-[3px] w-10 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED]" />
                  <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
                    Founder &amp; Creative Director
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h2 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-[#181326] leading-[1.08]">
                    {lang === 'hi' ? 'ZARIFLY का चेहरा — समा शेख' : 'Meet the Face Behind Zarifly'}
                  </h2>
                  <p className="font-serif-display text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] bg-clip-text text-transparent">
                    Sama Shaikh
                  </p>
                </div>

                <p className="text-base sm:text-lg text-[#3D3452] leading-relaxed max-w-2xl">
                  {lang === 'hi'
                    ? 'ZARIFLY की कहानी जानें, जहाँ आधुनिक शालीनता और पारंपरिक भारतीय हस्तकला की ख़ूबसूरती एक साथ मिलती है।'
                    : 'Discover the story behind Zarifly, where modest elegance meets the beauty of traditional craftsmanship.'}
                </p>

                <p className="text-sm text-[#64597A] leading-relaxed max-w-2xl">
                  {t('home.founderIntro')}
                </p>

                {/* Prominent Branded Social Media Action Buttons */}
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <motion.a
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    href={settings.instagramUrl || FOUNDER_SOCIALS.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#FF7A59] text-white text-xs font-extrabold tracking-wide shadow-[0_8px_22px_rgba(255,77,141,0.38)] hover:brightness-105 transition-all"
                  >
                    <Instagram className="w-4 h-4" />
                    <span>Follow on Instagram</span>
                  </motion.a>

                  <motion.a
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    href={settings.youtubeUrl || FOUNDER_SOCIALS.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#181326] text-white text-xs font-extrabold tracking-wide shadow-md hover:bg-[#EF4444] transition-colors"
                  >
                    <Youtube className="w-4 h-4 text-[#FF9EC2]" />
                    <span>Watch on YouTube</span>
                  </motion.a>

                  <motion.a
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    href={settings.facebookUrl || FOUNDER_SOCIALS.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#ECFEFF] text-[#0E7490] border border-[#06B6D4]/45 text-xs font-extrabold tracking-wide hover:bg-[#06B6D4] hover:text-white transition-colors"
                  >
                    <Facebook className="w-4 h-4" />
                    <span>Connect with Sama</span>
                  </motion.a>
                </div>

                <div className="pt-4 border-t border-[#EDE8F7] flex flex-wrap items-center gap-4">
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#181326] text-white text-xs font-extrabold tracking-[0.12em] uppercase hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] transition-all"
                  >
                    <span>{t('home.founderCta')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/founder"
                    className="text-xs font-extrabold tracking-[0.1em] uppercase text-[#7C3AED] hover:text-[#FF4D8D] underline underline-offset-4"
                  >
                    Read Sama&apos;s Full Story
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION G: CUSTOMER LOVE (GENUINE DB REVIEWS CAROUSEL — ZERO FAKE REVIEWS) */}
      <section className="py-16 sm:py-22 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#06B6D4]">
                Customer Love · Verified Voices
              </p>
              <h2 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-[#181326]">
                {t('home.reviewsTitle')}
              </h2>
              <p className="text-sm text-[#64597A]">{t('home.reviewsSub')}</p>
            </div>

            {reviews.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReviewIdx((prev) => (prev - 1 + reviews.length) % reviews.length)
                  }
                  aria-label="Previous review"
                  className="w-10 h-10 rounded-full border border-[#E2D9F3] flex items-center justify-center text-[#181326] hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReviewIdx((prev) => (prev + 1) % reviews.length)}
                  aria-label="Next review"
                  className="w-10 h-10 rounded-full border border-[#E2D9F3] flex items-center justify-center text-[#181326] hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center rounded-[30px] bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF]/80 to-[#ECFEFF]/80 border border-[#E9DDFC] p-10 sm:p-12 space-y-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#7C3AED] shadow-md mx-auto flex items-center justify-center">
                <Quote className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
                100% Authentic Customer Reviews Only
              </h3>
              <p className="text-sm text-[#5E5474] max-w-md mx-auto leading-relaxed">
                {t('home.noReviewsYet')}
              </p>
              <div className="pt-2">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold tracking-wider uppercase hover:brightness-110 transition-all shadow-md"
                >
                  <span>Explore Pieces &amp; Share Your Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {reviews.map((rev, idx) => (
                  <motion.article
                    key={rev.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.06 }}
                    className={`rounded-[26px] p-6 sm:p-7 border flex flex-col justify-between gap-5 transition-all ${
                      idx === reviewIdx
                        ? 'bg-gradient-to-br from-[#FFF0F6] to-[#F3EEFF] border-[#FF4D8D]/45 shadow-[0_12px_32px_rgba(124,58,237,0.09)]'
                        : 'bg-[#FAFAFF] border-[#EDE8F7]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'fill-[#FF4D8D] text-[#FF4D8D]'
                                : 'text-[#DFD8EE]'
                            }`}
                          />
                        ))}
                      </div>
                      {rev.title && (
                        <h3 className="font-serif-display text-xl font-bold text-[#181326]">
                          {rev.title}
                        </h3>
                      )}
                      <p className="text-sm text-[#4D4463] leading-relaxed">{rev.comment}</p>
                    </div>

                    <div className="pt-4 border-t border-[#EDE8F7] text-xs text-[#64597A] space-y-1">
                      <p className="font-bold text-[#181326]">
                        {rev.customerName}
                        {rev.isVerifiedPurchase && (
                          <span className="text-[#10B981] font-semibold">
                            {' '}
                            · {t('product.verifiedPurchase')}
                          </span>
                        )}
                      </p>
                      {rev.productSlug && (
                        <Link
                          to={`/products/${rev.productSlug}`}
                          className="block text-[#7C3AED] hover:text-[#FF4D8D] hover:underline font-semibold"
                        >
                          {rev.productName}
                        </Link>
                      )}
                      <p>{new Date(rev.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                  </motion.article>
                ))}
              </div>

              {reviews.length > 1 && (
                <div className="mt-7 flex items-center justify-center gap-2">
                  {reviews.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReviewIdx(i)}
                      aria-label={`Review ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        i === reviewIdx
                          ? 'w-8 bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED]'
                          : 'w-2 bg-[#D6CBEB]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* SECTION H: FUNKY VIBRANT GRADIENT NEWSLETTER SUBSCRIPTION */}
      <section className="pt-4 pb-6 px-3 sm:px-8">
        <div className="max-w-[1440px] mx-auto">
          <div className="relative rounded-[34px] bg-gradient-to-r from-[#181326] via-[#4C1D95] to-[#BE185D] p-8 sm:p-14 lg:p-16 overflow-hidden shadow-[0_24px_60px_rgba(124,58,237,0.25)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#FF4D8D]/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-[#06B6D4]/30 blur-3xl"
            />

            <div className="relative max-w-2xl mx-auto text-center space-y-5">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 border border-white/25 text-[#67E8F9]">
                <Mail className="w-5 h-5" />
              </span>
              <p className="text-xs font-extrabold tracking-[0.22em] uppercase text-[#67E8F9]">
                Zarifly Style Club
              </p>
              <h2 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-white leading-tight">
                {t('home.newsletterTitle')}
              </h2>
              <p className="text-sm sm:text-base text-white/80 max-w-lg mx-auto">
                {t('home.newsletterSub')}
              </p>

              <form
                onSubmit={handleNewsletter}
                className="max-w-lg mx-auto flex flex-col sm:flex-row gap-3 pt-2"
              >
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={t('home.newsletterPlaceholder')}
                  className="flex-1 px-5 py-3.5 rounded-full text-sm bg-white/15 text-white placeholder:text-white/65 border border-white/25 outline-none focus:border-[#67E8F9] focus:bg-white/20 transition-all"
                />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={submittingNews}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#FF7A59] to-[#06B6D4] text-white text-xs font-extrabold tracking-[0.14em] uppercase hover:brightness-110 disabled:opacity-50 whitespace-nowrap shadow-lg"
                >
                  {submittingNews ? t('common.loading') : t('home.newsletterButton')}
                </motion.button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
