import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Package, Printer, Search, Truck } from 'lucide-react';
import { apiRequest, formatINR } from '../lib/api';
import { SEO } from '../components/SEO';
import type { Order } from '../types';

const STATUS_STEPS = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order') || '';
  const paymentFlag = searchParams.get('payment') || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    apiRequest<{ order: Order }>(`/api/orders/${encodeURIComponent(orderNumber)}`)
      .then((res) => setOrder(res.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  const isFailed =
    paymentFlag === 'failed' ||
    paymentFlag === 'verification_failed' ||
    order?.paymentStatus === 'failed';

  return (
    <>
      <SEO
        title="Order Confirmation | ZARIFLY Boutique"
        description="View your ZARIFLY order confirmation and itemized boutique receipt."
        canonicalPath="/order-confirmation"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {loading ? (
          <div className="h-64 rounded-[30px] bg-white animate-pulse border border-[#EDE8F7]" />
        ) : !order ? (
          <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-10 text-center space-y-4 shadow-xs">
            <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
              Order Receipt Unavailable
            </h1>
            <p className="text-sm text-[#64597A]">
              We could not locate that order reference. Use Track Order with your order number to check status.
            </p>
            <Link
              to="/track-order"
              className="inline-block px-7 py-3.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider"
            >
              Track Order
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-[#EDE8F7] p-6 sm:p-10 space-y-8 shadow-[0_16px_45px_rgba(124,58,237,0.08)]">
            <div className="text-center space-y-3 pb-6 border-b border-[#EDE8F7]">
              {isFailed ? (
                <div className="w-16 h-16 rounded-full bg-red-50 mx-auto flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#DC2626]" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#ECFDF5] mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                </div>
              )}
              <p className="text-xs font-extrabold tracking-[0.16em] uppercase text-[#7C3AED] tabular-nums">
                Order #{order.orderNumber}
              </p>
              <h1 className="font-serif-display text-3xl sm:text-4xl font-extrabold text-[#181326]">
                {isFailed
                  ? 'Payment Was Not Completed'
                  : 'Thank You — Your Order Is Confirmed'}
              </h1>
              <p className="text-sm text-[#64597A] max-w-md mx-auto">
                {isFailed
                  ? 'Your payment could not be verified by PayU. Reserved inventory has been restored. You may retry from your bag or contact our WhatsApp concierge.'
                  : `Preparing shipment for ${order.customerName}. Estimated delivery: ${order.estimatedDelivery || '3–5 Business Days'}.`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-[#64597A]">
              <div className="p-4 rounded-2xl bg-[#FFF0F6]/65 space-y-1">
                <p className="font-extrabold text-[#181326] uppercase tracking-wider mb-1.5">
                  Delivery Address
                </p>
                <p className="text-[#181326] font-bold">{order.shippingAddressJson.fullName}</p>
                <p>
                  {order.shippingAddressJson.houseFlat}, {order.shippingAddressJson.streetArea}
                </p>
                <p>
                  {order.shippingAddressJson.city}, {order.shippingAddressJson.state} —{' '}
                  {order.shippingAddressJson.pincode}
                </p>
                <p>Mobile: {order.customerPhone}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F3EEFF]/75 space-y-1">
                <p className="font-extrabold text-[#181326] uppercase tracking-wider mb-1.5">
                  Payment &amp; Status
                </p>
                <p>
                  Method:{' '}
                  <strong className="text-[#181326] uppercase">{order.paymentMethod}</strong>
                </p>
                <p>
                  Payment Status:{' '}
                  <strong className="text-[#181326] capitalize">{order.paymentStatus}</strong>
                </p>
                <p>
                  Order Status:{' '}
                  <strong className="text-[#181326] capitalize">
                    {order.orderStatus.replace(/_/g, ' ')}
                  </strong>
                </p>
                <p>Placed: {new Date(order.createdAt).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="border-t border-[#EDE8F7] pt-6 space-y-4">
              <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                Ordered Pieces
              </h2>
              <div className="divide-y divide-[#EDE8F7]">
                {(order.items || []).map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-bold text-[#181326]">{item.productName}</p>
                      <p className="text-xs text-[#64597A]">
                        {item.colorName} · {item.sizeName} · SKU: {item.sku} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="font-extrabold tabular-nums text-[#181326]">
                      {formatINR(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#EDE8F7] space-y-1.5 text-sm">
                <div className="flex justify-between text-[#64597A]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(order.subtotal)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-[#FF4D8D] font-semibold">
                    <span>Discount ({order.couponCode})</span>
                    <span className="tabular-nums">-{formatINR(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64597A]">
                  <span>Shipping</span>
                  <span className="tabular-nums">
                    {order.shippingFee === 0 ? 'Complimentary' : formatINR(order.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-[#181326] pt-2 border-t border-[#EDE8F7]">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatINR(order.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EDE8F7]">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#181326] text-xs font-extrabold uppercase tracking-wider hover:bg-[#F3EEFF] transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
              <div className="flex gap-3">
                <Link
                  to="/track-order"
                  className="px-5 py-3 rounded-full border border-[#E2D9F3] text-xs font-extrabold uppercase tracking-wider hover:border-[#7C3AED]"
                >
                  Track Order
                </Link>
                <Link
                  to="/shop"
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    if (!orderNumber.trim()) return;
    try {
      setLoading(true);
      const qs = new URLSearchParams({ orderNumber: orderNumber.trim() });
      if (contact.trim()) qs.set('contact', contact.trim());
      const res = await apiRequest<{ order: Order }>(`/api/orders/track?${qs.toString()}`);
      setOrder(res.order);
    } catch (err: any) {
      setError(err?.message || 'Unable to locate this order.');
    } finally {
      setLoading(false);
    }
  };

  const activeStepIdx = order ? STATUS_STEPS.indexOf(order.orderStatus) : -1;

  return (
    <>
      <SEO
        title="Track Your Order | ZARIFLY Boutique"
        description="Track your ZARIFLY handcrafted hijab, naqaab, or dupatta order status and courier tracking details in real time."
        canonicalPath="/track-order"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#06B6D4]">
            Order Tracker
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            Track Your Order
          </h1>
          <p className="text-sm text-[#64597A]">
            Enter your ZARIFLY order number (e.g. ZRF-2026-XXXXXX) to check dispatch and courier updates.
          </p>
        </div>

        <form
          onSubmit={handleTrack}
          className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-[0_12px_36px_rgba(124,58,237,0.06)]"
        >
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Order Number (ZRF-...)"
            className="px-4 py-3 rounded-full text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
          />
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email or Mobile (optional)"
            className="px-4 py-3 rounded-full text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
          />
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-6 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Searching...' : 'Track Order'}</span>
          </button>
        </form>

        {error && (
          <div className="bg-red-50 rounded-2xl border border-red-200 text-[#DC2626] p-4 text-sm text-center font-semibold">
            {error}
          </div>
        )}

        {order && (
          <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-6 shadow-[0_12px_36px_rgba(124,58,237,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#EDE8F7]">
              <div>
                <p className="text-xs font-extrabold text-[#7C3AED] tabular-nums">
                  Order #{order.orderNumber}
                </p>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326] capitalize mt-0.5">
                  Status: {order.orderStatus.replace(/_/g, ' ')}
                </h2>
              </div>
              <div className="text-right text-xs text-[#64597A]">
                <p>
                  Total:{' '}
                  <strong className="text-[#181326] tabular-nums">
                    {formatINR(order.grandTotal)}
                  </strong>
                </p>
                <p className="capitalize">
                  Payment: {order.paymentMethod} ({order.paymentStatus})
                </p>
              </div>
            </div>

            {activeStepIdx >= 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= activeStepIdx;
                  return (
                    <div
                      key={step}
                      className={`p-3 rounded-2xl text-center text-[11px] font-bold capitalize transition-colors ${
                        done
                          ? 'bg-gradient-to-br from-[#FF4D8D] to-[#7C3AED] text-white shadow-sm'
                          : 'bg-[#FAFAFF] text-[#8B7FA6] border border-[#EDE8F7]'
                      }`}
                    >
                      {step.replace(/_/g, ' ')}
                    </div>
                  );
                })}
              </div>
            )}

            {(order.courierName || order.trackingNumber) && (
              <div className="rounded-2xl bg-[#ECFEFF]/75 border border-[#06B6D4]/35 p-4 text-xs flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-bold text-[#181326]">
                  <Truck className="w-4 h-4 text-[#06B6D4]" />
                  Courier: {order.courierName || 'Assigned'}
                </span>
                <span className="tabular-nums text-[#5E5474]">
                  Tracking ID: <strong className="text-[#181326]">{order.trackingNumber}</strong>
                </span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64597A] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#7C3AED]" />
                Items in Shipment
              </h3>
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between text-sm py-2.5 border-b border-[#EDE8F7]"
                >
                  <span className="text-[#181326]">
                    {item.productName} ({item.colorName} · {item.sizeName}) × {item.quantity}
                  </span>
                  <span className="tabular-nums font-extrabold text-[#181326]">
                    {formatINR(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
