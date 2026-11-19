/**
 * ZARIFLY Firestore Security Rules Verification Specification
 * Covers the Dirty Dozen adversarial test matrix against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actor: 'anonymous' | 'customerA' | 'customerB' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expected: 'ALLOW' | 'DENY';
  rationale: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Anonymous user reads customer profile',
    actor: 'anonymous',
    operation: 'get',
    path: '/users/uid_customer_a',
    expected: 'DENY',
    rationale: 'Users collection holds PII and is strictly owner or admin.',
  },
  {
    id: 2,
    name: 'Customer B reads Customer A order',
    actor: 'customerB',
    operation: 'get',
    path: '/orders/order_1001',
    expected: 'DENY',
    rationale: 'Orders are scoped to resource.data.userId == request.auth.uid or isAdmin().',
  },
  {
    id: 3,
    name: 'Customer self-assigns admin role on profile create',
    actor: 'customerA',
    operation: 'create',
    path: '/users/uid_customer_a',
    expected: 'DENY',
    rationale: 'Non-admin users must create profile with role == "customer" only.',
  },
  {
    id: 4,
    name: 'Customer writes to /admins directory',
    actor: 'customerA',
    operation: 'create',
    path: '/admins/uid_customer_a',
    expected: 'DENY',
    rationale: 'Only existing verified admins may manage /admins.',
  },
  {
    id: 5,
    name: 'Customer mutates product price',
    actor: 'customerA',
    operation: 'update',
    path: '/products/prod-1',
    expected: 'DENY',
    rationale: 'Catalog writes require isAdmin().',
  },
  {
    id: 6,
    name: 'Customer submits pre-approved review',
    actor: 'customerA',
    operation: 'create',
    path: '/reviews/rev_hack',
    expected: 'DENY',
    rationale: 'Non-admin reviews must have status == "pending" and isVerifiedPurchase == false.',
  },
  {
    id: 7,
    name: 'Anonymous user lists /order_tracking',
    actor: 'anonymous',
    operation: 'list',
    path: '/order_tracking',
    expected: 'DENY',
    rationale: 'Only single-document get by exact orderNumber is permitted publicly.',
  },
  {
    id: 8,
    name: 'Customer creates order under another userId',
    actor: 'customerA',
    operation: 'create',
    path: '/orders/order_spoof',
    expected: 'DENY',
    rationale: 'request.resource.data.userId must equal request.auth.uid.',
  },
  {
    id: 9,
    name: 'Customer marks own order paymentStatus as paid',
    actor: 'customerA',
    operation: 'update',
    path: '/orders/order_1001',
    expected: 'DENY',
    rationale: 'Only admins may update order/payment statuses.',
  },
  {
    id: 10,
    name: 'Anonymous user reads newsletter subscribers',
    actor: 'anonymous',
    operation: 'list',
    path: '/newsletter_subscribers',
    expected: 'DENY',
    rationale: 'Subscriber email addresses are PII readable only by admins.',
  },
  {
    id: 11,
    name: 'Anonymous user injects extra unvalidated fields into contact message',
    actor: 'anonymous',
    operation: 'create',
    path: '/contact_messages/msg_1',
    expected: 'DENY',
    rationale: 'Strict hasAll + hasOnly field validation blocks arbitrary keys.',
  },
  {
    id: 12,
    name: 'Admin attempts to delete immutable activity log',
    actor: 'admin',
    operation: 'delete',
    path: '/admin_activity_logs/log_1',
    expected: 'DENY',
    rationale: 'Audit logs are strictly append-only (update/delete always false).',
  },
];
