import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiRequest } from '../lib/api';
import { DEFAULT_PRODUCTS } from '../lib/defaultCatalog';
import { SEO } from '../components/SEO';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../types';

interface ShopPageProps {
  collectionSlug?: 'hijabs' | 'naqaabs' | 'dupattas';
}

export function ShopPage({ collectionSlug }: ShopPageProps) {
  const { lang, t, bootstrap } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'newest';
  const maxPrice = searchParams.get('maxPrice') || '';
  const activeCategory = collectionSlug || searchParams.get('category') || 'all';

  const currentCatObj = bootstrap?.categories?.find((c) => c.slug === activeCategory);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const qs = new URLSearchParams();
        if (activeCategory && activeCategory !== 'all') qs.set('category', activeCategory);
        if (search) qs.set('search', search);
        if (sort) qs.set('sort', sort);
        if (maxPrice) qs.set('maxPrice', maxPrice);
        if (searchParams.get('newArrival') === 'true') qs.set('newArrival', 'true');

        const data = await apiRequest<{ products: Product[] }>(`/api/products?${qs.toString()}`);
        if (active) setProducts(data.products || []);
      } catch (err) {
        console.error('Shop load error (using default catalog):', err);
        if (active) {
          let fallback = [...DEFAULT_PRODUCTS];
          if (activeCategory && activeCategory !== 'all') {
            fallback = fallback.filter((p) => p.category?.slug === activeCategory);
          }
          if (search) {
            const q = search.toLowerCase();
            fallback = fallback.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.fabric.toLowerCase().includes(q)
            );
          }
          if (maxPrice && !Number.isNaN(Number(maxPrice))) {
            fallback = fallback.filter((p) => p.sellingPrice <= Number(maxPrice));
          }
          if (searchParams.get('newArrival') === 'true') {
            fallback = fallback.filter((p) => p.isNewArrival);
          }
          if (sort === 'price_asc') fallback.sort((a, b) => a.sellingPrice - b.sellingPrice);
          else if (sort === 'price_desc') fallback.sort((a, b) => b.sellingPrice - a.sellingPrice);
          else if (sort === 'bestselling') {
            fallback.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
          }
          setProducts(fallback);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [activeCategory, search, sort, maxPrice, searchParams]);

  const pageHeading = currentCatObj
    ? lang === 'hi' && currentCatObj.nameHi
      ? currentCatObj.nameHi
      : currentCatObj.name
    : lang === 'hi'
      ? 'संपूर्ण बुटीक संग्रह'
      : 'Explore ZARIFLY';

  const pageDesc = currentCatObj
    ? lang === 'hi' && currentCatObj.descriptionHi
      ? currentCatObj.descriptionHi
      : currentCatObj.description
    : lang === 'hi'
      ? 'हाथ से तैयार ज़री हिजाब, कोरियन निदा नक़ाब और ज़रदोज़ी डिज़ाइनर दुपट्टे।'
      : 'Handcrafted Zari & Zardozi hijabs, breathable Korean Nidha naqaabs, and vibrant designer dupattas.';

  const headerTint =
    activeCategory === 'hijabs'
      ? 'from-[#FFF0F6] via-[#FAFAFF] to-[#F3EEFF]'
      : activeCategory === 'naqaabs'
        ? 'from-[#F3EEFF] via-[#FAFAFF] to-[#ECFEFF]'
        : 'from-[#ECFEFF] via-[#FAFAFF] to-[#FFF0F6]';

  return (
    <>
      <SEO
        title={currentCatObj?.seoTitle || `${pageHeading} | ZARIFLY Boutique`}
        description={currentCatObj?.seoDescription || pageDesc}
        canonicalPath={collectionSlug ? `/collections/${collectionSlug}` : '/shop'}
      />

      {/* Vibrant Pastel Header Strip */}
      <section className={`bg-gradient-to-r ${headerTint} border-b border-[#E9DDFC]`}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <nav className="text-xs text-[#64597A] flex items-center gap-2 mb-3">
            <Link to="/" className="hover:text-[#FF4D8D]">
              {t('nav.home')}
            </Link>
            <span>/</span>
            <span className="text-[#181326] font-semibold">{pageHeading}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <h1 className="font-serif-display text-3xl sm:text-5xl font-extrabold text-[#181326]">
                {pageHeading}
              </h1>
              <p className="text-sm sm:text-base text-[#5E5474] leading-relaxed">{pageDesc}</p>
            </div>
            <p className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-[#E9DDFC] text-xs font-extrabold text-[#7C3AED] tabular-nums shrink-0 shadow-xs">
              {products.length} {products.length === 1 ? 'Piece Available' : 'Pieces Available'}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-7 sm:py-10">
        {/* Modern Colourful Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-7 border-b border-[#EDE8F7]">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { slug: 'all', to: '/shop', label: lang === 'hi' ? 'सभी' : 'All Collections' },
              { slug: 'hijabs', to: '/collections/hijabs', label: t('nav.hijabs') },
              { slug: 'naqaabs', to: '/collections/naqaabs', label: t('nav.naqaabs') },
              { slug: 'dupattas', to: '/collections/dupattas', label: t('nav.dupattas') },
            ].map((tab) => {
              const selected = activeCategory === tab.slug;
              return (
                <Link
                  key={tab.slug}
                  to={tab.to}
                  className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all whitespace-nowrap shrink-0 ${
                    selected
                      ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-[0_6px_18px_rgba(255,77,141,0.3)]'
                      : 'bg-white text-[#5E5474] border border-[#E2D9F3] hover:border-[#FF4D8D] hover:text-[#FF4D8D]'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 bg-white border border-[#E2D9F3] rounded-full px-3.5 py-2 text-xs text-[#5E5474]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#7C3AED]" />
              <select
                value={maxPrice}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  if (e.target.value) next.set('maxPrice', e.target.value);
                  else next.delete('maxPrice');
                  setSearchParams(next);
                }}
                aria-label="Filter by price"
                className="bg-transparent outline-none font-semibold text-[#181326]"
              >
                <option value="">All Prices</option>
                <option value="1500">Under ₹1,500</option>
                <option value="2500">Under ₹2,500</option>
                <option value="4000">Under ₹4,000</option>
              </select>
            </div>

            <select
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                next.set('sort', e.target.value);
                setSearchParams(next);
              }}
              aria-label="Sort products"
              className="bg-white border border-[#E2D9F3] rounded-full px-4 py-2 text-xs font-semibold text-[#181326] outline-none focus:border-[#7C3AED]"
            >
              <option value="newest">Newest Editions</option>
              <option value="bestselling">Best Sellers</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {search && (
          <div className="mb-6 flex items-center justify-between bg-[#FFF0F6] rounded-2xl border border-[#FF4D8D]/30 px-5 py-3.5 text-xs">
            <span>
              Showing results for <strong className="text-[#181326]">&ldquo;{search}&rdquo;</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('search');
                setSearchParams(next);
              }}
              className="inline-flex items-center gap-1 text-[#FF4D8D] font-bold hover:text-[#181326]"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        )}

        {/* Responsive Product Grid: 2 columns on mobile like a shopping app, 3-4 on desktop */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="aspect-[3/4] rounded-[24px] bg-white animate-pulse border border-[#EDE8F7]"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[30px] border border-[#EDE8F7] space-y-4">
            <p className="font-serif-display text-3xl font-extrabold text-[#181326]">
              No pieces match your selection.
            </p>
            <Link
              to="/shop"
              className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all"
            >
              Explore All Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
            {products.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
