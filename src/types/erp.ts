export const ORG_ID = 'naqaa-erp';
export const DEFAULT_TAX_RATE_PCT = 15;
export const BOOTSTRAP_ADMIN_EMAIL = 'ahmedalbannaweb@gmail.com';

export type UserRole = 'admin' | 'procurement' | 'warehouse' | 'sales' | 'finance' | 'viewer';
export type SupplierType = 'local' | 'international';
export type CurrencyCode = 'YER' | 'SAR' | 'USD' | 'AED';
export type ProductCategory =
  | 'detergents'
  | 'disinfectants'
  | 'dishwashing'
  | 'laundry'
  | 'glass_surface'
  | 'industrial';
export type RotationPolicy = 'FEFO' | 'FIFO';
export type POStatus = 'draft' | 'ordered' | 'in_transit' | 'customs' | 'received' | 'cancelled';
export type BatchStatus = 'active' | 'depleted' | 'quarantined' | 'expired';
export type CustomerSector = 'supermarket' | 'wholesale' | 'b2b';
export type VehicleStatus = 'ready' | 'on_route' | 'maintenance';
export type DeliveryStatus = 'pending' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'credit';
export type VoucherMethod = 'cash' | 'bank_transfer' | 'field_collection';

export interface UserProfile {
  id: string;
  uid: string;
  orgId: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  supplierType: SupplierType;
  country: string;
  contactName?: string;
  phone?: string;
  currency: CurrencyCode;
  paymentTermsDays: number;
  balanceYer: number;
  leadTimeDays?: number;
  active: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  baseUnitName: string;
  packUnitName: string;
  unitsPerPack: number;
  volumeLitersPerUnit: number;
  reorderPointUnits: number;
  storageTempMin?: number;
  storageTempMax?: number;
  defaultSupplierId?: string;
  lastPurchaseCostYer?: number;
  priceSupermarketYer: number;
  priceWholesaleYer: number;
  priceB2bYer: number;
  taxable: boolean;
  rotationPolicy: RotationPolicy;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  uom: 'base' | 'pack';
  quantityEntered: number;
  unitsPerPack: number;
  totalBaseUnits: number;
  unitCostYer: number;
  lineTotalYer: number;
}

