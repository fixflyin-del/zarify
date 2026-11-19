import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CreditCard, LocateFixed, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiRequest, formatINR } from '../lib/api';
import { SEO } from '../components/SEO';

export function CheckoutPage() {
  const { cart, user, t, refreshCart, notify } = useStore();
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
    latitude: '',
    longitude: '',
    notes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'payu' | 'cod'>('payu');
  const [payuStatus, setPayuStatus] = useState<{ configured: boolean; env: string } | null>(null);
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
        email: prev.email || user.email || '',
        mobile: prev.mobile || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    apiRequest<{ configured: boolean; env: string }>('/api/payments/payu/status')
      .then((status) => {
        setPayuStatus(status);
        if (!status.configured) {
          setPaymentMethod('cod');
        }
      })
      .catch(() => {});
  }, []);

  const lookupPincode = async (pin: string) => {
    if (!/^\d{6}$/.test(pin)) {
      setPinInfo(null);
      return;
    }
    try {
      const data = await apiRequest<any>(`/api/pincode/${pin}`);
      setPinInfo({
        serviceable: true,
        estimatedDelivery: data.estimatedDelivery,
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
            houseFlat: data.houseFlat || prev.houseFlat,
            streetArea: data.streetArea || prev.streetArea,
            city: data.city || prev.city,
            district: data.district || prev.district,
            state: data.state || prev.state,
            pincode: /^\d{6}$/.test(data.pincode) ? data.pincode : prev.pincode,
            latitude: String(latitude),
            longitude: String(longitude),
          }));

          if (/^\d{6}$/.test(data.pincode)) {
            await lookupPincode(data.pincode);
          }

          setLocationMessage(
            'Available address details detected from your coordinates. Please verify and complete any missing house/flat number before ordering.'
          );
        } catch (err: any) {
          setLocationMessage(
            err?.message || 'Unable to reverse-geocode your location. Please enter address manually.'
          );
        } finally {
          setDetecting(false);
        }
      },
      (geoErr) => {
        setDetecting(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setLocationMessage(
            'Location permission was declined. You can enter your shipping address and 6-digit PIN code manually below.'
          );
        } else {
          setLocationMessage(
            'Could not determine your location right now. Please enter your address manually.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const submitPayUForm = (actionUrl: string, fields: Record<string, string>) => {
    const formEl = document.createElement('form');
    formEl.method = 'POST';
    formEl.action = actionUrl;
    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      formEl.appendChild(input);
    });
    document.body.appendChild(formEl);
    formEl.submit();
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      notify('Please enter a valid 6-digit Indian PIN code.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest<{
        order: { orderNumber: string };
        paymentGateway: 'payu' | 'cod';
        payuPayload?: { actionUrl: string; fields: Record<string, string> };
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          paymentMethod,
          estimatedDelivery: pinInfo?.estimatedDelivery || '3–5 Business Days',
        }),
      });

      if (res.paymentGateway === 'payu' && res.payuPayload) {
        submitPayUForm(res.payuPayload.actionUrl, res.payuPayload.fields);
        return;
      }

      await refreshCart();
      navigate(`/order-confirmation?order=${encodeURIComponent(res.order.orderNumber)}&payment=cod`);
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
        title="Secure Checkout | ZARIFLY Boutique"
        description="Complete your ZARIFLY handcrafted modest fashion order with automatic location detection, Indian PIN code serviceability, and PayU India secure payments."
        canonicalPath="/checkout"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
            Encrypted Express Checkout
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            {t('checkout.title')}
          </h1>
        </div>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Shipping Address & Payment */}
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-extrabold bg-[#ECFEFF] text-[#0E7490] border border-[#06B6D4]/45 hover:bg-[#06B6D4] hover:text-white transition-colors whitespace-nowrap"
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
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5E5474] mb-1.5">
                    {t('checkout.mobile')} *
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
                    {t('checkout.email')} *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
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
                          Serviceable PIN ({pinInfo.city}, {pinInfo.state})
                        </p>
                        <p className="text-[#4D4463] mt-0.5">
                          Estimated delivery: {pinInfo.estimatedDelivery}
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

            {/* Payment Method */}
            <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-5 shadow-[0_10px_30px_rgba(124,58,237,0.05)]">
              <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
                {t('checkout.paymentMethod')}
              </h2>

              <div className="space-y-3">
                <label
                  className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'payu'
                      ? 'border-[#7C3AED] bg-[#F3EEFF]/60'
                      : 'border-[#EDE8F7] hover:border-[#FF4D8D]/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'payu'}
                    onChange={() => setPaymentMethod('payu')}
                    className="mt-1 accent-[#7C3AED]"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#181326]">
                      <CreditCard className="w-4 h-4 text-[#7C3AED]" />
                      <span>{t('checkout.payuLabel')}</span>
                    </div>
                    <p className="text-xs text-[#64597A]">
                      Server-signed SHA-512 redirect to official PayU India checkout (
                      {payuStatus?.env === 'production' ? 'Production' : 'Sandbox'}).
                    </p>
                    {payuStatus && !payuStatus.configured && (
                      <p className="text-xs text-[#FF4D8D] pt-1 font-medium">
                        Awaiting merchant credentials (`PAYU_MERCHANT_KEY` &amp; `PAYU_MERCHANT_SALT`
                        in environment secrets). Please select Cash on Delivery or configure PayU
                        keys to complete online payment.
                      </p>
                    )}
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-[#FF4D8D] bg-[#FFF0F6]/60'
                      : 'border-[#EDE8F7] hover:border-[#7C3AED]/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="mt-1 accent-[#FF4D8D]"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#181326]">
                      <Truck className="w-4 h-4 text-[#FF4D8D]" />
                      <span>{t('checkout.codLabel')}</span>
                    </div>
                    <p className="text-xs text-[#64597A]">
                      Pay in cash or UPI directly to the courier partner upon inspecting your parcel.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <aside className="lg:col-span-5 bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-5 shadow-[0_12px_36px_rgba(124,58,237,0.07)] lg:sticky lg:top-24">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326]">
              {t('checkout.orderSummary')}
            </h2>

            <div className="divide-y divide-[#EDE8F7] max-h-80 overflow-y-auto pr-1">
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
                <span>{t('cart.total')}</span>
                <span className="tabular-nums">{formatINR(cart.grandTotal)}</span>
              </div>
              <p className="text-[11px] text-[#64597A]">{cart.taxIncludedNote}</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting || (paymentMethod === 'payu' && payuStatus !== null && !payuStatus.configured)}
              className="w-full py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#7C3AED] text-white text-xs font-extrabold tracking-[0.14em] uppercase hover:brightness-110 disabled:opacity-45 transition-all shadow-[0_10px_28px_rgba(255,77,141,0.35)]"
            >
              {submitting
                ? t('common.loading')
                : paymentMethod === 'payu'
                  ? `Pay ${formatINR(cart.grandTotal)} via PayU`
                  : `${t('checkout.placeOrder')} (${formatINR(cart.grandTotal)})`}
            </motion.button>

            <p className="text-[11px] text-[#64597A] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
              <span>Transaction-safe inventory reservation &amp; encrypted checkout</span>
            </p>
          </aside>
        </form>
      </div>
    </>
  );
}
