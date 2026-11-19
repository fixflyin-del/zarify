import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, Heart, ShoppingBag, Star, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import type { Product } from '../types';

const CARD_TINTS = [
  'bg-[#FFF0F6]', // Funky Berry Blush
  'bg-[#F3EEFF]', // Electric Lilac Tint
  'bg-[#ECFEFF]', // Fresh Aqua Mint
  'bg-[#FFF4F0]', // Coral Peach Pop
];

const BADGE_GRADIENTS = [
  'from-[#FF4D8D] to-[#FF7A59]',
  'from-[#7C3AED] to-[#EC4899]',
  'from-[#06B6D4] to-[#7C3AED]',
];

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { t, lang, wishlistIds, toggleWishlist, addToCart, setQuickViewProduct, notify } =
    useStore();
  const [adding, setAdding] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);
  const [previewColor, setPreviewColor] = useState<string | null>(null);

  const isWishlisted = wishlistIds.includes(product.id);
  const uniqueColors = Array.from(
    new Map(product.variants.map((v) => [v.colorName, v.colorHex])).entries()
  ).slice(0, 5);

  const activeVariantForAdd =
    (previewColor
      ? product.variants.find((v) => v.colorName === previewColor && v.stockQuantity > 0) ||
        product.variants.find((v) => v.colorName === previewColor)
      : null) ||
    product.variants.find((v) => v.stockQuantity > 0) ||
    product.variants[0];

  const colorMatchedImg = previewColor
    ? product.variants.find((v) => v.colorName === previewColor && v.imageUrl)?.imageUrl ||
      product.images.find((i) => i.colorName?.toLowerCase() === previewColor.toLowerCase())?.url
    : null;

  const primaryImg = colorMatchedImg || product.images[0]?.url || '';
  const secondaryImg = colorMatchedImg || product.images[1]?.url || primaryImg;
  const isOutOfStock = product.totalStock <= 0;

  const handleQuickAdd = async () => {
    if (!activeVariantForAdd?.id || isOutOfStock) return;
    try {
      setAdding(true);
      await addToCart(product.id, activeVariantForAdd.id, 1);
      setAddedPulse(true);
      setTimeout(() => setAddedPulse(false), 1400);
    } catch (err: any) {
      notify(err?.message || t('common.errorGeneric'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const displayName = lang === 'hi' && product.nameHi ? product.nameHi : product.name;
  const categoryName =
    lang === 'hi' && product.category?.nameHi
      ? product.category.nameHi
      : product.category?.name || '';

  const tintClass = CARD_TINTS[(product.id + index) % CARD_TINTS.length];
  const badgeGrad = BADGE_GRADIENTS[(product.id + index) % BADGE_GRADIENTS.length];

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col bg-white rounded-[24px] p-2.5 shadow-[0_8px_24px_rgba(124,58,237,0.06)] hover:shadow-[0_16px_36px_rgba(255,77,141,0.14)] border border-[#EDE9FE] transition-shadow h-full"
    >
      {/* 1:1 Square Funky Rounded Product Stage */}
      <div className={`relative aspect-square rounded-[18px] ${tintClass} overflow-hidden`}>
        <Link to={`/products/${product.slug}`} className="block w-full h-full">
          {primaryImg ? (
            <>
              <img
                src={primaryImg}
                alt={product.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:opacity-0"
              />
              <img
                src={secondaryImg}
                alt={`${product.name} alternate view`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-0 scale-100 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-lg text-[#7C3AED]">
              ZARIFLY
            </div>
          )}
        </Link>

        {/* Colourful Discount / Stock Tag */}
        {isOutOfStock ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-[#181326]/90 text-white text-[10px] font-bold px-2.5 py-1 tracking-wide">
            {t('product.outOfStock')}
          </span>
        ) : product.discountPercent > 0 ? (
          <span
            className={`absolute top-2.5 left-2.5 rounded-full bg-gradient-to-r ${badgeGrad} text-white text-[10px] font-extrabold px-2.5 py-1 tabular-nums shadow-sm`}
          >
            -{product.discountPercent}%
          </span>
        ) : null}

        {/* Animated Wishlist Heart & Quick View Buttons */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <motion.button
            whileTap={{ scale: 0.76 }}
            animate={isWishlisted ? { scale: [1, 1.24, 1] } : { scale: 1 }}
            transition={{ duration: 0.28 }}
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={t('nav.wishlist')}
            className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-colors ${
              isWishlisted
                ? 'bg-[#FF4D8D] text-white'
                : 'bg-white/92 text-[#181326] hover:bg-[#FFF0F6] hover:text-[#FF4D8D]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white text-white' : ''}`} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            type="button"
            onClick={() => setQuickViewProduct(product)}
            aria-label={t('product.quickView')}
            className="w-9 h-9 rounded-full bg-white/92 backdrop-blur-md text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white flex items-center justify-center shadow-sm sm:opacity-0 sm:translate-x-1 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Desktop Hover Quick-Add Pill */}
        <div className="hidden sm:block absolute inset-x-2.5 bottom-2.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            disabled={isOutOfStock || adding}
            onClick={handleQuickAdd}
            className={`w-full py-2.5 px-3 rounded-full text-[11px] font-bold tracking-wider uppercase inline-flex items-center justify-center gap-1.5 shadow-lg transition-all ${
              addedPulse
                ? 'bg-[#10B981] text-white'
                : 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white hover:brightness-105'
            } disabled:opacity-50`}
          >
            {addedPulse ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>
                  {isOutOfStock ? t('product.outOfStock') : adding ? '...' : t('product.addToCart')}
                </span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-1.5 pt-3 pb-1 flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#7C3AED] font-semibold">
            <span className="truncate">{categoryName}</span>
            {product.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[#FF4D8D] font-bold tabular-nums shrink-0">
                <Star className="w-3 h-3 fill-[#FF4D8D] text-[#FF4D8D]" />
                {product.avgRating}
              </span>
            )}
          </div>
          <Link
            to={`/products/${product.slug}`}
            className="mt-1 block text-[14px] sm:text-[15px] font-bold leading-snug text-[#181326] hover:text-[#FF4D8D] transition-colors line-clamp-2"
          >
            {displayName}
          </Link>
        </div>

        <div className="space-y-2 pt-1">
          {uniqueColors.length > 0 && (
            <div className="flex items-center gap-1.5">
              {uniqueColors.map(([name, hex]) => {
                const selected = previewColor === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={`Preview ${name}`}
                    onClick={() => setPreviewColor(selected ? null : name)}
                    style={{ backgroundColor: hex }}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      selected
                        ? 'scale-120 ring-2 ring-[#7C3AED] ring-offset-1 border-white'
                        : 'border-black/15 hover:scale-110'
                    }`}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-1.5 tabular-nums">
              <span className="text-[15px] sm:text-base font-extrabold text-[#181326]">
                {formatINR(product.sellingPrice)}
              </span>
              {product.originalPrice > product.sellingPrice && (
                <span className="text-[11px] text-[#9C91B4] line-through">
                  {formatINR(product.originalPrice)}
                </span>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              disabled={isOutOfStock || adding}
              onClick={handleQuickAdd}
              aria-label={t('product.addToCart')}
              className={`sm:hidden w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm ${
                addedPulse
                  ? 'bg-[#10B981] text-white'
                  : 'bg-gradient-to-tr from-[#FF4D8D] to-[#7C3AED] text-white'
              } disabled:opacity-40`}
            >
              {addedPulse ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function QuickViewModal() {
  const { quickViewProduct, setQuickViewProduct, addToCart, t, lang, notify } = useStore();
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [adding, setAdding] = useState(false);

  return (
    <AnimatePresence>
      {quickViewProduct && (
        <QuickViewContent
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          addToCart={addToCart}
          t={t}
          lang={lang}
          notify={notify}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          adding={adding}
          setAdding={setAdding}
        />
      )}
    </AnimatePresence>
  );
}

function QuickViewContent({
  product,
  onClose,
  addToCart,
  t,
  lang,
  notify,
  selectedColor,
  setSelectedColor,
  selectedSize,
  setSelectedSize,
  adding,
  setAdding,
}: any) {
  const colors: [string, string][] = Array.from(
    new Map<string, string>(product.variants.map((v: any) => [v.colorName, v.colorHex])).entries()
  );
  const activeColor = selectedColor || colors[0]?.[0] || '';
  const sizesForColor = product.variants.filter((v: any) => v.colorName === activeColor);
  const activeVariant =
    sizesForColor.find((v: any) => v.sizeName === selectedSize) ||
    sizesForColor[0] ||
    product.variants[0];

  const activeImage =
    activeVariant?.imageUrl ||
    product.images.find((i: any) => i.colorName === activeColor)?.url ||
    product.images[0]?.url ||
    '';
  const activePrice = activeVariant?.priceOverride ?? product.sellingPrice;

  const handleAdd = async () => {
    if (!activeVariant?.id || activeVariant.stockQuantity <= 0) return;
    try {
      setAdding(true);
      await addToCart(product.id, activeVariant.id, 1);
      onClose();
    } catch (err: any) {
      notify(err?.message || t('common.errorGeneric'), 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#181326]/60 backdrop-blur-xs"
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white w-full sm:max-w-3xl rounded-t-[32px] sm:rounded-[32px] grid grid-cols-1 md:grid-cols-2 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/95 flex items-center justify-center text-[#7C3AED] shadow-md hover:bg-[#F3EEFF]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="aspect-square bg-[#FFF0F6] overflow-hidden">
          <img
            src={activeImage}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <p className="text-xs text-[#7C3AED] font-bold">
              {product.category?.name} · {activeVariant?.sku || product.sku}
            </p>
            <h3 className="text-2xl font-extrabold text-[#181326]">
              {lang === 'hi' && product.nameHi ? product.nameHi : product.name}
            </h3>
            <div className="flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-extrabold text-[#181326]">{formatINR(activePrice)}</span>
              {product.originalPrice > activePrice && (
                <span className="text-sm text-[#9C91B4] line-through">
                  {formatINR(product.originalPrice)}
                </span>
              )}
            </div>
            <p className="text-sm text-[#6B6180] leading-relaxed line-clamp-3">
              {lang === 'hi' && product.descriptionHi
                ? product.descriptionHi
                : product.description}
            </p>

            <div className="pt-2">
              <p className="text-xs font-semibold text-[#6B6180] mb-2">
                {t('product.selectColor')}:{' '}
                <span className="text-[#181326] font-bold">{activeColor}</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map(([name, hex]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(name);
                      setSelectedSize('');
                    }}
                    title={name}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      activeColor === name
                        ? 'border-[#FF4D8D] scale-115 shadow-sm'
                        : 'border-transparent hover:scale-105'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: hex }}
                      className="w-6 h-6 rounded-full border border-black/15"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <p className="text-xs font-semibold text-[#6B6180] mb-2">{t('product.selectSize')}</p>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map((variant: any) => {
                  const selected = activeVariant?.id === variant.id;
                  return (
                    <button
                      key={variant.sku}
                      type="button"
                      onClick={() => setSelectedSize(variant.sizeName)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        selected
                          ? 'bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                          : 'bg-[#FAFAFF] text-[#4B445C] border border-[#EDE9FE] hover:border-[#7C3AED]'
                      } ${variant.stockQuantity === 0 ? 'opacity-45 line-through' : ''}`}
                    >
                      {variant.sizeName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={!activeVariant || activeVariant.stockQuantity <= 0 || adding}
              onClick={handleAdd}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#9333EA] to-[#7C3AED] text-white text-xs font-bold tracking-wider uppercase hover:brightness-105 disabled:opacity-45 transition-all shadow-lg"
            >
              {!activeVariant || activeVariant.stockQuantity <= 0
                ? t('product.outOfStock')
                : adding
                  ? t('common.loading')
                  : t('product.addToCart')}
            </motion.button>
            <Link
              to={`/products/${product.slug}`}
              onClick={onClose}
              className="block text-center text-xs font-bold text-[#7C3AED] hover:text-[#FF4D8D] transition-colors"
            >
              View Full Product Details &amp; 5-Image Gallery →
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
