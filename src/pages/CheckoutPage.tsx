import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LocateFixed,
  MessageCircle,
  ShieldCheck,
  Tag,
  Truck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore, type WhatsAppOtpRequestResult } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { placeCustomerOrder } from '../lib/firestoreStore';
import { SEO } from '../components/SEO';

export function CheckoutPage() {
  const {
    cart,
    user,
    loginWithGoogle,
    requestWhatsAppOtp,
    verifyWhatsAppOtp,
    applyCoupon,
    removeCoupon,
    clearCart,
    t,
    notify,
  } = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    houseFlat: '',
    streetArea: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    landmark: '',
    notes: '',
  });

  // Inline quick WhatsApp sign-in on checkout
  const [showWaQuick, setShowWaQuick] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waName, setWaName] = useState('');
  const [waCode, setWaCode] = useState('');
  const [waOtpMeta, setWaOtpMeta] = useState<WhatsAppOtpRequestResult | null>(null);
  const [waLoading, setWaLoading] = useState(false);

  // Coupon input on checkout
  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [detecting, setDetecting] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [pinInfo, setPinInfo] = useState<{
    serviceable: boolean;
    estimatedDelivery?: string;
    city?: string;
    state?: string;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || user.fullName || '',
        email:
          prev.email ||
          (user.email && !user.email.endsWith('@whatsapp.zarifly.in') ? user.email : ''),
        mobile: prev.mobile || user.phone || '',
      }));
    }
  }, [user]);

  const handleQuickWaRequest = async () => {
    try {
      setWaLoading(true);
      const res = await requestWhatsAppOtp({
        phone: waPhone.trim(),
        fullName: waName.trim() || undefined,
        mode: waName.trim() ? 'signup' : 'login',
      });
      setWaOtpMeta(res);
      notify('WhatsApp verification code ready!', 'success');
    } catch (err: any) {
      notify(err?.message || 'Enter a valid 10-digit WhatsApp number.', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleQuickWaVerify = async () => {
    try {
      setWaLoading(true);
      const u = await verifyWhatsAppOtp({
        phone: waOtpMeta?.phone || waPhone.trim(),
        code: waCode.trim(),
        fullName: waName.trim() || undefined,
      });
      setShowWaQuick(false);
      setWaOtpMeta(null);
      setWaCode('');
      notify(`Signed in via WhatsApp as ${u.fullName}!`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Invalid verification code.', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    try {
      setApplyingCoupon(true);
      await applyCoupon(code);
      setCouponInput('');
    } catch (err: any) {
      notify(err?.message || 'Unable to apply coupon.', 'error');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const lookupPincode = async (pin: string) => {
    if (!/^\d{6}$/.test(pin)) {
      setPinInfo(null);
      return;
    }
    try {
      const data = await apiRequest<any>(`/api/pincode/${pin}`);
      setPinInfo({
        serviceable: true,
        estimatedDelivery: data.deliveryEstimate || data.estimatedDelivery || '4–6 business days',
        city: data.city,
        state: data.state,
      });
      setForm((prev) => ({
        ...prev,
        city: data.city || prev.city,
        district: data.district || prev.district,
        state: data.state || prev.state,
      }));
    } catch (err: any) {
      setPinInfo({
        serviceable: false,
        error: err?.message || 'PIN code not found. Please verify.',
      });
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        'Geolocation is not supported by this browser. Please enter your address manually.'
      );
      return;
    }
    setDetecting(true);
    setLocationMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const data = await apiRequest<any>(
            `/api/reverse-geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(
              longitude
            )}`
          );

          setForm((prev) => ({
            ...prev,
            streetArea: data.streetArea || prev.streetArea,
            city: data.city || prev.city,
            district: data.district || prev.district,
            state: data.state || prev.state,
            pincode: /^\d{6}$/.test(data.pincode) ? data.pincode : prev.pincode,
            landmark: data.landmark || prev.landmark,
          }));

          if (/^\d{6}$/.test(data.pincode)) {
            await lookupPincode(data.pincode);
          }

          setLocationMessage(
            'Address details detected from your coordinates. Please verify house/flat number before ordering.'
          );
        } catch (err: any) {
          setLocationMessage(
            err?.message || 'Unable to detect address. Please enter your details manually.'
          );
        } finally {
          setDetecting(false);
        }
      },
      (geoErr) => {
        setDetecting(false);
        setLocationMessage(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission declined. Please enter your shipping address manually.'
            : 'Could not determine your location right now. Please enter your address manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = form.mobile.replace(/\D/g, '');
    if (digits.length < 10) {
      notify('Please enter a valid 10-digit mobile / WhatsApp number for COD delivery.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      notify('Please enter a valid 6-digit Indian PIN code.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await placeCustomerOrder({
        actorUserId: user?.uid,
        shippingAddress: {
          fullName: form.fullName.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim(),
          houseFlat: form.houseFlat.trim(),
          streetArea: form.streetArea.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          landmark: form.landmark.trim(),
        },
        paymentMethod: 'cod',
        notes: form.notes.trim(),
        couponCode: cart.appliedCoupon?.code || null,
        subtotal: cart.subtotal,
        discountAmount: cart.discountAmount,
        shippingFee: cart.shippingFee,
        taxAmount: cart.taxAmount,
        grandTotal: cart.grandTotal,
        items: cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          colorName: item.colorName,
          sizeName: item.sizeName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.lineTotal,
          imageUrl: item.imageUrl,
        })),
      });

      clearCart();
      notify('COD Order confirmed! Thank you for shopping with ZARIFLY.', 'success');
      navigate(`/order-confirmation?order=${encodeURIComponent(res.orderNumber)}&payment=cod`);
    } catch (err: any) {
      notify(err?.message || 'Order placement failed. Please verify your details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
          {t('cart.empty')}
        </h1>
        <Link
          to="/shop"
          className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
        >
          {t('cart.continue')}
        </Link>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED] focus:bg-white transition-colors';

  return (
    <>
      <SEO
        title="Cash on Delivery Express Checkout | ZARIFLY Boutique"
        description="Complete your ZARIFLY handcrafted modest fashion order with instant Cash on Delivery, WhatsApp Login, and Indian PIN code serviceability."
        canonicalPath="/checkout"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
            Cash on Delivery Ready · Express Checkout
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            {t('checkout.title')}
          </h1>
        </div>

        {/* Optional Quick Sign-In Bar (WhatsApp / Google / Email) — Never blocks COD */}
        {!user ? (
          <div className="mb-8 rounded-[26px] bg-gradient-to-r from-[#ECFDF5] via-[#F3EEFF] to-[#FFF0F6] border border-[#E2D9F3] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-extrabold text-[#181326]">
                    Quick Login with WhatsApp (Optional) — or Order Directly with COD below!
                  </p>
                  <p className="text-xs text-[#5E5474]">
                    Sign in with WhatsApp to auto-fill your details &amp; save order history, or
                    proceed straight to Cash on Delivery checkout.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWaQuick((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#25D366] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-105 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => loginWithGoogle().catch((e) => notify(e.message, 'error'))}
                  className="px-4 py-2.5 rounded-full bg-[#181326] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  Google
                </button>
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-full bg-white border border-[#E2D9F3] text-[#181326] text-xs font-extrabold uppercase tracking-wider"
                >
                  Email
                </Link>
              </div>
            </div>

            {showWaQuick && (
              <div className="bg-white rounded-2xl border border-[#A7F3D0] p-4 sm:p-5 space-y-3">
                {!waOtpMeta ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Your Name (optional)"
                      value={waName}
                      onChange={(e) => setWaName(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="tel"
                      placeholder="10-digit WhatsApp Number"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className={`${inputClass} tabular-nums`}
                    />
                    <button
                      type="button"
                      disabled={waLoading}
                      onClick={handleQuickWaRequest}
                      className="py-3 px-5 rounded-full bg-[#25D366] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-105 cursor-pointer"
                    >
                      {waLoading ? 'Sending...' : 'Get WhatsApp Code'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {waOtpMeta.verificationCode && (
                      <button
                        type="button"
                        onClick={() => setWaCode(waOtpMeta.verificationCode || '')}
                        className="px-4 py-2.5 rounded-xl bg-[#ECFDF5] border border-[#25D366] text-xs font-extrabold text-[#047857] cursor-pointer"
                      >
                        Code: {waOtpMeta.verificationCode} (Tap to fill)
                      </button>
                    )}
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={waCode}
                      onChange={(e) => setWaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold tracking-widest bg-[#FAFAFF] border border-[#E2D9F3] w-44 tabular-nums"
                    />
                    <button
                      type="button"
                      disabled={waLoading || waCode.length !== 6}
                      onClick={handleQuickWaVerify}
                      className="px-5 py-2.5 rounded-full bg-[#25D366] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {waLoading ? 'Verifying...' : 'Verify'}
                    </button>
                    <a
                      href={waOtpMeta.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] underline"
                    >
                      Open WhatsApp <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 font-bold text-[#047857]">
              <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              Signed in as <strong>{user.fullName}</strong>{' '}
              {user.authProvider === 'whatsapp' ? `(${user.phone} · WhatsApp)` : `(${user.email})`}
            </span>
            <Link to="/account" className="font-bold text-[#047857] underline">
              My Orders
            </Link>
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Shipping Address & COD Payment */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-6 shadow-[0_10px_30px_rgba(124,58,237,0.05)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDE8F7]">
                <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
                  {t('checkout.shippingDetails')}
                </h2>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detecting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-extrabold bg-[#ECFEFF] text-[#0E7490] border border-[#06B6D4]/45 hover:bg-[#06B6D4] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>{detecting ? t('checkout.detecting') : t('checkout.detectLocation')}</span>
                </motion.button>
              </div>

              <p className="text-xs text-[#64597A]">{t('checkout.locationNote')}</p>
              {locationMessage && (
                <div className="text-xs rounded-2xl bg-[#FFF0F6] border border-[#FF4D8D]/30 p-3.5 text-[#4D4463]">
                  {locationMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.fullName')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter recipient's full name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    WhatsApp / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="+91 98XXXXXXXX"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.houseFlat')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Flat / House No., Building Name"
                    value={form.houseFlat}
                    onChange={(e) => setForm({ ...form, houseFlat: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.streetArea')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Street, Colony, Locality"
                    value={form.streetArea}
                    onChange={(e) => setForm({ ...form, streetArea: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.pincode')} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setForm({ ...form, pincode: val });
                      if (val.length === 6) lookupPincode(val);
                      else setPinInfo(null);
                    }}
                    placeholder="400001"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.city')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.state')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.landmark')}
                  </label>
                  <input
                    type="text"
                    placeholder="Near Mosque, School, Mall..."
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    Delivery Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Preferred delivery time or call instruction"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {pinInfo && (
                <div
                  className={`text-xs p-4 rounded-2xl border flex items-start gap-2.5 ${
                    pinInfo.serviceable
                      ? 'bg-[#ECFDF5] border-emerald-200 text-[#059669]'
                      : 'bg-red-50 border-red-200 text-[#DC2626]'
                  }`}
                >
                  {pinInfo.serviceable ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          COD Delivery Available ({pinInfo.city}, {pinInfo.state})
                        </p>
                        <p className="text-[#4D4463] mt-0.5">
                          Estimated delivery: {pinInfo.estimatedDelivery} · Cash or UPI at Doorstep
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{pinInfo.error}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cash on Delivery Payment Card */}
            <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-4 shadow-[0_10px_30px_rgba(124,58,237,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
                  {t('checkout.paymentMethod')}
                </h2>
                <span className="px-3 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-extrabold text-[#047857]">
                  ₹0 Extra COD Fee
                </span>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl border-2 border-[#FF4D8D] bg-[#FFF0F6]/60">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked
                  readOnly
                  className="mt-1 accent-[#FF4D8D]"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#181326]">
                    <Truck className="w-4 h-4 text-[#FF4D8D]" />
                    <span>Cash on Delivery (COD) — Pay at Doorstep</span>
                  </div>
                  <p className="text-xs text-[#64597A]">
                    Pay conveniently in cash or UPI directly to the courier partner when your
                    ZARIFLY parcel arrives.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order Summary + Coupon */}
          <aside className="lg:col-span-5 bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-5 shadow-[0_12px_36px_rgba(124,58,237,0.07)] lg:sticky lg:top-24">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
              {t('checkout.orderSummary')}
            </h2>

            <div className="divide-y divide-[#EDE8F7] max-h-72 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="py-3.5 flex gap-3.5">
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl object-cover bg-[#FFF0F6] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#181326] truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-[#64597A]">
                      {item.colorName} · {item.sizeName} × {item.quantity}
                    </p>
                    <p className="text-xs font-extrabold tabular-nums text-[#181326] mt-1">
                      {formatINR(item.lineTotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Coupon Box */}
            <div className="pt-2 border-t border-[#EDE8F7] space-y-2">
              {cart.appliedCoupon ? (
                <div className="flex items-center justify-between bg-[#F3EEFF] border border-[#7C3AED]/35 rounded-2xl px-4 py-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[#7C3AED] font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    {cart.appliedCoupon.code} applied
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCoupon()}
                    className="text-[#FF4D8D] font-bold hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Coupon code (e.g. ZARIFLY10)"
                      className="flex-1 px-4 py-2 rounded-full text-xs bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
                    />
                    <button
                      type="button"
                      disabled={applyingCoupon}
                      onClick={() => handleApplyCoupon()}
                      className="px-4 py-2 rounded-full bg-[#181326] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['ZARIFLY10', 'WELCOME200'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleApplyCoupon(code)}
                        className="px-2.5 py-1 rounded-full bg-[#FFF0F6] border border-[#FF4D8D]/30 text-[10px] font-extrabold text-[#C81D63] hover:bg-[#FF4D8D] hover:text-white transition-colors cursor-pointer"
                      >
                        Tap: {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm pt-3 border-t border-[#EDE8F7]">
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
                <span>Total Payable on Delivery</span>
                <span className="tabular-nums">{formatINR(cart.grandTotal)}</span>
              </div>
              <p className="text-[11px] text-[#64597A]">{cart.taxIncludedNote}</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold tracking-[0.14em] uppercase hover:brightness-110 disabled:opacity-45 transition-all shadow-[0_10px_28px_rgba(255,77,141,0.35)] cursor-pointer"
            >
              {submitting
                ? t('common.loading')
                : `Confirm Cash on Delivery Order (${formatINR(cart.grandTotal)})`}
            </motion.button>

            <p className="text-[11px] text-[#64597A] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
              <span>100% Safe COD · Instant Order Number &amp; WhatsApp Confirmation</span>
            </p>
          </aside>
        </form>
      </div>
    </>
  );
}
