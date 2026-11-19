import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import { SEO } from '../components/SEO';

export function CartPage() {
  const { cart, t, updateCartItem, removeCartItem, applyCoupon, removeCoupon, notify } = useStore();
  const [couponInput, setCouponInput] = useState('');
  const [applying, setApplying] = useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    try {
      setApplying(true);
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch (err: any) {
      notify(err?.message || 'Unable to apply coupon.', 'error');
    } finally {
      setApplying(false);
    }
  };

  const remainingForFreeShipping = Math.max(0, cart.freeShippingThreshold - cart.subtotal);
  const progressPct = Math.min(
    100,
    Math.round((cart.subtotal / Math.max(1, cart.freeShippingThreshold)) * 100)
  );

  return (
    <>
      <SEO
        title="Shopping Bag | ZARIFLY Boutique"
        description="Review your selected handcrafted hijabs, naqaabs, and designer dupattas before secure checkout."
        canonicalPath="/cart"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#FF4D8D]">
            ZARIFLY Bag
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            {t('cart.title')}
          </h1>
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-[#EDE8F7] py-20 px-6 text-center space-y-5 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#FFF0F6] mx-auto flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-[#FF4D8D]" />
            </div>
            <p className="font-serif-display text-3xl font-extrabold text-[#181326]">
              {t('cart.empty')}
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all shadow-md"
            >
              <span>{t('cart.continue')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Cart Items */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-gradient-to-r from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] rounded-[24px] border border-[#E9DDFC] px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-[#181326]">
                  {remainingForFreeShipping > 0 ? (
                    <>
                      Add{' '}
                      <strong className="text-[#FF4D8D] tabular-nums">
                        {formatINR(remainingForFreeShipping)}
                      </strong>{' '}
                      more to unlock complimentary insured delivery across India.
                    </>
                  ) : (
                    <span className="text-[#10B981] font-bold">
                      {t('cart.freeShippingUnlocked')}
                    </span>
                  )}
                </p>
                <div className="h-2 rounded-full bg-white overflow-hidden">
                  <div
                    style={{ width: `${progressPct}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#7C3AED] to-[#06B6D4] transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-[26px] border border-[#EDE8F7] p-4 sm:p-6 flex flex-col sm:flex-row gap-5 shadow-[0_6px_22px_rgba(124,58,237,0.05)]"
                  >
                    <Link
                      to={`/products/${item.productSlug}`}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-[20px] bg-[#FFF0F6] shrink-0 overflow-hidden"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link
                            to={`/products/${item.productSlug}`}
                            className="font-serif-display text-xl sm:text-2xl font-bold text-[#181326] hover:text-[#7C3AED]"
                          >
                            {item.productName}
                          </Link>
                          <p className="text-xs text-[#64597A] mt-0.5 tabular-nums">
                            SKU: {item.sku} · {formatINR(item.unitPrice)} each
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          aria-label={t('cart.remove')}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[#8B7FA6] hover:bg-[#FFF0F6] hover:text-[#FF4D8D] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                        {item.availableVariants.length > 1 ? (
                          <select
                            value={item.variantId}
                            onChange={(e) =>
                              updateCartItem(item.id, { variantId: Number(e.target.value) }).catch(
                                (err) => notify(err.message, 'error')
                              )
                            }
                            aria-label="Change variant"
                            className="text-xs font-semibold bg-[#FAFAFF] border border-[#E2D9F3] rounded-full px-4 py-2 outline-none focus:border-[#7C3AED]"
                          >
                            {item.availableVariants.map((v) => (
                              <option
                                key={v.id}
                                value={v.id}
                                disabled={v.stockQuantity <= 0}
                              >
                                {v.colorName} — {v.sizeName}
                                {v.stockQuantity <= 0 ? ' (Out of Stock)' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#64597A] font-semibold">
                            {item.colorName} · {item.sizeName}
                          </span>
                        )}

                        <div className="flex items-center gap-5">
                          <div className="inline-flex items-center rounded-full border border-[#E2D9F3] bg-[#FAFAFF] p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                item.quantity > 1
                                  ? updateCartItem(item.id, { quantity: item.quantity - 1 })
                                  : removeCartItem(item.id)
                              }
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#181326] hover:bg-white"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= item.stockQuantity}
                              onClick={() =>
                                updateCartItem(item.id, { quantity: item.quantity + 1 }).catch(
                                  (err) => notify(err.message, 'error')
                                )
                              }
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#181326] hover:bg-white disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-lg font-extrabold tabular-nums text-[#181326]">
                            {formatINR(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary & Coupon Card */}
            <aside className="lg:col-span-4 bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-7 space-y-5 shadow-[0_12px_36px_rgba(124,58,237,0.07)] lg:sticky lg:top-24">
              <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                {t('checkout.orderSummary')}
              </h2>

              <div className="space-y-2 pb-4 border-b border-[#EDE8F7]">
                {cart.appliedCoupon ? (
                  <div className="flex items-center justify-between bg-[#F3EEFF] border border-[#7C3AED]/35 rounded-2xl px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-2 text-[#7C3AED] font-bold">
                      <Tag className="w-3.5 h-3.5" />
                      {cart.appliedCoupon.code} applied
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCoupon()}
                      className="text-[#FF4D8D] font-bold hover:underline"
                    >
                      {t('cart.remove')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder={t('cart.couponPlaceholder')}
                      className="flex-1 px-4 py-2.5 rounded-full text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                    />
                    <button
                      type="submit"
                      disabled={applying}
                      className="px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#181326] text-white hover:bg-[#7C3AED] transition-colors"
                    >
                      {t('cart.apply')}
                    </button>
                  </form>
                )}
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-[#64597A]">
                  <span>{t('cart.subtotal')}</span>
                  <span className="tabular-nums">{formatINR(cart.subtotal)}</span>
                </div>
                {cart.discountAmount > 0 && (
                  <div className="flex justify-between text-[#FF4D8D] font-bold">
                    <span>{t('cart.discount')}</span>
                    <span className="tabular-nums">-{formatINR(cart.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64597A]">
                  <span>{t('cart.shipping')}</span>
                  <span className="tabular-nums">
                    {cart.shippingFee === 0 ? t('cart.free') : formatINR(cart.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-[#181326] pt-3 border-t border-[#EDE8F7]">
                  <span>{t('cart.total')}</span>
                  <span className="tabular-nums">{formatINR(cart.grandTotal)}</span>
                </div>
                <p className="text-[11px] text-[#64597A]">{cart.taxIncludedNote}</p>
              </div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Link
                  to="/checkout"
                  className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold tracking-[0.14em] uppercase hover:brightness-110 flex items-center justify-center gap-2 transition-all shadow-[0_10px_28px_rgba(255,77,141,0.35)]"
                >
                  <span>{t('cart.checkout')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
