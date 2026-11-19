import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  ZoomIn,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { fetchProductDetailBySlug, submitCustomerReview } from '../lib/firestoreStore';
import { DEFAULT_PRODUCTS } from '../lib/defaultCatalog';
import { SEO } from '../components/SEO';
import { ProductCard } from '../components/ProductCard';
import type { Product, ReviewItem } from '../types';

const RECENTLY_VIEWED_KEY = 'zarifly_recently_viewed';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { lang, t, user, wishlistIds, toggleWishlist, addToCart, notify } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [distribution, setDistribution] = useState<Array<{ star: number; count: number }>>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('details');

  // Delivery PIN code checker
  const [pincode, setPincode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinResult, setPinResult] = useState<any>(null);
  const [pinError, setPinError] = useState('');

  // Genuine Review Form
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revImageUrl, setRevImageUrl] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const relatedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchProductDetailBySlug(slug);
        if (!active) return;
        if (!data) {
          setProduct(null);
          return;
        }
        const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
          star,
          count: data.reviews.filter((r) => r.rating === star).length,
        }));
        setProduct(data.product);
        setReviews(data.reviews || []);
        setDistribution(ratingDist);
        setRelatedProducts(data.related || []);
        setActiveImageIdx(0);
        setQuantity(1);

        const defaultVar =
          data.product.variants.find((v) => v.stockQuantity > 0) || data.product.variants[0];
        if (defaultVar) {
          setSelectedColor(defaultVar.colorName);
          setSelectedSize(defaultVar.sizeName);
        }

        try {
          const prevRaw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
          const prev: Product[] = prevRaw ? JSON.parse(prevRaw) : [];
          const next = [data.product, ...prev.filter((p) => p.id !== data.product.id)].slice(0, 5);
          window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
          setRecentlyViewed(next.filter((p) => p.id !== data.product.id).slice(0, 4));
        } catch {
          // ignore storage errors
        }
      } catch {
        if (active) {
          const fallbackProd = DEFAULT_PRODUCTS.find((p) => p.slug === slug) || null;
          setProduct(fallbackProd);
          if (fallbackProd) {
            const defaultVar =
              fallbackProd.variants.find((v) => v.stockQuantity > 0) || fallbackProd.variants[0];
            if (defaultVar) {
              setSelectedColor(defaultVar.colorName);
              setSelectedSize(defaultVar.sizeName);
            }
            setReviews([]);
            setDistribution([5, 4, 3, 2, 1].map((star) => ({ star, count: 0 })));
            setRelatedProducts(
              DEFAULT_PRODUCTS.filter(
                (p) => p.categoryId === fallbackProd.categoryId && p.id !== fallbackProd.id
              ).slice(0, 4)
            );
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 aspect-square rounded-[28px] bg-[#FFF0F6] animate-pulse" />
        <div className="lg:col-span-5 space-y-4">
          <div className="h-9 w-2/3 rounded-full bg-[#F3EEFF] animate-pulse" />
          <div className="h-7 w-1/3 rounded-full bg-[#ECFEFF] animate-pulse" />
          <div className="h-44 w-full rounded-[24px] bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="font-serif-display text-4xl font-extrabold text-[#181326]">
          Piece Not Found
        </h1>
        <p className="text-sm text-[#64597A]">
          The piece you are looking for may have moved or sold out.
        </p>
        <Link
          to="/shop"
          className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
        >
          Return to Boutique
        </Link>
      </div>
    );
  }

  const colors = Array.from(
    new Map(product.variants.map((v) => [v.colorName, v.colorHex])).entries()
  );
  const sizesForColor = product.variants.filter((v) => v.colorName === selectedColor);
  const activeVariant =
    sizesForColor.find((v) => v.sizeName === selectedSize) ||
    sizesForColor[0] ||
    product.variants[0];

  const activePrice = activeVariant?.priceOverride ?? product.sellingPrice;
  const activeStock = activeVariant?.stockQuantity ?? 0;
  const isOutOfStock = activeStock <= 0;
  const isWishlisted = wishlistIds.includes(product.id);
  const savingsPercent =
    product.originalPrice > activePrice
      ? Math.round(((product.originalPrice - activePrice) / product.originalPrice) * 100)
      : 0;

  // 5-Image Square Gallery
  const gallery = product.images.slice(0, 5);
  const currentImgUrl = gallery[activeImageIdx]?.url || gallery[0]?.url || '';

  const nextImage = () =>
    setActiveImageIdx((i) => (i + 1) % Math.max(1, gallery.length));
  const prevImage = () =>
    setActiveImageIdx((i) => (i - 1 + Math.max(1, gallery.length)) % Math.max(1, gallery.length));

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || gallery.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) nextImage();
      else prevImage();
    }
    touchStartX.current = null;
  };

  const handleSelectColor = (colorName: string) => {
    setSelectedColor(colorName);
    const matchingSizes = product.variants.filter((v) => v.colorName === colorName);
    const best = matchingSizes.find((v) => v.stockQuantity > 0) || matchingSizes[0];
    if (best) setSelectedSize(best.sizeName);
    setQuantity(1);

    const imgMatchIdx = gallery.findIndex(
      (img) =>
        img.colorName?.toLowerCase() === colorName.toLowerCase() ||
        (best?.imageUrl && img.url === best.imageUrl)
    );
    if (imgMatchIdx >= 0) setActiveImageIdx(imgMatchIdx);
  };

  const handleAddToCart = async (goCheckout = false) => {
    if (!activeVariant?.id || isOutOfStock) return;
    try {
      setAdding(true);
      await addToCart(product.id, activeVariant.id, quantity);
      if (goCheckout) {
        navigate('/checkout');
      }
    } catch (err: any) {
      notify(err?.message || t('common.errorGeneric'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleCheckPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinResult(null);
    if (!/^\d{6}$/.test(pincode.trim())) {
      setPinError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    try {
      setPinLoading(true);
      const data = await apiRequest(`/api/pincode/${pincode.trim()}`);
      setPinResult(data);
    } catch (err: any) {
      setPinError(err?.message || 'Unable to verify this PIN code.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRev(true);
      await submitCustomerReview({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        rating: revRating,
        title: revTitle.trim(),
        comment: revComment.trim(),
        imagesJson: revImageUrl.trim() ? [revImageUrl.trim()] : [],
        customerName: user?.fullName || 'ZARIFLY Customer',
        customerEmail: user?.email || '',
      });
      notify('Thank you! Your review has been submitted for moderation.', 'success');
      setRevTitle('');
      setRevComment('');
      setRevImageUrl('');
    } catch (err: any) {
      notify(err?.message || t('common.errorGeneric'), 'error');
    } finally {
      setSubmittingRev(false);
    }
  };

  const displayName = lang === 'hi' && product.nameHi ? product.nameHi : product.name;
  const displayDesc =
    lang === 'hi' && product.descriptionHi ? product.descriptionHi : product.description;

  const productJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: activeVariant?.sku || product.sku,
      image: gallery.map((g) => `${window.location.origin}${g.url}`),
      description: product.description,
      brand: { '@type': 'Brand', name: 'ZARIFLY' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: activePrice,
        availability: isOutOfStock
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      },
      ...(product.reviewCount > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.avgRating,
              reviewCount: product.reviewCount,
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${window.location.origin}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: product.category?.name || 'Shop',
          item: `${window.location.origin}/collections/${product.category?.slug || 'hijabs'}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: product.name,
          item: `${window.location.origin}/products/${product.slug}`,
        },
      ],
    },
  ];

  const accordionItems = [
    {
      id: 'details',
      title: 'Description & Styling',
      content: <p className="text-sm text-[#5E5474] leading-relaxed">{displayDesc}</p>,
    },
    {
      id: 'craft',
      title: `${t('product.fabric')} & ${t('product.craftsmanship')}`,
      content: (
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between py-2 border-b border-[#EDE8F7]">
            <dt className="text-[#64597A]">{t('product.fabric')}</dt>
            <dd className="font-bold text-[#181326] text-right">{product.fabric}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[#EDE8F7]">
            <dt className="text-[#64597A]">{t('product.craftsmanship')}</dt>
            <dd className="font-bold text-[#181326] text-right">{product.workDetails}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64597A]">Origin</dt>
            <dd className="font-bold text-[#181326]">Handcrafted in India · Maison ZARIFLY</dd>
          </div>
        </dl>
      ),
    },
    {
      id: 'care',
      title: 'Care & Preservation',
      content: (
        <p className="text-sm text-[#5E5474] leading-relaxed">
          Dry clean recommended for intricate Zardozi &amp; Nakashi work, or gentle cool-water hand
          wash with mild detergent. Dry flat in shade and steam lightly on the reverse side.
        </p>
      ),
    },
    {
      id: 'shipping',
      title: 'Shipping & 7-Day Boutique Returns',
      content: (
        <p className="text-sm text-[#5E5474] leading-relaxed">
          Dispatched within 24–48 business hours. Complimentary insured delivery above ₹1,999.
          Unused pieces with original tags and packaging are eligible for 7-day return or exchange.
        </p>
      ),
    },
  ];

  return (
    <>
      <SEO
        title={product.seoTitle || `${product.name} | ZARIFLY`}
        description={product.seoDescription || product.description.slice(0, 155)}
        canonicalPath={`/products/${product.slug}`}
        image={currentImgUrl}
        type="product"
        jsonLd={productJsonLd}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-28 lg:pb-16">
        {/* Clean Breadcrumb */}
        <nav className="text-xs text-[#64597A] flex flex-wrap items-center gap-2 mb-6">
          <Link to="/" className="hover:text-[#FF4D8D]">
            {t('nav.home')}
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <Link
                to={`/collections/${product.category.slug}`}
                className="hover:text-[#FF4D8D]"
              >
                {lang === 'hi' && product.category.nameHi
                  ? product.category.nameHi
                  : product.category.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-[#181326] font-semibold">{displayName}</span>
        </nav>

        {/* Contiguous Modern PDP Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Large Swipeable 1:1 Square 5-Image Gallery */}
          <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-24">
            <div
              onTouchStart={handleGalleryTouchStart}
              onTouchEnd={handleGalleryTouchEnd}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setZoomOrigin({ x, y });
              }}
              onMouseLeave={() => setZoomOrigin(null)}
              className="relative aspect-square rounded-[30px] bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] overflow-hidden shadow-[0_18px_45px_rgba(124,58,237,0.1)] border border-[#E9DDFC] cursor-zoom-in"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImgUrl + activeImageIdx}
                  src={currentImgUrl}
                  alt={gallery[activeImageIdx]?.altText || product.name}
                  referrerPolicy="no-referrer"
                  initial={{ opacity: 0.4, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.4 }}
                  transition={{ duration: 0.25 }}
                  style={
                    zoomOrigin
                      ? {
                          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                          transform: 'scale(1.65)',
                        }
                      : undefined
                  }
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

              {/* Funky Discount Pill & Wishlist Overlay */}
              {savingsPercent > 0 && (
                <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold tabular-nums shadow-md">
                  Save {savingsPercent}%
                </span>
              )}

              <motion.button
                whileTap={{ scale: 0.8 }}
                animate={isWishlisted ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={t('nav.wishlist')}
                className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-md text-[#181326] hover:bg-[#FFF0F6]"
              >
                <Heart
                  className={`w-5 h-5 ${isWishlisted ? 'fill-[#FF4D8D] text-[#FF4D8D]' : ''}`}
                />
              </motion.button>

              {/* Left / Right Gallery Arrows */}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    aria-label="Previous product photo"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-[#181326] flex items-center justify-center shadow-md hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] hover:text-white transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    aria-label="Next product photo"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-[#181326] flex items-center justify-center shadow-md hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] hover:text-white transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Counter + Dots */}
              <div className="absolute bottom-4 inset-x-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 bg-[#181326]/45 backdrop-blur-md px-3 py-1.5 rounded-full pointer-events-auto">
                  {gallery.map((img, i) => (
                    <button
                      key={img.id ?? i}
                      type="button"
                      onClick={() => setActiveImageIdx(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeImageIdx
                          ? 'w-6 bg-gradient-to-r from-[#FF4D8D] to-[#06B6D4]'
                          : 'w-1.5 bg-white/55'
                      }`}
                    />
                  ))}
                </div>
                <span className="rounded-full bg-white/95 text-[#181326] text-[11px] font-bold px-3 py-1 inline-flex items-center gap-1.5 shadow-sm tabular-nums">
                  <ZoomIn className="w-3.5 h-3.5 text-[#7C3AED]" />
                  {activeImageIdx + 1} / {gallery.length}
                </span>
              </div>
            </div>

            {/* 5-Thumbnail Rounded Strip */}
            <div className="grid grid-cols-5 gap-2.5 sm:gap-3.5">
              {gallery.map((img, idx) => (
                <button
                  key={img.id ?? idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-square rounded-[18px] bg-[#FFF0F6] overflow-hidden border-2 transition-all ${
                    idx === activeImageIdx
                      ? 'border-[#FF4D8D] scale-[1.03] shadow-md'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.altText || `${product.name} view ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Modern Rounded Purchase Card */}
          <div className="lg:col-span-5 space-y-6 bg-white rounded-[30px] border border-[#EDE8F7] shadow-[0_14px_40px_rgba(124,58,237,0.07)] p-6 sm:p-8">
            <div className="space-y-3 border-b border-[#EDE8F7] pb-5">
              <div className="flex items-center justify-between gap-2 text-xs text-[#64597A]">
                <span>
                  {product.category?.name} · {t('product.sku')}:{' '}
                  <strong className="font-bold text-[#181326] tabular-nums">
                    {activeVariant?.sku || product.sku}
                  </strong>
                </span>
                {product.reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#FF4D8D] font-bold tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-[#FF4D8D] text-[#FF4D8D]" />
                    {product.avgRating} ({product.reviewCount})
                  </span>
                )}
              </div>

              <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326] leading-tight">
                {displayName}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3 pt-1 tabular-nums">
                <span className="text-3xl font-extrabold text-[#181326]">{formatINR(activePrice)}</span>
                {product.originalPrice > activePrice && (
                  <>
                    <span className="text-base text-[#9A8FB3] line-through">
                      {formatINR(product.originalPrice)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFF0F6] text-xs font-extrabold text-[#FF4D8D]">
                      {savingsPercent}% OFF
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-[#64597A]">Inclusive of all taxes · Direct from ZARIFLY Studio</p>
            </div>

            {/* Circular Colour Swatches */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#64597A]">
                {t('product.selectColor')}:{' '}
                <span className="text-[#181326] font-bold">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {colors.map(([name, hex]) => {
                  const selected = selectedColor === name;
                  return (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      key={name}
                      type="button"
                      onClick={() => handleSelectColor(name)}
                      title={name}
                      aria-label={`Select colour ${name}`}
                      className={`w-10 h-10 rounded-full p-1 border-2 transition-all flex items-center justify-center ${
                        selected
                          ? 'border-[#FF4D8D] scale-110 shadow-md'
                          : 'border-[#E2D9F3] hover:border-[#7C3AED]'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: hex }}
                        className="w-full h-full rounded-full border border-black/15"
                      />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Modern Pill Size Selector */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#64597A]">{t('product.selectSize')}</p>
              <div className="flex flex-wrap gap-2.5">
                {sizesForColor.map((variant) => {
                  const selected = activeVariant?.id === variant.id;
                  return (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={variant.sku}
                      type="button"
                      onClick={() => {
                        setSelectedSize(variant.sizeName);
                        setQuantity(1);
                      }}
                      className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                        selected
                          ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-md'
                          : 'bg-[#FAFAFF] text-[#4D4463] border border-[#E2D9F3] hover:border-[#7C3AED]'
                      } ${variant.stockQuantity === 0 ? 'opacity-45 line-through' : ''}`}
                    >
                      {variant.sizeName}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Stock Indicator */}
            <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-[#FAFAFF] border border-[#EDE8F7] text-xs">
              <span className="text-[#64597A] font-medium">Availability</span>
              {isOutOfStock ? (
                <span className="font-bold text-[#DC2626]">{t('product.outOfStock')}</span>
              ) : activeStock <= 5 ? (
                <span className="font-bold text-[#FF7A59] tabular-nums">
                  {t('product.lowStock')} ({activeStock} left)
                </span>
              ) : (
                <span className="font-bold text-[#10B981] tabular-nums">
                  {t('product.inStock')} ({activeStock} ready to ship)
                </span>
              )}
            </div>

            {/* Quantity + Desktop/Tablet CTAs */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-full bg-[#FAFAFF] border border-[#E2D9F3] p-1">
                  <button
                    type="button"
                    disabled={quantity <= 1 || isOutOfStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#181326] hover:bg-white disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-sm font-bold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity >= activeStock || isOutOfStock}
                    onClick={() => setQuantity((q) => Math.min(activeStock, q + 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#181326] hover:bg-white disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  disabled={isOutOfStock || adding}
                  onClick={() => handleAddToCart(false)}
                  className="flex-1 py-4 px-5 rounded-full bg-[#181326] text-white text-xs font-extrabold tracking-[0.12em] uppercase hover:bg-[#7C3AED] disabled:opacity-45 inline-flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <ShoppingBag className="w-4 h-4 text-[#FF9EC2]" />
                  <span>{isOutOfStock ? t('product.outOfStock') : t('product.addToCart')}</span>
                </motion.button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={isOutOfStock || adding}
                onClick={() => handleAddToCart(true)}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold tracking-[0.14em] uppercase hover:brightness-110 disabled:opacity-45 transition-all shadow-[0_10px_28px_rgba(255,77,141,0.35)]"
              >
                {t('product.buyNow')}
              </motion.button>
            </div>

            {/* Delivery PIN Code Checker */}
            <div className="p-4 rounded-2xl bg-[#ECFEFF]/75 border border-[#06B6D4]/30 space-y-3">
              <p className="text-xs font-bold text-[#181326] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#06B6D4]" />
                <span>{t('product.deliveryCheck')}</span>
              </p>
              <form onSubmit={handleCheckPincode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('product.enterPincode')}
                  className="flex-1 px-4 py-2.5 rounded-full text-xs bg-white border border-[#BAE6FD] outline-none focus:border-[#06B6D4] tabular-nums"
                />
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#181326] text-white hover:bg-[#06B6D4] transition-colors"
                >
                  {pinLoading ? '...' : t('product.checkBtn')}
                </button>
              </form>
              {pinError && <p className="text-xs text-[#DC2626] font-medium">{pinError}</p>}
              {pinResult && (
                <div className="text-xs bg-white rounded-2xl p-3.5 border border-[#BAE6FD] space-y-1">
                  <p className="font-bold text-[#10B981] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Delivery available to {pinResult.city}, {pinResult.state} ({pinResult.pincode})
                  </p>
                  <p className="text-[#5E5474]">
                    Estimated Arrival: <strong>{pinResult.estimatedDelivery}</strong> · COD Available
                  </p>
                </div>
              )}
            </div>

            {/* Product Details Accordion */}
            <div className="divide-y divide-[#EDE8F7] border-t border-[#EDE8F7] pt-2">
              {accordionItems.map((item) => {
                const isOpen = openAccordion === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(isOpen ? '' : item.id)}
                      className="w-full py-4 flex items-center justify-between gap-4 text-left"
                    >
                      <span className="text-sm font-bold text-[#181326]">{item.title}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#7C3AED] transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pb-4">{item.content}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-[#64597A] flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
              <span>Authentic ZARIFLY Studio Piece · Cash on Delivery Protected</span>
            </p>
          </div>
        </div>

        {/* Genuine Customer Reviews & Rating Distribution */}
        <section className="mt-16 pt-12 border-t border-[#EDE8F7]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#FF4D8D]">
                  Verified Feedback
                </p>
                <h2 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326] mt-1">
                  {t('product.reviews')}
                </h2>
                <p className="text-xs text-[#64597A] mt-1">
                  Genuine reviews from registered ZARIFLY customers.
                </p>
              </div>

              <div className="bg-white rounded-[26px] border border-[#EDE8F7] p-6 space-y-4 shadow-xs">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif-display text-4xl font-extrabold text-[#181326] tabular-nums">
                    {product.reviewCount > 0 ? product.avgRating.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs text-[#64597A]">
                    Based on {product.reviewCount} genuine{' '}
                    {product.reviewCount === 1 ? 'review' : 'reviews'}
                  </span>
                </div>

                <div className="space-y-2">
                  {distribution.map((row) => {
                    const pct =
                      product.reviewCount > 0 ? (row.count / product.reviewCount) * 100 : 0;
                    return (
                      <div key={row.star} className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="w-8 font-semibold text-[#5E5474]">{row.star} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-[#F3EEFF] overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED]"
                          />
                        </div>
                        <span className="w-6 text-right text-[#64597A]">{row.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Write a Review Form */}
              <div className="bg-white rounded-[26px] border border-[#EDE8F7] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                  {t('product.writeReview')}
                </h3>
                {!user ? (
                  <div className="space-y-3 text-xs text-[#64597A]">
                    <p>{t('product.signInToReview')}</p>
                    <Link
                      to="/login"
                      className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white font-extrabold uppercase tracking-wider"
                    >
                      {t('auth.signIn')}
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#64597A] mb-1.5">
                        Your Rating
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setRevRating(s)}
                            aria-label={`${s} star`}
                            className="p-1"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                s <= revRating
                                  ? 'fill-[#FF4D8D] text-[#FF4D8D]'
                                  : 'text-[#DFD8EE]'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={revTitle}
                      onChange={(e) => setRevTitle(e.target.value)}
                      placeholder="Review headline (optional)"
                      className="w-full px-4 py-3 rounded-2xl text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                    />
                    <textarea
                      required
                      rows={3}
                      value={revComment}
                      onChange={(e) => setRevComment(e.target.value)}
                      placeholder="Share your honest thoughts on fabric, embroidery, and drape..."
                      className="w-full px-4 py-3 rounded-2xl text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                    />
                    <input
                      type="url"
                      value={revImageUrl}
                      onChange={(e) => setRevImageUrl(e.target.value)}
                      placeholder="Optional customer photo URL"
                      className="w-full px-4 py-3 rounded-2xl text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                    />
                    <button
                      type="submit"
                      disabled={submittingRev}
                      className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {submittingRev ? t('common.loading') : 'Submit Review'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {reviews.length === 0 ? (
                <div className="bg-white rounded-[26px] border border-[#EDE8F7] p-10 text-center space-y-2">
                  <p className="font-serif-display text-2xl font-extrabold text-[#181326]">
                    No Reviews Yet
                  </p>
                  <p className="text-xs text-[#64597A]">{t('home.noReviewsYet')}</p>
                </div>
              ) : (
                reviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="bg-white rounded-[24px] border border-[#EDE8F7] p-6 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
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
                      <span className="text-xs text-[#64597A]">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    {rev.title && (
                      <h4 className="font-serif-display text-xl font-bold text-[#181326]">
                        {rev.title}
                      </h4>
                    )}
                    <p className="text-sm text-[#4D4463] leading-relaxed">{rev.comment}</p>
                    {rev.imagesJson && rev.imagesJson.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {rev.imagesJson.map((imgUrl, idx) => (
                          <img
                            key={idx}
                            src={imgUrl}
                            alt="Customer uploaded review photo"
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 rounded-xl object-cover border border-[#E2D9F3]"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-[#64597A] pt-1">
                      <strong className="text-[#181326]">{rev.customerName}</strong>
                      {rev.isVerifiedPurchase && (
                        <span className="text-[#10B981] font-semibold"> · {t('product.verifiedPurchase')}</span>
                      )}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Related Products Horizontal Carousel */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 pt-12 border-t border-[#EDE8F7]">
            <div className="flex items-end justify-between gap-4 mb-7">
              <h2 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                {t('product.related')}
              </h2>
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => relatedRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                  aria-label="Previous related"
                  className="w-10 h-10 rounded-full bg-white border border-[#E2D9F3] flex items-center justify-center hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => relatedRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                  aria-label="Next related"
                  className="w-10 h-10 rounded-full bg-white border border-[#E2D9F3] flex items-center justify-center hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={relatedRef}
              className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar"
            >
              {relatedProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="w-[46vw] min-w-[170px] sm:w-[270px] lg:w-[calc(25%-18px)] shrink-0 snap-start"
                >
                  <ProductCard product={p} index={idx} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mt-14 pt-12 border-t border-[#EDE8F7]">
            <h2 className="font-serif-display text-3xl font-extrabold text-[#181326] mb-7">
              {t('product.recentlyViewed')}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {recentlyViewed.map((p, idx) => (
                <ProductCard key={p.id} product={p} index={idx} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Sticky Bottom Purchase Bar (< lg) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#E9DDFC] px-4 py-3 pb-safe shadow-[0_-8px_28px_rgba(124,58,237,0.14)]">
        <div className="flex items-center gap-2.5">
          <div className="pr-2 shrink-0">
            <p className="text-[10px] font-semibold text-[#64597A]">Price</p>
            <p className="text-base font-extrabold text-[#181326] tabular-nums leading-tight">
              {formatINR(activePrice)}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            disabled={isOutOfStock || adding}
            onClick={() => handleAddToCart(false)}
            className="flex-1 h-11 rounded-full bg-[#181326] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 disabled:opacity-45"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#FF9EC2]" />
            <span>{isOutOfStock ? t('product.outOfStock') : t('product.addToCart')}</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            disabled={isOutOfStock || adding}
            onClick={() => handleAddToCart(true)}
            className="px-5 h-11 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider disabled:opacity-45 whitespace-nowrap shadow-md"
          >
            {t('product.buyNow')}
          </motion.button>
        </div>
      </div>
    </>
  );
}
