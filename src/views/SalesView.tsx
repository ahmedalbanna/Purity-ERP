import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, UserCheck } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  allocateBatchesForSale,
  CustomerSector,
  DEFAULT_TAX_RATE_PCT,
  DELIVERY_STATUS_LABELS,
  formatNum,
  formatYer,
  getSectorPrice,
  PaymentMethod,
  SECTOR_LABELS,
} from '../types/erp';
import { ModalDrawer } from '../components/ModalDrawer';

interface SalesViewProps {
  externalTrigger?: number;
}

export function SalesView({ externalTrigger }: SalesViewProps) {
  const {
    customers,
    products,
    batches,
    salesReps,
    vehicles,
    salesOrders,
    createCustomer,
    createSalesRep,
    createSalesOrder,
    canEdit,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'invoices' | 'customers' | 'reps'>('invoices');
  const [sectorFilter, setSectorFilter] = useState<'all' | CustomerSector>('all');
  const [search, setSearch] = useState('');

  // Create Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedRepId, setSelectedRepId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [taxRatePct, setTaxRatePct] = useState(DEFAULT_TAX_RATE_PCT);
  const [lineItems, setLineItems] = useState<
    { productId: string; uom: 'base' | 'pack'; quantity: number }[]
  >([]);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Create Customer Modal
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custSector, setCustSector] = useState<CustomerSector>('supermarket');
  const [custRoute, setCustRoute] = useState('خط السير الشمالي — صنعاء');
  const [custRepId, setCustRepId] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState(2000000);

  // Create Rep Modal
  const [repModalOpen, setRepModalOpen] = useState(false);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [repRoute, setRepRoute] = useState('خط السير الشمالي — صنعاء');
  const [repCommission, setRepCommission] = useState(2.5);
  const [repVehicleId, setRepVehicleId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const allowSalesEdit = canEdit(['admin', 'sales']);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && allowSalesEdit) {
      openInvoiceModal();
    }
  }, [externalTrigger]);

  const openInvoiceModal = () => {
    const firstCust = customers[0];
    setSelectedCustomerId(firstCust?.id || '');
    setSelectedRepId(firstCust?.assignedRepId || salesReps[0]?.id || '');
    const repVeh = salesReps.find((r) => r.id === (firstCust?.assignedRepId || salesReps[0]?.id))?.vehicleId;
    setSelectedVehicleId(repVeh || vehicles[0]?.id || '');
    setPaymentMethod('credit');
    setTaxRatePct(DEFAULT_TAX_RATE_PCT);
    setOrderError(null);
    if (products[0]) {
      setLineItems([{ productId: products[0].id, uom: 'pack', quantity: 5 }]);
    } else {
      setLineItems([]);
    }
    setInvoiceModalOpen(true);
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Live FEFO preview across lines
  const workingBatches = batches.map((b) => ({ ...b }));
  const linePreviews = lineItems.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product || !selectedCustomer) {
      return null;
    }
    const unitsPerPack = product.unitsPerPack || 1;
    const baseUnits = line.uom === 'pack' ? line.quantity * unitsPerPack : line.quantity;
    const alloc = allocateBatchesForSale(
      product.id,
      baseUnits,
      workingBatches,
      product.rotationPolicy
    );
    for (const s of alloc.allocations) {
      const target = workingBatches.find((w) => w.id === s.batchId);
      if (target) target.remainingUnits -= s.unitsTaken;
    }
    const basePrice = getSectorPrice(product, selectedCustomer.sector);
    const lineSub = Math.round(basePrice * baseUnits);
    const lineTax = product.taxable ? Math.round((lineSub * taxRatePct) / 100) : 0;
    const lineProfit = lineSub - alloc.totalCogsYer;
    return {
      product,
      uom: line.uom,
      quantity: line.quantity,
      baseUnits,
      unitPriceDisplay: line.uom === 'pack' ? basePrice * unitsPerPack : basePrice,
      lineSub,
      lineTax,
      lineCogs: alloc.totalCogsYer,
      lineProfit,
      alloc,
    };
  });

  const previewSub = linePreviews.reduce((s, p) => s + (p?.lineSub || 0), 0);
  const previewTax = linePreviews.reduce((s, p) => s + (p?.lineTax || 0), 0);
  const previewTotal = previewSub + previewTax;
  const previewProfit = linePreviews.reduce((s, p) => s + (p?.lineProfit || 0), 0);
  const allLinesSufficient =
    linePreviews.length > 0 && linePreviews.every((p) => p && p.alloc.sufficient);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    if (!selectedCustomer || lineItems.length === 0) {
      setOrderError('يرجى اختيار العميل وإضافة صنف واحد على الأقل.');
      return;
    }
    if (!allLinesSufficient) {
      setOrderError('بعض الأصناف لا يتوفر لها رصيد صالح يكفي الكمية المطلوبة.');
      return;
    }
    setSubmitting(true);
    try {
      await createSalesOrder({
        customer: selectedCustomer,
        rep: salesReps.find((r) => r.id === selectedRepId),
        vehicle: vehicles.find((v) => v.id === selectedVehicleId),
        paymentMethod,
        taxRatePct: Number(taxRatePct) || 0,
        lineItems: lineItems
          .map((l) => {
            const p = products.find((pr) => pr.id === l.productId);
            return p ? { product: p, uom: l.uom, quantityEntered: l.quantity } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      });
      setInvoiceModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إصدار الفاتورة';
      setOrderError(msg);
      notify(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;
    setSubmitting(true);
    try {
      await createCustomer({
        name: custName.trim(),
        sector: custSector,
        routeName: custRoute.trim(),
        assignedRepId: custRepId,
        phone: custPhone.trim(),
        cityDistrict: custDistrict.trim(),
        creditLimitYer: Number(custCreditLimit) || 0,
        balanceYer: 0,
        active: true,
      });
      setCustModalOpen(false);
      setCustName('');
      setCustPhone('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repName.trim()) return;
    setSubmitting(true);
    try {
      await createSalesRep({
        name: repName.trim(),
        phone: repPhone.trim(),
        routeName: repRoute.trim(),
        commissionRatePct: Number(repCommission) || 0,
        vehicleId: repVehicleId,
        active: true,
      });
      setRepModalOpen(false);
      setRepName('');
      setRepPhone('');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = salesOrders.filter((o) => {
    const matchSec = sectorFilter === 'all' || o.sector === sectorFilter;
    const matchText =
      !search.trim() ||
      o.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.includes(search.trim()) ||
      (o.repName || '').includes(search.trim());
    return matchSec && matchText;
  });

  const filteredCustomers = customers.filter((c) => {
    const matchSec = sectorFilter === 'all' || c.sector === sectorFilter;
    const matchText =
      !search.trim() ||
      c.name.includes(search.trim()) ||
      c.routeName.includes(search.trim());
    return matchSec && matchText;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('invoices')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'invoices'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فواتير المبيعات ({salesOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'customers'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            العملاء والقطاعات ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reps')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'reps'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مناديب المبيعات ({salesReps.length})
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالفاتورة أو العميل أو المندوب..."
              className="pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-xs w-64 focus:outline-none focus:border-[#0891B2]"
            />
          </div>

          {allowSalesEdit && tab === 'customers' && (
            <button
              type="button"
              onClick={() => {
                setCustRepId(salesReps[0]?.id || '');
                setCustModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>عميل جديد</span>
            </button>
          )}
          {allowSalesEdit && tab === 'reps' && (
            <button
              type="button"
              onClick={() => {
                setRepVehicleId(vehicles[0]?.id || '');
                setRepModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>مندوب جديد</span>
            </button>
          )}
        </div>
      </div>

      {tab !== 'reps' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'supermarket', 'wholesale', 'b2b'] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSectorFilter(sec)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                sectorFilter === sec
                  ? 'bg-[#0F4C81] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sec === 'all' ? 'جميع القطاعات' : SECTOR_LABELS[sec]}
            </button>
          ))}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">رقم الفاتورة</th>
                  <th className="py-3 font-medium">العميل والقطاع</th>
                  <th className="py-3 font-medium">المندوب وخط السير</th>
                  <th className="py-3 font-medium">الإجمالي (مع 15%)</th>
                  <th className="py-3 font-medium">الربح المحقق</th>
                  <th className="py-3 font-medium">السداد والتوصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.map((ord) => {
                  const unpaid = ord.totalYer - ord.paidAmountYer;
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70">
                      <td className="py-3">
                        <div className="font-mono-num font-semibold text-slate-900">
                          {ord.invoiceNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ord.items.length} أصناف · {ord.paymentMethod === 'cash' ? 'نقدي' : 'آجل'}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{ord.customerName}</div>
                        <div className="text-xs text-slate-500">{SECTOR_LABELS[ord.sector]}</div>
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{ord.repName || 'مباشر'}</div>
                        <div>{ord.routeName || '—'}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-mono-num font-bold text-slate-900">
                          {formatYer(ord.totalYer)}
                        </div>
                        <div className="font-mono-num text-[11px] text-slate-500">
                          صافي: {formatYer(ord.subtotalYer)}
                        </div>
                      </td>
                      <td className="py-3 font-mono-num font-semibold text-emerald-700">
                        {formatYer(ord.grossProfitYer)}
                      </td>
                      <td className="py-3 text-xs">
                        <div
                          className={`font-semibold ${
                            ord.deliveryStatus === 'delivered'
                              ? 'text-emerald-700'
                              : ord.deliveryStatus === 'dispatched'
                                ? 'text-[#0891B2]'
                                : 'text-amber-700'
                          }`}
                        >
                          {DELIVERY_STATUS_LABELS[ord.deliveryStatus]}
                        </div>
                        <div className="font-mono-num text-slate-500 mt-0.5">
                          {unpaid <= 0 ? 'مسددة بالكامل' : `متبقي: ${formatYer(unpaid)}`}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      لا توجد فواتير مبيعات مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">العميل</th>
                  <th className="py-3 font-medium">القطاع التسعيري</th>
                  <th className="py-3 font-medium">خط السير والمنطقة</th>
                  <th className="py-3 font-medium">المندوب المسؤول</th>
                  <th className="py-3 font-medium">حد الائتمان</th>
                  <th className="py-3 font-medium">المديونية الحالية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCustomers.map((cust) => {
                  const rep = salesReps.find((r) => r.id === cust.assignedRepId);
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{cust.name}</div>
                        <div className="text-xs text-slate-500 font-mono-num">
                          {cust.phone || '—'}
                        </div>
                      </td>
                      <td className="py-3 text-xs font-semibold text-[#0F4C81]">
                        {SECTOR_LABELS[cust.sector]}
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        <div>{cust.routeName}</div>
                        <div className="text-slate-400">{cust.cityDistrict || ''}</div>
                      </td>
                      <td className="py-3 text-xs text-slate-700">{rep?.name || 'غير معين'}</td>
                      <td className="py-3 font-mono-num text-slate-700">
                        {formatYer(cust.creditLimitYer)}
                      </td>
                      <td
                        className={`py-3 font-mono-num font-bold ${
                          cust.balanceYer > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatYer(cust.balanceYer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reps' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {salesReps.map((rep) => {
            const repOrders = salesOrders.filter((o) => o.repId === rep.id);
            const repSalesNet = repOrders.reduce((s, o) => s + o.subtotalYer, 0);
            const repProfit = repOrders.reduce((s, o) => s + o.grossProfitYer, 0);
            const commissionYer = Math.round((repSalesNet * rep.commissionRatePct) / 100);
            const veh = vehicles.find((v) => v.id === rep.vehicleId);

            return (
              <div key={rep.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {rep.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{rep.routeName}</p>
                  </div>
                  <UserCheck className="w-4 h-4 text-[#0891B2]" />
                </div>

                <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">الهاتف:</span>
                    <span className="font-mono-num text-slate-800">{rep.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المركبة المخصصة:</span>
                    <span className="text-slate-800">{veh?.plateNumber || 'غير معينة'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">صافي المبيعات ({repOrders.length} فاتورة):</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {formatYer(repSalesNet)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الربح المحقق:</span>
                    <span className="font-mono-num font-semibold text-emerald-700">
                      {formatYer(repProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      العمولة (<span className="font-mono-num">{rep.commissionRatePct}%</span>):
                    </span>
                    <span className="font-mono-num font-semibold text-[#0F4C81]">
                      {formatYer(commissionYer)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Sales Invoice with Live FEFO Preview */}
      <ModalDrawer
        open={invoiceModalOpen}
        title="إصدار فاتورة مبيعات (تخصيص FEFO تلقائي)"
        subtitle="يتم تطبيق تسعير القطاع تلقائياً وخصم الكميات من الدفعات الأقرب انتهاءً"
        onClose={() => setInvoiceModalOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {orderError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {orderError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">العميل</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => {
                  const cust = customers.find((c) => c.id === e.target.value);
                  setSelectedCustomerId(e.target.value);
                  if (cust?.assignedRepId) {
                    setSelectedRepId(cust.assignedRepId);
                    const rep = salesReps.find((r) => r.id === cust.assignedRepId);
                    if (rep?.vehicleId) setSelectedVehicleId(rep.vehicleId);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">اختر العميل</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({SECTOR_LABELS[c.sector]})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المندوب الميداني</label>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">مبيع مباشر</option>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.routeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سيارة التوصيل</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">استلام من المستودع</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.driverName})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="cash">نقدي</option>
                  <option value="credit">آجل على الحساب</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الضريبة (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">بنود الفاتورة وسحب FEFO</span>
              <button
                type="button"
                onClick={() => {
                  if (!products[0]) return;
                  setLineItems((prev) => [
                    ...prev,
                    { productId: products[0].id, uom: 'pack', quantity: 2 },
                  ]);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0891B2] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند</span>
              </button>
            </div>

            {lineItems.map((line, index) => {
              const preview = linePreviews[index];
              const prod = products.find((p) => p.id === line.productId);
              return (
                <div key={index} className="pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-5">
                      <label className="block text-[11px] text-slate-500 mb-1">الصنف</label>
                      <select
                        value={line.productId}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productId: e.target.value } : it
                            )
                          )
                        }
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
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index
                                ? { ...it, uom: e.target.value as 'base' | 'pack' }
                                : it
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                      >
                        <option value="pack">{prod?.packUnitName || 'كرتون'}</option>
                        <option value="base">{prod?.baseUnitName || 'عبوة'}</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-slate-500 mb-1">الكمية</label>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index
                                ? { ...it, quantity: Math.max(1, Number(e.target.value)) }
                                : it
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono-num"
                      />
                    </div>
                    <div className="md:col-span-2 text-xs">
                      <div className="text-[11px] text-slate-500">الإجمالي الفرعي</div>
                      <div className="font-mono-num font-bold text-slate-900 py-1.5">
                        {formatYer(preview?.lineSub || 0)}
                      </div>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setLineItems((prev) => prev.filter((_, idx) => idx !== index))
                        }
                        className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="حذف البند"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {preview && (
                    <div
                      className={`text-[11px] font-mono-num ${
                        preview.alloc.sufficient ? 'text-slate-500' : 'text-red-700 font-semibold'
                      }`}
                    >
                      {preview.alloc.sufficient
                        ? `سحب تلقائي (${preview.product.rotationPolicy}): ${preview.alloc.allocations
                            .map((a) => `${a.batchNumber} (${a.unitsTaken} وحدة · انتهاء ${a.expiryDate})`)
                            .join(' + ')} · ربح البند: ${formatYer(preview.lineProfit)}`
                        : `الرصيد الصالح غير كافٍ (المطلوب: ${preview.baseUnits} · المتاح: ${preview.alloc.availableUnits})`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">الصافي قبل الضريبة</span>
              <strong className="font-mono-num text-slate-900">{formatYer(previewSub)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">ضريبة القيمة المضافة ({taxRatePct}%)</span>
              <strong className="font-mono-num text-slate-900">{formatYer(previewTax)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">إجمالي الفاتورة</span>
              <strong className="font-mono-num text-[#0F4C81] text-sm">
                {formatYer(previewTotal)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">صافي ربح الفاتورة</span>
              <strong className="font-mono-num text-emerald-700 text-sm">
                {formatYer(previewProfit)} ({formatNum(previewSub > 0 ? (previewProfit / previewSub) * 100 : 0, 1)}%)
              </strong>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || !allLinesSufficient}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'جاري الاعتماد...' : 'اعتماد الفاتورة وخصم المخزون'}
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* Modal: Add Customer */}
      <ModalDrawer
        open={custModalOpen}
        title="تسجيل عميل جديد"
        subtitle="تصنيف العميل حسب القطاع التسعيري وتعيين خط السير وحد الائتمان"
        onClose={() => setCustModalOpen(false)}
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم العميل / المنشأة</label>
              <input
                required
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">القطاع</label>
              <select
                value={custSector}
                onChange={(e) => setCustSector(e.target.value as CustomerSector)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="supermarket">سوبرماركت</option>
                <option value="wholesale">محلات جملة</option>
                <option value="b2b">قطاع تجاري B2B (فنادق / مستشفيات)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">خط السير</label>
              <input
                required
                value={custRoute}
                onChange={(e) => setCustRoute(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المندوب المسؤول</label>
              <select
                value={custRepId}
                onChange={(e) => setCustRepId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">غير محدد</option>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الهاتف</label>
              <input
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المدينة / الحي</label>
              <input
                value={custDistrict}
                onChange={(e) => setCustDistrict(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">حد الائتمان المسموح (ر.ي)</label>
              <input
                type="number"
                min={0}
                value={custCreditLimit}
                onChange={(e) => setCustCreditLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCustModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
            >
              حفظ العميل
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* Modal: Add Sales Rep */}
      <ModalDrawer
        open={repModalOpen}
        title="إضافة مندوب مبيعات ميداني"
        onClose={() => setRepModalOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateRep} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المندوب</label>
            <input
              required
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الهاتف</label>
              <input
                value={repPhone}
                onChange={(e) => setRepPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نسبة العمولة (%)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={25}
                value={repCommission}
                onChange={(e) => setRepCommission(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">خط السير المخصص</label>
            <input
              required
              value={repRoute}
              onChange={(e) => setRepRoute(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">سيارة التوزيع</label>
            <select
              value={repVehicleId}
              onChange={(e) => setRepVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">غير معينة</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} — {v.modelName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setRepModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
            >
              حفظ المندوب
            </button>
          </div>
        </form>
      </ModalDrawer>
    </div>
  );
}
