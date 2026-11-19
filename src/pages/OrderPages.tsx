import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Printer, Search, Truck } from 'lucide-react';
import { formatINR } from '../lib/api';
import { fetchOrderByNumberForUser, trackOrderPublic } from '../lib/firestoreStore';
import { useStore } from '../context/StoreContext';
import { SEO } from '../components/SEO';
import type { Order, OrderTrackingSummary } from '../types';

const STATUS_STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

export function OrderConfirmationPage() {
  const { user } = useStore();
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
    fetchOrderByNumberForUser(orderNumber)
      .then((res) => setOrder(res))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderNumber, user?.uid]);

  const isFailed = paymentFlag === 'failed' || order?.paymentStatus === 'failed';

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
              Please sign in with the account used to place this order, or check status in Track Order.
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
                {isFailed ? 'Payment Was Not Completed' : 'Thank You — Your Order Is Confirmed'}
              </h1>
              <p className="text-sm text-[#64597A] max-w-md mx-auto">
                Preparing shipment for {order.customerName}. Estimated delivery:{' '}
                {order.estimatedDelivery || '4–6 business days'}.
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
                  Method: <strong className="text-[#181326] uppercase">{order.paymentMethod}</strong>
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#181326] text-xs font-extrabold uppercase tracking-wider hover:bg-[#F3EEFF] transition-colors cursor-pointer"
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
  const [tracking, setTracking] = useState<OrderTrackingSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTracking(null);
    if (!orderNumber.trim()) return;
    try {
      setLoading(true);
      const res = await trackOrderPublic(orderNumber.trim());
      if (!res) {
        setError('Order not found. Please double-check your ZARIFLY order number (e.g. ZRF-XXXXXX-XXX).');
      } else {
        setTracking(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to locate this order.');
    } finally {
      setLoading(false);
    }
  };

  const activeStepIdx = tracking ? STATUS_STEPS.indexOf(tracking.orderStatus) : -1;

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
            Enter your ZARIFLY order number (e.g. ZRF-123456-789) to view live dispatch status.
          </p>
        </div>

        <form
          onSubmit={handleTrack}
          className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 flex flex-col sm:flex-row gap-4 shadow-[0_12px_36px_rgba(124,58,237,0.06)]"
        >
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="Order Number (ZRF-...)"
            className="flex-1 px-5 py-3.5 rounded-full text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED]"
          />
          <button
            type="submit"
            disabled={loading}
            className="py-3.5 px-8 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
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

        {tracking && (
          <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-8 space-y-6 shadow-[0_12px_36px_rgba(124,58,237,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#EDE8F7]">
              <div>
                <p className="text-xs font-extrabold text-[#7C3AED] tabular-nums">
                  Order #{tracking.orderNumber}
                </p>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326] capitalize mt-0.5">
                  Status: {tracking.orderStatus.replace(/_/g, ' ')}
                </h2>
                {tracking.cityState && (
                  <p className="text-xs text-[#64597A] mt-1">Destination: {tracking.cityState}</p>
                )}
              </div>
              <div className="text-right text-xs text-[#64597A]">
                <p>
                  Total:{' '}
                  <strong className="text-[#181326] tabular-nums">
                    {formatINR(tracking.grandTotal)}
                  </strong>
                </p>
                <p className="capitalize">
                  Payment: {tracking.paymentMethod} ({tracking.paymentStatus})
                </p>
                <p>Placed: {new Date(tracking.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {activeStepIdx >= 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
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

            {(tracking.courierName || tracking.trackingNumber || tracking.estimatedDelivery) && (
              <div className="rounded-2xl bg-[#ECFEFF]/75 border border-[#06B6D4]/35 p-4 text-xs flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-bold text-[#181326]">
                  <Truck className="w-4 h-4 text-[#06B6D4]" />
                  Courier: {tracking.courierName || 'ZARIFLY Express Partner'}
                </span>
                {tracking.trackingNumber && (
                  <span className="tabular-nums text-[#5E5474]">
                    Tracking ID: <strong className="text-[#181326]">{tracking.trackingNumber}</strong>
                  </span>
                )}
                {tracking.estimatedDelivery && (
                  <span className="text-[#5E5474]">
                    ETA: <strong className="text-[#181326]">{tracking.estimatedDelivery}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
