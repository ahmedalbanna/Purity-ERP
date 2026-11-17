# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Organization Isolation (`orgId == 'naqaa-erp'`)**: Every operational ERP record belongs to the organization scope and queries must filter explicitly by `orgId`.
2. **Identity & Email Verification**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`. `createdBy` must always equal `request.auth.uid`.
3. **No Self-Assigned Privilege Escalation**: Users registering their own `/users/{uid}` profile can only assign `role: 'viewer'` unless the actor is already a verified Admin (`ahmedalbannaweb@gmail.com` or an existing `/admins/{uid}` marker).
4. **PII Isolation**: User email is isolated in `/users/{uid}/private/info`, readable and writable only by the owner or Admin.
5. **Terminal State Locking**: Once a `PurchaseOrder` reaches `'received'` or `'cancelled'`, or a `SalesOrder` reaches `'delivered'` or `'cancelled'`, non-admin users cannot revert or mutate line items or totals (only payment reconciliation `paidAmountYer` via authorized finance/admin update).
6. **Temporal Integrity**: All `createdAt` fields must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on update.
7. **Strict Key & Size Boundaries**: Every write validates `keys().hasAll(...)` + `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, and string/array upper bounds on every field.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Listing `/products` with `auth == null`.
2. **Unverified Email Write**: Creating a `/suppliers/{id}` document with `email_verified: false`.
3. **Admin Email Spoof**: Accessing `/admins/{uid}` with `email: 'ahmedalbannaweb@gmail.com'` and `email_verified: false`.
4. **Self-Assigned Admin Role**: Creating `/users/{uid}` with `role: 'admin'` by a non-admin user.
5. **Shadow Field Injection**: Creating `/products/{id}` with an extra undocumented key `isDiscountedOverride: true`.
6. **ID Poisoning**: Creating `/products/{1500_char_invalid_id}` with spaces or >128 characters.
7. **Identity Spoofing**: Creating `/salesOrders/{id}` with `createdBy: 'another_user_uid'`.
8. **Timestamp Forgery**: Creating `/batches/{id}` with a backdated client `createdAt` instead of `request.time`.
9. **Immutable Field Mutation**: Updating `/salesOrders/{id}` attempting to change `createdBy` or `createdAt`.
10. **PII Cross-Read**: User B attempting `get` on `/users/userA/private/info`.
11. **Terminal State Tampering**: Non-admin attempting to edit `items` or `totalYer` on a `'delivered'` `/salesOrders/{id}`.
12. **Blanket List Scraping**: Executing `collection('salesOrders')` without `where('orgId', '==', 'naqaa-erp')`.
