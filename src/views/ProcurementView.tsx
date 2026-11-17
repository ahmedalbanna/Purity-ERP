import React, { useEffect, useState } from 'react';
import {
  Globe,
  MapPin,
  PackagePlus,
  Plus,
  Search,
  Ship,
  Trash2,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CurrencyCode,
  formatNum,
  formatYer,
  PO_STATUS_LABELS,
  POStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierType,
} from '../types/erp';
import { ModalDrawer } from '../components/ModalDrawer';

interface ProcurementViewProps {
  externalTrigger?: number;
}

export function ProcurementView({ externalTrigger }: ProcurementViewProps) {
  const {
    suppliers,
    products,
    purchaseOrders,
    createSupplier,
    createPurchaseOrder,
    advancePurchaseOrderStatus,
    receivePurchaseOrder,
    canEdit,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'orders' | 'suppliers'>('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all');

  // Create Supplier Modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supType, setSupType] = useState<SupplierType>('local');
  const [supCountry, setSupCountry] = useState('اليمن — صنعاء');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCurrency, setSupCurrency] = useState<CurrencyCode>('YER');
  const [supTerms, setSupTerms] = useState(30);
  const [supLead, setSupLead] = useState(7);

  // Create PO Modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poShipmentType, setPoShipmentType] = useState<'local' | 'import'>('local');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poFreightYer, setPoFreightYer] = useState(0);
  const [poCustomsYer, setPoCustomsYer] = useState(0);
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<
    { productId: string; uom: 'base' | 'pack'; quantity: number; unitCostYer: number }[]
  >([]);

  // Receive PO Modal
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [batchInputs, setBatchInputs] = useState<
    Record<
      string,
      {
        batchNumber: string;
        mfgDate: string;
        expiryDate: string;
        warehouseZone: string;
        recordedTempC: number;
      }
    >
  >({});

  const [submitting, setSubmitting] = useState(false);
  const allowProcEdit = canEdit(['admin', 'procurement']);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && allowProcEdit) {
      openCreatePoModal();
    }
  }, [externalTrigger]);

  const openCreatePoModal = () => {
    const firstSup = suppliers[0];
    setPoSupplierId(firstSup?.id || '');
    setPoShipmentType(firstSup?.supplierType === 'international' ? 'import' : 'local');
    const nextWeek = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setPoExpectedDate(nextWeek);
    setPoFreightYer(0);
    setPoCustomsYer(0);
    setPoNotes('');
    if (products[0]) {
      const p = products[0];
      setPoItems([
        {
          productId: p.id,
          uom: 'pack',
          quantity: 20,
          unitCostYer: (p.lastPurchaseCostYer || 600) * (p.unitsPerPack || 1),
        },
      ]);
    } else {
      setPoItems([]);
    }
    setPoModalOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    setSubmitting(true);
    try {
      await createSupplier({
        name: supName.trim(),
        supplierType: supType,
        country: supCountry.trim(),
        contactName: supContact.trim(),
        phone: supPhone.trim(),
        currency: supCurrency,
        paymentTermsDays: Number(supTerms) || 30,
        balanceYer: 0,
        leadTimeDays: Number(supLead) || 7,
        active: true,
      });
      setSupplierModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupPhone('');
    } finally {
      setSubmitting(false);
    }
  };

  const builtPoItems: PurchaseOrderItem[] = poItems
    .map((line) => {
      const prod = products.find((p) => p.id === line.productId);
      if (!prod) return null;
      const unitsPerPack = prod.unitsPerPack || 1;
      const totalBaseUnits =
        line.uom === 'pack' ? line.quantity * unitsPerPack : line.quantity;
      const lineTotalYer = Math.round(line.quantity * line.unitCostYer);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        uom: line.uom,
        quantityEntered: line.quantity,
        unitsPerPack,
        totalBaseUnits,
        unitCostYer: line.unitCostYer,
        lineTotalYer,
      };
    })
    .filter((x): x is PurchaseOrderItem => x !== null);

  const poSubtotalYer = builtPoItems.reduce((s, it) => s + it.lineTotalYer, 0);
  const poLandedTotalYer = poSubtotalYer + Number(poFreightYer || 0) + Number(poCustomsYer || 0);
  const overheadPct =
    poSubtotalYer > 0
      ? ((Number(poFreightYer || 0) + Number(poCustomsYer || 0)) / poSubtotalYer) * 100
      : 0;

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find((s) => s.id === poSupplierId);
    if (!supplier || builtPoItems.length === 0) {
      notify('يرجى اختيار المورد وإضافة صنف واحد على الأقل', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createPurchaseOrder({
        supplier,
        shipmentType: poShipmentType,
        expectedDate: poExpectedDate,
        freightCostYer: Number(poFreightYer) || 0,
        customsDutyYer: Number(poCustomsYer) || 0,
        notes: poNotes,
        items: builtPoItems,
      });
      setPoModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const initialMap: typeof batchInputs = {};
    po.items.forEach((it, idx) => {
      initialMap[it.productId] = {
        batchNumber: `LOT-${po.poNumber.slice(-3)}-${idx + 1}`,
        mfgDate: todayStr,
        expiryDate: nextYearStr,
        warehouseZone: 'المستودع الرئيسي - أ',
        recordedTempC: 20,
      };
    });
    setBatchInputs(initialMap);
    setReceivingPo(po);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPo) return;
    setSubmitting(true);
    try {
      await receivePurchaseOrder(receivingPo, batchInputs);
      setReceivingPo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPos = purchaseOrders.filter((po) => {
    const matchStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchText =
      !search.trim() ||
      po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      po.supplierName.includes(search.trim());
    return matchStatus && matchText;
  });

  const filteredSuppliers = suppliers.filter(
    (s) =>
      !search.trim() ||
      s.name.includes(search.trim()) ||
      s.country.includes(search.trim())
  );

  return (
    <div className="space-y-6">
      {/* Segmented View Controls & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'orders'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            أوامر الشراء والشحنات ({purchaseOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('suppliers')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'suppliers'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الموردون المحليون والدوليون ({suppliers.length})
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الأمر أو المورد..."
              className="pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0891B2] w-60"
            />
          </div>

          {allowProcEdit && tab === 'suppliers' && (
            <button
              type="button"
              onClick={() => setSupplierModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مورد جديد</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'orders' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'ordered', 'in_transit', 'customs', 'received'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'جميع الحالات' : PO_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
            {allowProcEdit && (
              <button
                type="button"
                onClick={openCreatePoModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span>أمر شراء جديد</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">رقم الأمر</th>
                  <th className="py-3 font-medium">المورد والنوع</th>
                  <th className="py-3 font-medium">قيمة البضاعة</th>
                  <th className="py-3 font-medium">الشحن والجمارك</th>
                  <th className="py-3 font-medium">التكلفة الشاملة</th>
                  <th className="py-3 font-medium">الحالة</th>
                  <th className="py-3 font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPos.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70">
                    <td className="py-3">
                      <div className="font-mono-num font-semibold text-slate-900">
                        {po.poNumber}
                      </div>
                      <div className="text-xs text-slate-500">
                        {po.items.length} أصناف · الوصول: {po.expectedDate || 'غير محدد'}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-slate-900">{po.supplierName}</div>
                      <div className="text-xs text-slate-500">
                        {po.shipmentType === 'import' ? 'استيراد دولي' : 'توريد محلي'}
                      </div>
                    </td>
                    <td className="py-3 font-mono-num text-slate-700">
                      {formatYer(po.goodsSubtotalYer)}
                    </td>
                    <td className="py-3 font-mono-num text-slate-600 text-xs">
                      شحن: {formatYer(po.freightCostYer)}
                      <br />
                      جمارك: {formatYer(po.customsDutyYer)}
                    </td>
                    <td className="py-3 font-mono-num font-bold text-[#0F4C81]">
                      {formatYer(po.totalLandedCostYer)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-semibold ${
                          po.status === 'received'
                            ? 'text-emerald-700'
                            : po.status === 'customs' || po.status === 'in_transit'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                        }`}
                      >
                        {PO_STATUS_LABELS[po.status]}
                      </span>
                    </td>
                    <td className="py-3">
                      {allowProcEdit && po.status !== 'received' && po.status !== 'cancelled' ? (
                        <div className="flex items-center gap-2">
                          {po.status === 'ordered' && (
                            <button
                              type="button"
                              onClick={() => advancePurchaseOrderStatus(po, 'in_transit')}
                              className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                            >
                              شحن للوصول
                            </button>
                          )}
                          {po.status === 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => advancePurchaseOrderStatus(po, 'customs')}
                              className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                            >
                              تخليص جمركي
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openReceiveModal(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>استلام للمخزن</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">مكتمل</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      لا توجد أوامر شراء مطابقة للبحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">المورد</th>
                  <th className="py-3 font-medium">التصنيف والدولة</th>
                  <th className="py-3 font-medium">المسؤول والهاتف</th>
                  <th className="py-3 font-medium">العملة وشروط السداد</th>
                  <th className="py-3 font-medium">مدة التوريد</th>
                  <th className="py-3 font-medium">الرصيد الدائن المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/70">
                    <td className="py-3 font-semibold text-slate-900">{sup.name}</td>
                    <td className="py-3 text-xs text-slate-600">
                      <div className="inline-flex items-center gap-1.5">
                        {sup.supplierType === 'international' ? (
                          <Globe className="w-3.5 h-3.5 text-[#0891B2]" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                        )}
                        <span>
                          {sup.supplierType === 'international' ? 'مورد دولي' : 'مورد محلي'} ·{' '}
                          {sup.country}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-xs text-slate-600">
                      {sup.contactName || '—'} ·{' '}
                      <span className="font-mono-num">{sup.phone || '—'}</span>
                    </td>
                    <td className="py-3 text-xs text-slate-700 font-mono-num">
                      {sup.currency} · {sup.paymentTermsDays} يوم
                    </td>
                    <td className="py-3 text-xs text-slate-600 font-mono-num">
                      {sup.leadTimeDays ?? 7} يوم
                    </td>
                    <td className="py-3 font-mono-num font-bold text-slate-900">
                      {formatYer(sup.balanceYer)}
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      لا يوجد موردون مسجلون
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Supplier */}
      <ModalDrawer
        open={supplierModalOpen}
        title="تسجيل مورد جديد"
        subtitle="إضافة مورد محلي أو دولي مع تحديد شروط الدفع وعملة التوريد"
        onClose={() => setSupplierModalOpen(false)}
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المورد</label>
              <input
                required
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="مثال: شركة الروابي للمنظفات"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0891B2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع المورد</label>
              <select
                value={supType}
                onChange={(e) => {
                  const val = e.target.value as SupplierType;
                  setSupType(val);
                  if (val === 'international') setSupCurrency('USD');
                  else setSupCurrency('YER');
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="local">مورد محلي</option>
                <option value="international">مورد دولي (استيراد)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الدولة والمدينة</label>
              <input
                required
                value={supCountry}
                onChange={(e) => setSupCountry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">عملة التوريد</label>
              <select
                value={supCurrency}
                onChange={(e) => setSupCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="YER">الريال اليمني (YER)</option>
                <option value="SAR">الريال السعودي (SAR)</option>
                <option value="USD">الدولار الأمريكي (USD)</option>
                <option value="AED">الدرهم الإماراتي (AED)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المسؤول</label>
              <input
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">مهلة السداد (أيام)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={supTerms}
                onChange={(e) => setSupTerms(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">مدة التوريد المتوقعة (أيام)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={supLead}
                onChange={(e) => setSupLead(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSupplierModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ المورد'}
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* Modal: Create Purchase Order */}
      <ModalDrawer
        open={poModalOpen}
        title="إصدار أمر شراء وتقدير تكاليف الاستيراد"
        subtitle="حساب التكلفة الشاملة (Landed Cost) بإضافة الشحن والنقل والجمارك على أسعار البضاعة"
        onClose={() => setPoModalOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المورد</label>
              <select
                required
                value={poSupplierId}
                onChange={(e) => {
                  const sup = suppliers.find((s) => s.id === e.target.value);
                  setPoSupplierId(e.target.value);
                  if (sup) {
                    setPoShipmentType(sup.supplierType === 'international' ? 'import' : 'local');
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">اختر المورد</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplierType === 'international' ? 'دولي' : 'محلي'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الشحنة</label>
              <select
                value={poShipmentType}
                onChange={(e) => setPoShipmentType(e.target.value as 'local' | 'import')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="local">توريد محلي</option>
                <option value="import">شحنة استيراد دولي</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الوصول المتوقع</label>
              <input
                type="date"
                value={poExpectedDate}
                onChange={(e) => setPoExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>

          {/* PO Line Items */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">أصناف أمر الشراء</span>
              <button
                type="button"
                onClick={() => {
                  const firstP = products[0];
                  if (!firstP) return;
                  setPoItems((prev) => [
                    ...prev,
                    {
                      productId: firstP.id,
                      uom: 'pack',
                      quantity: 10,
                      unitCostYer: (firstP.lastPurchaseCostYer || 600) * (firstP.unitsPerPack || 1),
                    },
                  ]);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0891B2] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة صنف</span>
              </button>
            </div>

            {poItems.map((line, index) => {
              const prod = products.find((p) => p.id === line.productId);
              const baseUnits =
                line.uom === 'pack' ? line.quantity * (prod?.unitsPerPack || 1) : line.quantity;
              return (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end pt-2 border-t border-slate-100"
                >
                  <div className="md:col-span-5">
                    <label className="block text-[11px] text-slate-500 mb-1">الصنف</label>
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const np = products.find((p) => p.id === e.target.value);
                        setPoItems((prev) =>
                          prev.map((it, idx) =>
                            idx === index
                              ? {
                                  ...it,
                                  productId: e.target.value,
                                  unitCostYer:
                                    (np?.lastPurchaseCostYer || 600) *
                                    (it.uom === 'pack' ? np?.unitsPerPack || 1 : 1),
                                }
                              : it
                          )
                        );
                      }}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">الوحدة</label>
                    <select
                      value={line.uom}
                      onChange={(e) => {
                        const nextUom = e.target.value as 'base' | 'pack';
                        setPoItems((prev) =>
                          prev.map((it, idx) =>
                            idx === index
                              ? {
                                  ...it,
                                  uom: nextUom,
                                  unitCostYer:
                                    (prod?.lastPurchaseCostYer || 600) *
                                    (nextUom === 'pack' ? prod?.unitsPerPack || 1 : 1),
                                }
                              : it
                          )
                        );
                      }}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="pack">{prod?.packUnitName || 'كرتون'}</option>
                      <option value="base">{prod?.baseUnitName || 'عبوة'}</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">
                      الكمية ({baseUnits} {prod?.baseUnitName})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setPoItems((prev) =>
                          prev.map((it, idx) =>
                            idx === index ? { ...it, quantity: Number(e.target.value) } : it
                          )
                        )
                      }
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono-num"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">تكلفة الوحدة (ر.ي)</label>
                    <input
                      type="number"
                      min={1}
                      value={line.unitCostYer}
                      onChange={(e) =>
                        setPoItems((prev) =>
                          prev.map((it, idx) =>
                            idx === index ? { ...it, unitCostYer: Number(e.target.value) } : it
                          )
                        )
                      }
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono-num"
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setPoItems((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label="حذف السطر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Freight & Customs Landed Cost */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تكاليف الشحن والنقل (ر.ي)
              </label>
              <input
                type="number"
                min={0}
                value={poFreightYer}
                onChange={(e) => setPoFreightYer(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الرسوم الجمركية والتخليص (ر.ي)
              </label>
              <input
                type="number"
                min={0}
                value={poCustomsYer}
                onChange={(e) => setPoCustomsYer(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات الشحنة</label>
            <input
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="رقم بوليصة الشحن أو المنفذ الجمركي..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              قيمة البضاعة: <strong className="font-mono-num">{formatYer(poSubtotalYer)}</strong>
            </div>
            <div>
              نسبة مصاريف الاستيراد والنقل:{' '}
              <strong className="font-mono-num text-[#0891B2]">+{formatNum(overheadPct, 1)}%</strong>
            </div>
            <div className="text-sm">
              التكلفة الشاملة (Landed):{' '}
              <strong className="font-mono-num text-[#0F4C81]">{formatYer(poLandedTotalYer)}</strong>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPoModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'جاري الإصدار...' : 'إصدار أمر الشراء'}
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* Modal: Receive PO & Generate Batches */}
      <ModalDrawer
        open={Boolean(receivingPo)}
        title={`استلام الشحنة ${receivingPo?.poNumber || ''} وتوليد دفعات الصلاحية`}
        subtitle="تُوزع تكاليف الشحن والجمارك تلقائياً على تكلفة العبوة الفعلية عند الإدخال للمستودع"
        onClose={() => setReceivingPo(null)}
        maxWidthClass="max-w-3xl"
      >
        {receivingPo && (
          <form onSubmit={handleConfirmReceive} className="space-y-4">
            <div className="bg-cyan-50/70 border border-cyan-200 rounded-lg p-3 text-xs text-cyan-950 flex items-center gap-2">
              <Ship className="w-4 h-4 text-[#0891B2] shrink-0" />
              <span>
                إجمالي التكلفة الشاملة: <strong className="font-mono-num">{formatYer(receivingPo.totalLandedCostYer)}</strong>{' '}
                (تشمل {formatYer(receivingPo.freightCostYer + receivingPo.customsDutyYer)} مصاريف نقل وجمارك)
              </span>
            </div>

            {receivingPo.items.map((item) => {
              const overhead = receivingPo.freightCostYer + receivingPo.customsDutyYer;
              const share =
                (item.lineTotalYer / Math.max(1, receivingPo.goodsSubtotalYer)) * overhead;
              const landedUnit = Math.round(
                (item.lineTotalYer + share) / Math.max(1, item.totalBaseUnits)
              );
              const input = batchInputs[item.productId];
              if (!input) return null;

              return (
                <div
                  key={item.productId}
                  className="border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-900">{item.productName}</div>
                    <div className="text-xs text-slate-600 font-mono-num">
                      الكمية: {item.totalBaseUnits} وحدة · التكلفة الشاملة للوحدة:{' '}
                      <strong className="text-[#0F4C81]">{formatYer(landedUnit)}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">رقم الدفعة</label>
                      <input
                        required
                        value={input.batchNumber}
                        onChange={(e) =>
                          setBatchInputs((prev) => ({
                            ...prev,
                            [item.productId]: { ...input, batchNumber: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">تاريخ الإنتاج</label>
                      <input
                        required
                        type="date"
                        value={input.mfgDate}
                        onChange={(e) =>
                          setBatchInputs((prev) => ({
                            ...prev,
                            [item.productId]: { ...input, mfgDate: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">تاريخ الانتهاء</label>
                      <input
                        required
                        type="date"
                        value={input.expiryDate}
                        onChange={(e) =>
                          setBatchInputs((prev) => ({
                            ...prev,
                            [item.productId]: { ...input, expiryDate: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">موقع المستودع</label>
                      <input
                        required
                        value={input.warehouseZone}
                        onChange={(e) =>
                          setBatchInputs((prev) => ({
                            ...prev,
                            [item.productId]: { ...input, warehouseZone: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">حرارة الاستلام (°م)</label>
                      <input
                        required
                        type="number"
                        value={input.recordedTempC}
                        onChange={(e) =>
                          setBatchInputs((prev) => ({
                            ...prev,
                            [item.productId]: {
                              ...input,
                              recordedTempC: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono-num"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReceivingPo(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'جاري الترحيل...' : 'تأكيد الاستلام وإدخال الدفعات'}
              </button>
            </div>
          </form>
        )}
      </ModalDrawer>
    </div>
  );
}