export interface PurchaseOrder {
  id: string;
  orgId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  shipmentType: 'local' | 'import';
  status: POStatus;
  expectedDate?: string;
  goodsSubtotalYer: number;
  freightCostYer: number;
  customsDutyYer: number;
  totalLandedCostYer: number;
  paidAmountYer: number;
  items: PurchaseOrderItem[];
  notes?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryBatch {
  id: string;
  orgId: string;
  productId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  warehouseZone: string;
  recordedTempC?: number;
  mfgDate: string;
  expiryDate: string;
  initialUnits: number;
  remainingUnits: number;
  landedUnitCostYer: number;
  poId?: string;
  status: BatchStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockCount {
  id: string;
  orgId: string;
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  systemUnits: number;
  countedUnits: number;
  varianceUnits: number;
  reason: string;
  createdBy: string;
  createdAt?: unknown;
}

export interface Customer {
  id: string;
  orgId: string;
  name: string;
  sector: CustomerSector;
  routeName: string;
  assignedRepId?: string;
  phone?: string;
  cityDistrict?: string;
  creditLimitYer: number;
  balanceYer: number;
  active: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalesRep {
  id: string;
  orgId: string;
  name: string;
  phone?: string;
  routeName: string;
  commissionRatePct: number;
  vehicleId?: string;
  active: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FleetVehicle {
  id: string;
  orgId: string;
  plateNumber: string;
  modelName: string;
  driverName: string;
  capacityCartons: number;
  currentRoute: string;
  status: VehicleStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BatchAllocationSlice {
  batchId: string;
  batchNumber: string;
  unitsTaken: number;
  landedUnitCostYer: number;
  expiryDate: string;
}

export interface SalesOrderItem {
  productId: string;
  productName: string;
  sku: string;
  uom: 'base' | 'pack';
  quantityEntered: number;
  unitsPerPack: number;
  totalBaseUnits: number;
  unitPriceYer: number;
  lineSubtotalYer: number;
  lineCogsYer: number;
  lineProfitYer: number;
  allocations: BatchAllocationSlice[];
}

export interface SalesOrder {
  id: string;
  orgId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  sector: CustomerSector;
  repId?: string;
  repName?: string;
  vehicleId?: string;
  routeName?: string;
  paymentMethod: PaymentMethod;
  deliveryStatus: DeliveryStatus;
  subtotalYer: number;
  taxRatePct: number;
  taxAmountYer: number;
  totalYer: number;
  cogsYer: number;
  grossProfitYer: number;
  paidAmountYer: number;
  items: SalesOrderItem[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialPayment {
  id: string;
  orgId: string;
  voucherNumber: string;
  paymentType: 'customer_receipt' | 'supplier_payment';
  partyId: string;
  partyName: string;
  referenceDocId?: string;
  amountYer: number;
  method: VoucherMethod;
  notes?: string;
  createdBy: string;
  createdAt?: unknown;
}

// ---------------------------------------------------------------------------
// Domain Helpers & Formatting
// ---------------------------------------------------------------------------

export function formatYer(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `${new Intl.NumberFormat('en-US').format(safe)} ر.ي`;
}

export function formatNum(value: number, maxDecimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(safe);
}

export function formatPackagingSummary(totalBaseUnits: number, product: Product): string {
  const unitsPerPack = Math.max(1, product.unitsPerPack || 1);
  const packs = Math.floor(totalBaseUnits / unitsPerPack);
  const remainder = totalBaseUnits % unitsPerPack;
  if (unitsPerPack === 1) {
    return `${formatNum(totalBaseUnits, 0)} ${product.packUnitName}`;
  }
  if (packs > 0 && remainder > 0) {
    return `${formatNum(packs, 0)} ${product.packUnitName} و ${formatNum(remainder, 0)} ${product.baseUnitName}`;
  }
  if (packs > 0) {
    return `${formatNum(packs, 0)} ${product.packUnitName}`;
  }
  return `${formatNum(remainder, 0)} ${product.baseUnitName}`;
}

export function getSectorPrice(product: Product, sector: CustomerSector): number {
  if (sector === 'wholesale') return product.priceWholesaleYer;
  if (sector === 'b2b') return product.priceB2bYer;
  return product.priceSupermarketYer;
}

export function getDaysUntilExpiry(expiryDateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryClassification(expiryDateStr: string): {
  state: 'expired' | 'critical' | 'warning' | 'healthy';
  daysLeft: number;
  label: string;
} {
  const daysLeft = getDaysUntilExpiry(expiryDateStr);
  if (daysLeft <= 0) {
    return { state: 'expired', daysLeft, label: 'منتهي الصلاحية' };
  }
  if (daysLeft <= 45) {
    return { state: 'critical', daysLeft, label: `ينتهي خلال ${daysLeft} يوم` };
  }
  if (daysLeft <= 120) {
    return { state: 'warning', daysLeft, label: `صالح (${daysLeft} يوم)` };
  }
  return { state: 'healthy', daysLeft, label: `سليم (${daysLeft} يوم)` };
}

export function allocateBatchesForSale(
  productId: string,
  requiredBaseUnits: number,
  batches: InventoryBatch[],
  policy: RotationPolicy
): {
  allocations: BatchAllocationSlice[];
  totalCogsYer: number;
  availableUnits: number;
  sufficient: boolean;
} {
  const eligible = batches
    .filter(
      (b) =>
        b.productId === productId &&
        b.status === 'active' &&
        b.remainingUnits > 0 &&
        getDaysUntilExpiry(b.expiryDate) > 0
    )
    .sort((a, b) => {
      if (policy === 'FEFO') {
        return a.expiryDate.localeCompare(b.expiryDate);
      }
      return a.mfgDate.localeCompare(b.mfgDate);
    });

  const availableUnits = eligible.reduce((sum, b) => sum + b.remainingUnits, 0);
  let remainingToTake = requiredBaseUnits;
  const allocations: BatchAllocationSlice[] = [];
  let totalCogsYer = 0;

  for (const batch of eligible) {
    if (remainingToTake <= 0) break;
    const take = Math.min(batch.remainingUnits, remainingToTake);
    if (take > 0) {
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        unitsTaken: take,
        landedUnitCostYer: batch.landedUnitCostYer,
        expiryDate: batch.expiryDate,
      });
      totalCogsYer += take * batch.landedUnitCostYer;
      remainingToTake -= take;
    }
  }

  return {
    allocations,
    totalCogsYer: Math.round(totalCogsYer),
    availableUnits,
    sufficient: remainingToTake === 0 && requiredBaseUnits > 0,
  };
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'المدير العام',
  procurement: 'إدارة المشتريات',
  warehouse: 'إدارة المستودعات',
  sales: 'المبيعات والتوزيع',
  finance: 'الحسابات والمالية',
  viewer: 'مشاهد فقط',
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  detergents: 'منظفات متعددة الأغراض',
  disinfectants: 'معقمات ومطهرات',
  dishwashing: 'سوائل جلي الصحون',
  laundry: 'منظفات الغسيل',
  glass_surface: 'ملمعات الزجاج والأسطح',
  industrial: 'منظفات صناعية B2B',
};

export const SECTOR_LABELS: Record<CustomerSector, string> = {
  supermarket: 'سوبرماركت',
  wholesale: 'محلات جملة',
  b2b: 'قطاع تجاري B2B',
};

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: 'مسودة',
  ordered: 'تم الطلب',
  in_transit: 'قيد الشحن',
  customs: 'تخليص جمركي',
  received: 'مستلم بالمخزن',
  cancelled: 'ملغي',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'بانتظار التحميل',
  dispatched: 'في خط السير',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  ready: 'جاهزة للتحميل',
  on_route: 'في خط السير',
  maintenance: 'صيانة',
};
