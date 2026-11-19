# ZARIFLY Firestore Security Specification

## Phase 0: Data Invariants & Access Matrix

1. **Identity & Role Hierarchy**
   - Customers authenticate via Firebase Authentication (Email/Password or Google).
   - Admin access is granted ONLY when `request.auth != null` AND either:
     - `request.auth.token.email_verified == true` and `request.auth.token.email` is a verified ZARIFLY owner admin (`fixfly.in@gmail.com`, `admin@zarifly.com`, `info@zarifly.com`), OR
     - An active admin record exists at `/admins/$(request.auth.uid)` with `isActive == true`.
   - Regular users can NEVER self-assign `role: "admin"` or `role: "super_admin"` on `/users/{uid}`, nor write to `/admins/{adminId}`.

2. **PII Isolation & Private Data**
   - `/users/{userId}`, `/users/{userId}/addresses/{addressId}`, `/users/{userId}/wishlist/{productId}`: Readable & writable ONLY by `userId == request.auth.uid` or `isAdmin()`.
   - `/orders/{orderId}`, `/order_items/{orderItemId}`, `/payments/{paymentId}`: Readable ONLY by the owning customer (`resource.data.userId == request.auth.uid`) or `isAdmin()`. Never publicly listable.
   - `/order_tracking/{orderNumber}`: Contains ZERO PII (only order status, payment status, courier, tracking number, estimated delivery, grand total, city/state). Public `get` allowed by exact order number; public `list` denied to prevent order scraping.
   - `/newsletter_subscribers/{id}` and `/contact_messages/{id}`: Validated public `create` allowed; `read`, `update`, `delete` strictly restricted to `isAdmin()`.

3. **Catalog & CMS Integrity**
   - `/categories`, `/products`, `/product_variants`, `/inventory`, `/banners`, `/reels`, `/blogs`, `/coupons`, `/website_settings`, `/shipping_settings`: Public `read`; `create`, `update`, `delete` strictly `isAdmin()` (with bounded checkout stock decrement on `product_variants` and `inventory` by signed-in buyers).
   - `/reviews/{reviewId}`: Public `read` of approved reviews (plus owner/admin read of pending reviews); signed-in users may `create` ONLY with `userId == request.auth.uid`, `status == 'pending'`, `isVerifiedPurchase == false`; only `isAdmin()` can approve/edit/delete reviews.
   - `/admin_activity_logs/{logId}`: Append-only by `isAdmin()`; `update` and `delete` permanently denied.

4. **Structural & Temporal Invariants**
   - All document IDs validated via `isValidId(id)` (`^[a-zA-Z0-9_-]{1,128}$`).
   - All strings bounded by strict `.size()` limits; arrays bounded by max lengths.
   - All `createdAt` / `updatedAt` timestamps validated against `request.time` on write and `createdAt` kept immutable on update.
   - `allow list` rules NEVER use `get()` or `exists()`.

## The Dirty Dozen (Adversarial Payloads That Must Be Denied)

1. **Unauthenticated read of `/users/{uid}`** → DENIED (PII protection).
2. **Customer A reading Customer B's `/orders/{orderId}`** → DENIED (`resource.data.userId != request.auth.uid`).
3. **Customer self-escalating `role: "admin"` on `/users/{uid}` create or update** → DENIED (`role == 'customer'` enforced; `role` immutable by non-admins).
4. **Customer writing directly to `/admins/{uid}`** → DENIED (`isAdmin()` required).
5. **Customer modifying product price on `/products/{id}`** → DENIED (`isAdmin()` required).
6. **Customer publishing an auto-approved review (`status: "approved"`)** → DENIED (`status == 'pending'` enforced for non-admin create).
7. **Unauthenticated user listing `/order_tracking` collection** → DENIED (`allow list: if isAdmin()`).
8. **Customer forging another user's `userId` on `/orders/{orderId}` create** → DENIED (`request.resource.data.userId == request.auth.uid`).
9. **Customer updating their own order's `paymentStatus` to `"paid"`** → DENIED (`allow update: if isAdmin()`).
10. **Oversized spam payload (`comment` > 3000 chars or extra undeclared fields)** → DENIED (`hasOnly` + `.size()` checks).
11. **Backdated or future-dated `createdAt` on review/order create** → DENIED (`createdAt == request.time`).
12. **Admin attempting to delete or alter `/admin_activity_logs/{logId}`** → DENIED (`allow update, delete: if false`).
