import React from 'react';
import {
  AlertTriangle,
  ArrowUpLeft,
  Database,
  PackageCheck,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CATEGORY_LABELS,
  formatNum,
  formatPackagingSummary,
  formatYer,
  getExpiryClassification,
  SECTOR_LABELS,
} from '../types/erp';
import { NavSection } from '../components/LayoutShell';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const {
    products,
    batches,
    suppliers,
    customers,
    salesOrders,
    salesReps,
    purchaseOrders,
    dataLoading,
    seedOperationalData,
    seeding,
    canEdit,
  } = useErp();

  const isEmpty = !dataLoading && products.length === 0 && suppliers.length === 0;

  // Inventory valuation & alerts
  const activeBatches = batches.filter((b) => b.status === 'active' && b.remainingUnits > 0);
  const inventoryValueYer = activeBatches.reduce(
    (sum, b) => sum + b.remainingUnits * b.landedUnitCostYer,
    0
  );

  // Stock per product
  const stockByProduct = products.map((product) => {
    const prodBatches = activeBatches.filter((b) => b.productId === product.id);
    const totalUnits = prodBatches.reduce((s, b) => s + b.remainingUnits, 0);
    return {
      product,
      totalUnits,
      isLowStock: totalUnits <= product.reorderPointUnits,
    };
  });

  const lowStockItems = stockByProduct.filter((x) => x.isLowStock);

  const expiringOrExpiredBatches = activeBatches
    .map((b) => ({
      batch: b,
      expiry: getExpiryClassification(b.expiryDate),
    }))
    .filter((x) => x.expiry.state === 'critical' || x.expiry.state === 'expired')
    .sort((a, b) => a.expiry.daysLeft - b.expiry.daysLeft);

  const tempBreachBatches = activeBatches.filter((b) => {
    const prod = products.find((p) => p.id === b.productId);
    if (!prod || b.recordedTempC === undefined) return false;
    const minT = prod.storageTempMin ?? -50;
    const maxT = prod.storageTempMax ?? 100;
    return b.recordedTempC < minT || b.recordedTempC > maxT;
  });

  // Financials & Sales metrics
  const totalSalesNet = salesOrders.reduce((s, o) => s + o.subtotalYer, 0);
  const totalSalesGross = salesOrders.reduce((s, o) => s + o.totalYer, 0);
  const totalGrossProfit = salesOrders.reduce((s, o) => s + o.grossProfitYer, 0);
  const profitMarginPct = totalSalesNet > 0 ? (totalGrossProfit / totalSalesNet) * 100 : 0;

  const totalReceivables = customers.reduce((s, c) => s + Math.max(0, c.balanceYer), 0);
  const totalPayables = suppliers.reduce((s, sup) => s + Math.max(0, sup.balanceYer), 0);

  // Sector breakdown
  const sectorStats = (['supermarket', 'wholesale', 'b2b'] as const).map((sector) => {
    const orders = salesOrders.filter((o) => o.sector === sector);
    const revenue = orders.reduce((s, o) => s + o.subtotalYer, 0);
    const profit = orders.reduce((s, o) => s + o.grossProfitYer, 0);
    return {
      sector,
      label: SECTOR_LABELS[sector],
      count: orders.length,
      revenue,
      profit,
    };
  });
  const maxSectorRevenue = Math.max(1, ...sectorStats.map((s) => s.revenue));

  // Sales Reps summary
  const repStats = salesReps.map((rep) => {
    const orders = salesOrders.filter((o) => o.repId === rep.id);
    const salesNet = orders.reduce((s, o) => s + o.subtotalYer, 0);
    const profit = orders.reduce((s, o) => s + o.grossProfitYer, 0);
    const commission = Math.round((salesNet * rep.commissionRatePct) / 100);
    return { rep, ordersCount: orders.length, salesNet, profit, commission };
  });

  const openPoCount = purchaseOrders.filter(
    (p) => p.status !== 'received' && p.status !== 'cancelled'
  ).length;

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* First-time Onboarding Banner if DB is empty */}
      {isEmpty && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              مرحباً بك في نظام نقاء ERP لتجارة وتوزيع منتجات التنظيف
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              قاعدة البيانات السحابية متصلة وجاهزة. يمكنك البدء بإضافة بياناتك يدوياً أو تحميل بيانات تشغيلية واقعية تشمل موردين، منتجات، دفعات صلاحية، فواتير، وأسطول توزيع.
            </p>
          </div>
          {canEdit(['admin']) && (
            <button
              type="button"
              onClick={seedOperationalData}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Database className="w-4 h-4" />
              <span>{seeding ? 'جاري تهيئة البيانات...' : 'تحميل بيانات الشركة التجريبية'}</span>
            </button>
          )}
        </div>
      )}

      {/* 4 Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">إجمالي المبيعات (شامل الضريبة 15%)</div>
          <div className="font-mono-num text-2xl font-bold text-slate-900 mt-2">
            {formatYer(totalSalesGross)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span>صافي المبيعات:</span>
            <span className="font-mono-num font-semibold text-slate-700">{formatYer(totalSalesNet)}</span>
            <span>·</span>
            <span className="font-mono-num">{salesOrders.length} فاتورة</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">إجمالي الربح المحقق (FEFO)</div>
          <div className="font-mono-num text-2xl font-bold text-emerald-700 mt-2">
            {formatYer(totalGrossProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>هامش الربح:</span>
            <span className="font-mono-num font-semibold text-emerald-700">
              {formatNum(profitMarginPct, 1)}%
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">قيمة المخزون بالتكلفة الشاملة</div>
          <div className="font-mono-num text-2xl font-bold text-[#0F4C81] mt-2">
            {formatYer(inventoryValueYer)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            <span className="font-mono-num font-semibold text-slate-700">{activeBatches.length}</span> دفعة نشطة ·{' '}
            <span className="font-mono-num font-semibold text-slate-700">{openPoCount}</span> شحنة قيد التوريد
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">الذمم المدينة / الدائنة</div>
          <div className="font-mono-num text-2xl font-bold text-slate-900 mt-2">
            {formatYer(totalReceivables)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            ذمم الموردين:{' '}
            <span className="font-mono-num font-semibold text-amber-700">
              {formatYer(totalPayables)}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Alerts Strip: Low Stock + Expiry FEFO + Storage Temp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  تنبيهات المخزون والصلاحيات ودرجة الحرارة
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مراقبة فورية لحد الطلب، الدفعات القريبة من الانتهاء (FEFO)، وظروف التخزين
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C81] hover:text-[#0891B2] whitespace-nowrap cursor-pointer"
              >
                <span>إدارة المخزون</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {lowStockItems.length === 0 &&
            expiringOrExpiredBatches.length === 0 &&
            tempBreachBatches.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 border-t border-slate-100">
                <PackageCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                جميع الأصناف والدفعات ضمن الحدود الآمنة للصلاحية ودرجة الحرارة
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-200">
                {lowStockItems.map(({ product, totalUnits }) => (
                  <div
                    key={product.id}
                    className="py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{product.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono-num">{product.sku}</span> · حد الطلب:{' '}
                        <span className="font-mono-num">{product.reorderPointUnits}</span> {product.baseUnitName}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>نقص مخزون</span>
                      </div>
                      <div className="font-mono-num text-xs text-slate-700 mt-0.5">
                        المتاح: {formatPackagingSummary(totalUnits, product)}
                      </div>
                    </div>
                  </div>
                ))}

                {expiringOrExpiredBatches.map(({ batch, expiry }) => (
                  <div
                    key={batch.id}
                    className="py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{batch.productName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        دفعة <span className="font-mono-num">{batch.batchNumber}</span> · انتهاء:{' '}
                        <span className="font-mono-num">{batch.expiryDate}</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div
                        className={`text-xs font-semibold ${
                          expiry.state === 'expired' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {expiry.label}
                      </div>
                      <div className="font-mono-num text-xs text-slate-600 mt-0.5">
                        المتبقي: {formatNum(batch.remainingUnits, 0)} وحدة
                      </div>
                    </div>
                  </div>
                ))}

                {tempBreachBatches.map((batch) => {
                  const prod = products.find((p) => p.id === batch.productId);
                  return (
                    <div
                      key={`temp_${batch.id}`}
                      className="py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          تجاوز حرارة التخزين — {batch.productName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {batch.warehouseZone} · المسموح:{' '}
                          <span className="font-mono-num">
                            {prod?.storageTempMin ?? 10}°–{prod?.storageTempMax ?? 25}°م
                          </span>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <Thermometer className="w-3.5 h-3.5" />
                          <span className="font-mono-num">{batch.recordedTempC}°م</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sector Sales & Profit Visualization */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  أداء المبيعات والربحية حسب القطاع
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  توزيع الإيرادات الصافية والربح بين السوبرماركت والجملة و B2B
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('financials')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C81] hover:text-[#0891B2] whitespace-nowrap cursor-pointer"
              >
                <span>التفاصيل</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-5">
              {sectorStats.map((sec) => {
                const widthPct = Math.max(4, Math.round((sec.revenue / maxSectorRevenue) * 100));
                const profitPct = sec.revenue > 0 ? (sec.profit / sec.revenue) * 100 : 0;
                return (
                  <div key={sec.sector}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-800">
                        {sec.label} · <span className="font-mono-num text-slate-500">{sec.count} طلب</span>
                      </span>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {formatYer(sec.revenue)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0891B2] rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>الربح: <span className="font-mono-num text-emerald-700 font-medium">{formatYer(sec.profit)}</span></span>
                      <span className="font-mono-num">هامش {formatNum(profitPct, 1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>إجمالي الأصناف المسجلة: <strong className="font-mono-num text-slate-900">{products.length}</strong></span>
            <span>العملاء النشطون: <strong className="font-mono-num text-slate-900">{customers.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Field Sales Reps Performance + Category Stock Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              ملخص أداء مناديب المبيعات الميدانية
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-[#0F4C81] hover:text-[#0891B2] cursor-pointer"
            >
              عرض المبيعات
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 font-medium">المندوب</th>
                  <th className="py-2.5 font-medium">خط السير</th>
                  <th className="py-2.5 font-medium">الفواتير</th>
                  <th className="py-2.5 font-medium">صافي المبيعات</th>
                  <th className="py-2.5 font-medium">الربح المحقق</th>
                  <th className="py-2.5 font-medium">العمولة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {repStats.map(({ rep, ordersCount, salesNet, profit, commission }) => (
                  <tr key={rep.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 font-medium text-slate-900">{rep.name}</td>
                    <td className="py-2.5 text-xs text-slate-600">{rep.routeName}</td>
                    <td className="py-2.5 font-mono-num text-slate-700">{ordersCount}</td>
                    <td className="py-2.5 font-mono-num font-medium text-slate-900">
                      {formatYer(salesNet)}
                    </td>
                    <td className="py-2.5 font-mono-num text-emerald-700 font-medium">
                      {formatYer(profit)}
                    </td>
                    <td className="py-2.5 font-mono-num text-slate-700">
                      {formatYer(commission)}
                    </td>
                  </tr>
                ))}
                {repStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                      لا يوجد مناديب مبيعات مسجلون بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              ملخص أصناف التنظيف المتاحة
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('procurement')}
              className="text-xs font-semibold text-[#0F4C81] hover:text-[#0891B2] cursor-pointer"
            >
              إصدار طلب شراء
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {stockByProduct.slice(0, 5).map(({ product, totalUnits, isLowStock }) => (
              <div key={product.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{product.name}</div>
                  <div className="text-xs text-slate-500">
                    {CATEGORY_LABELS[product.category]} · {product.rotationPolicy}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div
                    className={`font-mono-num text-xs font-semibold ${
                      isLowStock ? 'text-amber-700' : 'text-slate-900'
                    }`}
                  >
                    {formatPackagingSummary(totalUnits, product)}
                  </div>
                  <div className="font-mono-num text-[11px] text-slate-500">
                    {formatNum(totalUnits * product.volumeLitersPerUnit, 0)} لتر/كجم
                  </div>
                </div>
              </div>
            ))}
            {stockByProduct.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                لا توجد أصناف مسجلة حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
