import React, { useEffect, useState } from 'react';
import { Banknote, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { formatNum, formatYer, SECTOR_LABELS, VoucherMethod } from '../types/erp';
import { ModalDrawer } from '../components/ModalDrawer';

interface FinancialsViewProps {
  externalTrigger?: number;
}

export function FinancialsView({ externalTrigger }: FinancialsViewProps) {
  const {
    customers,
    suppliers,
    salesOrders,
    purchaseOrders,
    salesReps,
    payments,
    recordPayment,
    canEdit,
  } = useErp();

  const [tab, setTab] = useState<'profitability' | 'ar' | 'ap' | 'vouchers'>('profitability');
  const [profitPerspective, setProfitPerspective] = useState<'product' | 'customer' | 'rep'>(
    'product'
  );

  // Payment Voucher Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payType, setPayType] = useState<'customer_receipt' | 'supplier_payment'>(
    'customer_receipt'
  );
  const [partyId, setPartyId] = useState('');
  const [refDocId, setRefDocId] = useState('');
  const [amountYer, setAmountYer] = useState(0);
  const [method, setMethod] = useState<VoucherMethod>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allowFinEdit = canEdit(['admin', 'finance', 'sales', 'procurement']);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && allowFinEdit) {
      openVoucherModal('customer_receipt');
    }
  }, [externalTrigger]);

  const openVoucherModal = (
    type: 'customer_receipt' | 'supplier_payment',
    preselectedPartyId?: string,
    suggestedAmount?: number,
    preselectedDocId?: string
  ) => {
    setPayType(type);
    const defaultParty =
      preselectedPartyId ||
      (type === 'customer_receipt' ? customers[0]?.id : suppliers[0]?.id) ||
      '';
    setPartyId(defaultParty);
    setRefDocId(preselectedDocId || '');
    setAmountYer(suggestedAmount || 100000);
    setMethod('cash');
    setNotes('');
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || amountYer <= 0) return;
    const partyName =
      payType === 'customer_receipt'
        ? customers.find((c) => c.id === partyId)?.name || 'عميل'
        : suppliers.find((s) => s.id === partyId)?.name || 'مورد';

    setSubmitting(true);
    try {
      await recordPayment({
        paymentType: payType,
        partyId,
        partyName,
        referenceDocId: refDocId,
        amountYer: Number(amountYer),
        method,
        notes,
      });
      setPayModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Profitability Matrix Computations
  const productProfitRows = (() => {
    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string;
        units: number;
        revenueNet: number;
        cogs: number;
        profit: number;
      }
    >();
    for (const order of salesOrders) {
      for (const item of order.items) {
        const cur = map.get(item.productId) || {
          productId: item.productId,
          name: item.productName,
          sku: item.sku,
          units: 0,
          revenueNet: 0,
          cogs: 0,
          profit: 0,
        };
        cur.units += item.totalBaseUnits;
        cur.revenueNet += item.lineSubtotalYer;
        cur.cogs += item.lineCogsYer;
        cur.profit += item.lineProfitYer;
        map.set(item.productId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.profit - a.profit);
  })();

  const customerProfitRows = customers
    .map((cust) => {
      const orders = salesOrders.filter((o) => o.customerId === cust.id);
      const revenueNet = orders.reduce((s, o) => s + o.subtotalYer, 0);
      const cogs = orders.reduce((s, o) => s + o.cogsYer, 0);
      const profit = orders.reduce((s, o) => s + o.grossProfitYer, 0);
      return {
        cust,
        ordersCount: orders.length,
        revenueNet,
        cogs,
        profit,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const repProfitRows = salesReps
    .map((rep) => {
      const orders = salesOrders.filter((o) => o.repId === rep.id);
      const revenueNet = orders.reduce((s, o) => s + o.subtotalYer, 0);
      const cogs = orders.reduce((s, o) => s + o.cogsYer, 0);
      const grossProfit = orders.reduce((s, o) => s + o.grossProfitYer, 0);
      const commission = Math.round((revenueNet * rep.commissionRatePct) / 100);
      const netAfterCommission = grossProfit - commission;
      return {
        rep,
        ordersCount: orders.length,
        revenueNet,
        cogs,
        grossProfit,
        commission,
        netAfterCommission,
      };
    })
    .sort((a, b) => b.netAfterCommission - a.netAfterCommission);

  const totalAr = customers.reduce((s, c) => s + Math.max(0, c.balanceYer), 0);
  const totalAp = suppliers.reduce((s, sup) => s + Math.max(0, sup.balanceYer), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('profitability')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'profitability'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تحليل الربحية الدقيق
          </button>
          <button
            type="button"
            onClick={() => setTab('ar')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'ar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الذمم المدينة (العملاء)
          </button>
          <button
            type="button"
            onClick={() => setTab('ap')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'ap'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الذمم الدائنة (الموردون)
          </button>
          <button
            type="button"
            onClick={() => setTab('vouchers')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'vouchers'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجل السندات ({payments.length})
          </button>
        </div>

        {allowFinEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openVoucherModal('customer_receipt')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>سند قبض عميل</span>
            </button>
            <button
              type="button"
              onClick={() => openVoucherModal('supplier_payment')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
              <span>سند صرف لمورد</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">إجمالي الذمم المدينة (على العملاء)</div>
          <div className="font-mono-num text-xl font-bold text-[#0F4C81] mt-1.5">
            {formatYer(totalAr)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">إجمالي الذمم الدائنة (للموردين)</div>
          <div className="font-mono-num text-xl font-bold text-amber-700 mt-1.5">
            {formatYer(totalAp)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">صافي الموقف الائتماني (العملاء - الموردين)</div>
          <div
            className={`font-mono-num text-xl font-bold mt-1.5 ${
              totalAr - totalAp >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatYer(totalAr - totalAp)}
          </div>
        </div>
      </div>

      {tab === 'profitability' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                مصفوفة حساب الأرباح الفعلية (بناءً على تكلفة الدفعات FEFO + تكاليف الاستيراد)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                اختر منظور التحليل لعرض هوامش الربح لكل صنف أو عميل أو مندوب مبيعات
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  ['product', 'حسب الصنف'],
                  ['customer', 'حسب العميل'],
                  ['rep', 'حسب المندوب'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProfitPerspective(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    profitPerspective === key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {profitPerspective === 'product' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-3 font-medium">الصنف</th>
                    <th className="py-3 font-medium">الكمية المباعة (وحدة)</th>
                    <th className="py-3 font-medium">صافي المبيعات</th>
                    <th className="py-3 font-medium">التكلفة الفعلية (COGS)</th>
                    <th className="py-3 font-medium">إجمالي الربح</th>
                    <th className="py-3 font-medium">نسبة الهامش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {productProfitRows.map((row) => {
                    const margin = row.revenueNet > 0 ? (row.profit / row.revenueNet) * 100 : 0;
                    return (
                      <tr key={row.productId} className="hover:bg-slate-50/70">
                        <td className="py-3">
                          <div className="font-medium text-slate-900">{row.name}</div>
                          <div className="font-mono-num text-xs text-slate-500">{row.sku}</div>
                        </td>
                        <td className="py-3 font-mono-num text-slate-700">{row.units}</td>
                        <td className="py-3 font-mono-num text-slate-900">
                          {formatYer(row.revenueNet)}
                        </td>
                        <td className="py-3 font-mono-num text-slate-600">{formatYer(row.cogs)}</td>
                        <td className="py-3 font-mono-num font-bold text-emerald-700">
                          {formatYer(row.profit)}
                        </td>
                        <td className="py-3 font-mono-num font-semibold text-[#0F4C81]">
                          {formatNum(margin, 1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {profitPerspective === 'customer' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-3 font-medium">العميل والقطاع</th>
                    <th className="py-3 font-medium">عدد الفواتير</th>
                    <th className="py-3 font-medium">صافي المبيعات</th>
                    <th className="py-3 font-medium">التكلفة الفعلية</th>
                    <th className="py-3 font-medium">إجمالي الربح</th>
                    <th className="py-3 font-medium">هامش الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {customerProfitRows.map(({ cust, ordersCount, revenueNet, cogs, profit }) => {
                    const margin = revenueNet > 0 ? (profit / revenueNet) * 100 : 0;
                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/70">
                        <td className="py-3">
                          <div className="font-medium text-slate-900">{cust.name}</div>
                          <div className="text-xs text-slate-500">
                            {SECTOR_LABELS[cust.sector]} · {cust.routeName}
                          </div>
                        </td>
                        <td className="py-3 font-mono-num text-slate-700">{ordersCount}</td>
                        <td className="py-3 font-mono-num text-slate-900">
                          {formatYer(revenueNet)}
                        </td>
                        <td className="py-3 font-mono-num text-slate-600">{formatYer(cogs)}</td>
                        <td className="py-3 font-mono-num font-bold text-emerald-700">
                          {formatYer(profit)}
                        </td>
                        <td className="py-3 font-mono-num font-semibold text-[#0F4C81]">
                          {formatNum(margin, 1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {profitPerspective === 'rep' && (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-3 font-medium">المندوب وخط السير</th>
                    <th className="py-3 font-medium">صافي المبيعات</th>
                    <th className="py-3 font-medium">إجمالي الربح</th>
                    <th className="py-3 font-medium">عمولة المندوب</th>
                    <th className="py-3 font-medium">صافي الربح بعد العمولة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {repProfitRows.map(
                    ({ rep, ordersCount, revenueNet, grossProfit, commission, netAfterCommission }) => (
                      <tr key={rep.id} className="hover:bg-slate-50/70">
                        <td className="py-3">
                          <div className="font-medium text-slate-900">{rep.name}</div>
                          <div className="text-xs text-slate-500">
                            {rep.routeName} · {ordersCount} فاتورة
                          </div>
                        </td>
                        <td className="py-3 font-mono-num text-slate-900">
                          {formatYer(revenueNet)}
                        </td>
                        <td className="py-3 font-mono-num text-emerald-700">
                          {formatYer(grossProfit)}
                        </td>
                        <td className="py-3 font-mono-num text-amber-700">
                          {formatYer(commission)} ({rep.commissionRatePct}%)
                        </td>
                        <td className="py-3 font-mono-num font-bold text-[#0F4C81]">
                          {formatYer(netAfterCommission)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'ar' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">العميل</th>
                  <th className="py-3 font-medium">القطاع</th>
                  <th className="py-3 font-medium">حد الائتمان</th>
                  <th className="py-3 font-medium">الرصيد المستحق</th>
                  <th className="py-3 font-medium">إجراء التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="py-3 text-xs text-slate-600">{SECTOR_LABELS[c.sector]}</td>
                    <td className="py-3 font-mono-num text-slate-600">
                      {formatYer(c.creditLimitYer)}
                    </td>
                    <td
                      className={`py-3 font-mono-num font-bold ${
                        c.balanceYer > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatYer(c.balanceYer)}
                    </td>
                    <td className="py-3">
                      {allowFinEdit && c.balanceYer > 0 && (
                        <button
                          type="button"
                          onClick={() => openVoucherModal('customer_receipt', c.id, c.balanceYer)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0891B2] text-white text-xs font-semibold cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>تحصيل دفعة</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">المورد</th>
                  <th className="py-3 font-medium">التصنيف</th>
                  <th className="py-3 font-medium">شروط السداد</th>
                  <th className="py-3 font-medium">الرصيد الدائن المستحق</th>
                  <th className="py-3 font-medium">إجراء السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="py-3 text-xs text-slate-600">
                      {s.supplierType === 'international' ? 'دولي' : 'محلي'} · {s.country}
                    </td>
                    <td className="py-3 font-mono-num text-xs text-slate-600">
                      {s.paymentTermsDays} يوم ({s.currency})
                    </td>
                    <td
                      className={`py-3 font-mono-num font-bold ${
                        s.balanceYer > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatYer(s.balanceYer)}
                    </td>
                    <td className="py-3">
                      {allowFinEdit && s.balanceYer > 0 && (
                        <button
                          type="button"
                          onClick={() => openVoucherModal('supplier_payment', s.id, s.balanceYer)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>سداد دفعة</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vouchers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">رقم السند</th>
                  <th className="py-3 font-medium">النوع</th>
                  <th className="py-3 font-medium">الطرف</th>
                  <th className="py-3 font-medium">المبلغ</th>
                  <th className="py-3 font-medium">الوسيلة والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 font-mono-num font-semibold text-slate-900">
                      {p.voucherNumber}
                    </td>
                    <td className="py-3 text-xs font-semibold">
                      <span
                        className={
                          p.paymentType === 'customer_receipt'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {p.paymentType === 'customer_receipt' ? 'سند قبض (عميل)' : 'سند صرف (مورد)'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-800">{p.partyName}</td>
                    <td className="py-3 font-mono-num font-bold text-slate-900">
                      {formatYer(p.amountYer)}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {p.method === 'field_collection'
                        ? 'تحصيل ميداني'
                        : p.method === 'bank_transfer'
                          ? 'تحويل بنكي'
                          : 'نقدي'}{' '}
                      {p.notes ? `· ${p.notes}` : ''}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      لا توجد سندات مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record Payment Voucher */}
      <ModalDrawer
        open={payModalOpen}
        title={payType === 'customer_receipt' ? 'تسجيل سند قبض من عميل' : 'تسجيل سند صرف لمورد'}
        onClose={() => setPayModalOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleConfirmPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {payType === 'customer_receipt' ? 'العميل' : 'المورد'}
            </label>
            <select
              required
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value);
                setRefDocId('');
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {payType === 'customer_receipt'
                ? customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (الرصيد: {formatYer(c.balanceYer)})
                    </option>
                  ))
                : suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (الرصيد: {formatYer(s.balanceYer)})
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ربط بمستند مفتوح (اختياري)
            </label>
            <select
              value={refDocId}
              onChange={(e) => setRefDocId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">دفعة على الحساب العام</option>
              {payType === 'customer_receipt'
                ? salesOrders
                    .filter((o) => o.customerId === partyId && o.totalYer > o.paidAmountYer)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.invoiceNumber} — متبقي {formatYer(o.totalYer - o.paidAmountYer)}
                      </option>
                    ))
                : purchaseOrders
                    .filter((p) => p.supplierId === partyId && p.totalLandedCostYer > p.paidAmountYer)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} — متبقي {formatYer(p.totalLandedCostYer - p.paidAmountYer)}
                      </option>
                    ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ (ر.ي)</label>
              <input
                required
                type="number"
                min={1}
                value={amountYer}
                onChange={(e) => setAmountYer(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">طريقة السداد</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as VoucherMethod)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="cash">صندوق النقدية</option>
                <option value="bank_transfer">حوالة / تحويل بنكي</option>
                <option value="field_collection">تحصيل ميداني</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPayModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
            >
              {submitting ? 'جاري الترحيل...' : 'اعتماد السند'}
            </button>
          </div>
        </form>
      </ModalDrawer>
    </div>
  );
}
