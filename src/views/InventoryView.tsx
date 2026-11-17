import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Thermometer,
  AlertTriangle,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  CATEGORY_LABELS,
  formatNum,
  formatPackagingSummary,
  formatYer,
  getExpiryClassification,
  InventoryBatch,
  Product,
  ProductCategory,
  RotationPolicy,
} from '../types/erp';
import { ModalDrawer } from '../components/ModalDrawer';

interface InventoryViewProps {
  externalTrigger?: number;
}

export function InventoryView({ externalTrigger }: InventoryViewProps) {
  const {
    products,
    batches,
    stockCounts,
    suppliers,
    createProduct,
    recordStockCount,
    updateBatchStorage,
    canEdit,
  } = useErp();

  const [tab, setTab] = useState<'catalog' | 'batches' | 'counts'>('batches');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');

  // Add Product Modal
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('detergents');
  const [baseUnitName, setBaseUnitName] = useState('عبوة');
  const [packUnitName, setPackUnitName] = useState('كرتون');
  const [unitsPerPack, setUnitsPerPack] = useState(12);
  const [volumeLiters, setVolumeLiters] = useState(1);
  const [reorderPoint, setReorderPoint] = useState(120);
  const [tempMin, setTempMin] = useState(10);
  const [tempMax, setTempMax] = useState(28);
  const [priceSM, setPriceSM] = useState(950);
  const [priceWS, setPriceWS] = useState(860);
  const [priceB2B, setPriceB2B] = useState(820);
  const [rotationPolicy, setRotationPolicy] = useState<RotationPolicy>('FEFO');
  const [taxable, setTaxable] = useState(true);
  const [defaultSupplierId, setDefaultSupplierId] = useState('');

  // Stock Count Modal
  const [countingBatch, setCountingBatch] = useState<InventoryBatch | null>(null);
  const [countedUnits, setCountedUnits] = useState(0);
  const [countReason, setCountReason] = useState('جرد دوري للمستودع');

  // Temperature Update Modal
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);
  const [editZone, setEditZone] = useState('');
  const [editTemp, setEditTemp] = useState(20);
  const [editStatus, setEditStatus] = useState<InventoryBatch['status']>('active');

  const [submitting, setSubmitting] = useState(false);
  const allowInvEdit = canEdit(['admin', 'warehouse', 'procurement']);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && allowInvEdit) {
      setProdModalOpen(true);
    }
  }, [externalTrigger]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      await createProduct({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category,
        baseUnitName: baseUnitName.trim(),
        packUnitName: packUnitName.trim(),
        unitsPerPack: Number(unitsPerPack) || 1,
        volumeLitersPerUnit: Number(volumeLiters) || 1,
        reorderPointUnits: Number(reorderPoint) || 0,
        storageTempMin: Number(tempMin),
        storageTempMax: Number(tempMax),
        defaultSupplierId,
        lastPurchaseCostYer: Math.round(priceWS * 0.72),
        priceSupermarketYer: Number(priceSM) || 0,
        priceWholesaleYer: Number(priceWS) || 0,
        priceB2bYer: Number(priceB2B) || 0,
        taxable,
        rotationPolicy,
      });
      setProdModalOpen(false);
      setSku('');
      setName('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmStockCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countingBatch) return;
    setSubmitting(true);
    try {
      await recordStockCount({
        batch: countingBatch,
        countedUnits: Math.max(0, Number(countedUnits)),
        reason: countReason.trim() || 'جرد فعلي',
      });
      setCountingBatch(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setSubmitting(true);
    try {
      await updateBatchStorage(editingBatch, {
        warehouseZone: editZone.trim(),
        recordedTempC: Number(editTemp),
        status: editStatus,
      });
      setEditingBatch(null);
    } finally {
      setSubmitting(false);
    }
  };

  const getProductUnits = (productId: string) =>
    batches
      .filter((b) => b.productId === productId && b.status === 'active')
      .reduce((s, b) => s + b.remainingUnits, 0);

  const filteredProducts = products.filter((p) => {
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchText =
      !search.trim() ||
      p.name.includes(search.trim()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  // Sort batches FEFO (earliest expiry first!)
  const sortedBatches = [...batches]
    .filter((b) => {
      if (!search.trim()) return true;
      return (
        b.productName.includes(search.trim()) ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.warehouseZone.includes(search.trim())
      );
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('batches')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'batches'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الدفعات والصلاحية (FEFO/FIFO)
          </button>
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'catalog'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المنتجات والعبوات ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('counts')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'counts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجل الجرد والتسويات ({stockCounts.length})
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالصنف أو الدفعة أو SKU..."
              className="pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-xs w-64 focus:outline-none focus:border-[#0891B2]"
            />
          </div>
          {allowInvEdit && (
            <button
              type="button"
              onClick={() => setProdModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>صنف تنظيف جديد</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'batches' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                ترتيب الصرف التلقائي حسب الصلاحية (FEFO — الأقرب انتهاءً أولاً)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مراقبة تواريخ الإنتاج والانتهاء، حرارة المستودع، والتكلفة الفعلية لكل عبوة
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">رقم الدفعة والصنف</th>
                  <th className="py-3 font-medium">المستودع والحرارة</th>
                  <th className="py-3 font-medium">الإنتاج / الانتهاء</th>
                  <th className="py-3 font-medium">حالة الصلاحية</th>
                  <th className="py-3 font-medium">المتبقي (وحدة / عبوة)</th>
                  <th className="py-3 font-medium">تكلفة الوحدة</th>
                  <th className="py-3 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedBatches.map((batch) => {
                  const prod = products.find((p) => p.id === batch.productId);
                  const expiry = getExpiryClassification(batch.expiryDate);
                  const tempBreach =
                    prod &&
                    batch.recordedTempC !== undefined &&
                    ((prod.storageTempMin !== undefined &&
                      batch.recordedTempC < prod.storageTempMin) ||
                      (prod.storageTempMax !== undefined &&
                        batch.recordedTempC > prod.storageTempMax));

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70">
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{batch.productName}</div>
                        <div className="text-xs text-slate-500 font-mono-num">
                          {batch.batchNumber} · {batch.sku}
                        </div>
                      </td>
                      <td className="py-3 text-xs">
                        <div className="text-slate-700">{batch.warehouseZone}</div>
                        <div
                          className={`inline-flex items-center gap-1 font-mono-num mt-0.5 ${
                            tempBreach ? 'text-red-700 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          <Thermometer className="w-3 h-3" />
                          <span>{batch.recordedTempC ?? 20}°م</span>
                          {tempBreach && <span>(تجاوز الحد)</span>}
                        </div>
                      </td>
                      <td className="py-3 font-mono-num text-xs text-slate-600">
                        <div>إنتاج: {batch.mfgDate}</div>
                        <div className="text-slate-900 font-medium">انتهاء: {batch.expiryDate}</div>
                      </td>
                      <td className="py-3 text-xs">
                        {batch.status === 'quarantined' ? (
                          <span className="font-semibold text-red-700">محجور للفحص</span>
                        ) : batch.status === 'depleted' || batch.remainingUnits === 0 ? (
                          <span className="text-slate-400">مستنفد</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              expiry.state === 'expired'
                                ? 'text-red-700'
                                : expiry.state === 'critical'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {expiry.label}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="font-mono-num font-semibold text-slate-900 text-xs">
                          {prod
                            ? formatPackagingSummary(batch.remainingUnits, prod)
                            : `${batch.remainingUnits} وحدة`}
                        </div>
                        <div className="font-mono-num text-[11px] text-slate-500">
                          {batch.remainingUnits} / {batch.initialUnits} {prod?.baseUnitName || 'وحدة'}
                        </div>
                      </td>
                      <td className="py-3 font-mono-num font-medium text-slate-800">
                        {formatYer(batch.landedUnitCostYer)}
                      </td>
                      <td className="py-3">
                        {allowInvEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCountingBatch(batch);
                                setCountedUnits(batch.remainingUnits);
                                setCountReason('جرد دوري للمستودع');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5 text-[#0F4C81]" />
                              <span>جرد</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBatch(batch);
                                setEditZone(batch.warehouseZone);
                                setEditTemp(batch.recordedTempC ?? 20);
                                setEditStatus(batch.status);
                              }}
                              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                            >
                              حرارة / حجر
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedBatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      لا توجد دفعات مخزون مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            {(['all', 'dishwashing', 'disinfectants', 'laundry', 'glass_surface', 'industrial'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'جميع الفئات' : CATEGORY_LABELS[cat]}
                </button>
              )
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">الصنف و SKU</th>
                  <th className="py-3 font-medium">التعبئة والوحدات</th>
                  <th className="py-3 font-medium">التخزين والسياسة</th>
                  <th className="py-3 font-medium">الرصيد المتاح</th>
                  <th className="py-3 font-medium">سوبرماركت / جملة / B2B</th>
                  <th className="py-3 font-medium">حالة حد الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((p: Product) => {
                  const totalUnits = getProductUnits(p.id);
                  const low = totalUnits <= p.reorderPointUnits;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono-num">{p.sku}</span> · {CATEGORY_LABELS[p.category]}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-slate-700">
                        <div>
                          1 {p.packUnitName} ={' '}
                          <strong className="font-mono-num">{p.unitsPerPack}</strong> {p.baseUnitName}
                        </div>
                        <div className="text-slate-500 font-mono-num">
                          السعة: {p.volumeLitersPerUnit} لتر/كجم للوحدة
                        </div>
                      </td>
                      <td className="py-3 text-xs text-slate-600 font-mono-num">
                        <div>{p.rotationPolicy}</div>
                        <div>
                          {p.storageTempMin ?? 10}°–{p.storageTempMax ?? 28}°م
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="font-mono-num font-bold text-slate-900 text-xs">
                          {formatPackagingSummary(totalUnits, p)}
                        </div>
                        <div className="font-mono-num text-[11px] text-slate-500">
                          ({totalUnits} {p.baseUnitName} · {formatNum(totalUnits * p.volumeLitersPerUnit, 0)} لتر)
                        </div>
                      </td>
                      <td className="py-3 font-mono-num text-xs text-slate-700">
                        <div>سوبرماركت: {formatYer(p.priceSupermarketYer)}</div>
                        <div>جملة: {formatYer(p.priceWholesaleYer)} · B2B: {formatYer(p.priceB2bYer)}</div>
                      </td>
                      <td className="py-3 text-xs">
                        {low ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>بلغ حد الطلب ({p.reorderPointUnits})</span>
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">
                            متوفر (حد الطلب: {p.reorderPointUnits})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      لا توجد منتجات مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'counts' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">الصنف والدفعة</th>
                  <th className="py-3 font-medium">الرصيد الدفتري</th>
                  <th className="py-3 font-medium">الجرد الفعلي</th>
                  <th className="py-3 font-medium">الفارق</th>
                  <th className="py-3 font-medium">السبب والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stockCounts.map((cnt) => (
                  <tr key={cnt.id} className="hover:bg-slate-50/70">
                    <td className="py-3">
                      <div className="font-medium text-slate-900">{cnt.productName}</div>
                      <div className="text-xs text-slate-500 font-mono-num">{cnt.batchNumber}</div>
                    </td>
                    <td className="py-3 font-mono-num text-slate-700">{cnt.systemUnits}</td>
                    <td className="py-3 font-mono-num font-semibold text-slate-900">
                      {cnt.countedUnits}
                    </td>
                    <td
                      className={`py-3 font-mono-num font-bold ${
                        cnt.varianceUnits < 0
                          ? 'text-red-700'
                          : cnt.varianceUnits > 0
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {cnt.varianceUnits > 0 ? `+${cnt.varianceUnits}` : cnt.varianceUnits}
                    </td>
                    <td className="py-3 text-xs text-slate-600">{cnt.reason}</td>
                  </tr>
                ))}
                {stockCounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      لم يتم تسجيل عمليات جرد فعلي بعد — يمكنك إجراء جرد من تبويب الدفعات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      <ModalDrawer
        open={prodModalOpen}
        title="إضافة صنف تنظيف جديد"
        subtitle="تعريف الوحدات المتعددة (الكرتون والعبوة والسعة)، شروط الحرارة، وأسعار القطاعات"
        onClose={() => setProdModalOpen(false)}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">رمز الصنف (SKU)</label>
              <input
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="CLN-FLR-200"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المنتج</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: منظف أرضيات باللافندر (2 لتر)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الفئة</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سياسة الصرف</label>
              <select
                value={rotationPolicy}
                onChange={(e) => setRotationPolicy(e.target.value as RotationPolicy)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="FEFO">FEFO (الأقرب انتهاءً أولاً)</option>
                <option value="FIFO">FIFO (الأقدم توريداً أولاً)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المورد الافتراضي</label>
              <select
                value={defaultSupplierId}
                onChange={(e) => setDefaultSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">غير محدد</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الوحدة الصغرى</label>
              <input
                required
                value={baseUnitName}
                onChange={(e) => setBaseUnitName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">وحدة الجملة (الكبرى)</label>
              <input
                required
                value={packUnitName}
                onChange={(e) => setPackUnitName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">عدد الوحدات في الكرتون</label>
              <input
                required
                type="number"
                min={1}
                value={unitsPerPack}
                onChange={(e) => setUnitsPerPack(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سعة الوحدة (لتر / كجم)</label>
              <input
                required
                type="number"
                step="0.05"
                min={0.1}
                value={volumeLiters}
                onChange={(e) => setVolumeLiters(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">حد الطلب (بالوحدة الصغرى)</label>
              <input
                required
                type="number"
                min={0}
                value={reorderPoint}
                onChange={(e) => setReorderPoint(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">حرارة دُنيا (°م)</label>
                <input
                  type="number"
                  value={tempMin}
                  onChange={(e) => setTempMin(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">حرارة عُليا (°م)</label>
                <input
                  type="number"
                  value={tempMax}
                  onChange={(e) => setTempMax(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سعر السوبرماركت (ر.ي/عبوة)</label>
              <input
                required
                type="number"
                min={0}
                value={priceSM}
                onChange={(e) => setPriceSM(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سعر الجملة (ر.ي/عبوة)</label>
              <input
                required
                type="number"
                min={0}
                value={priceWS}
                onChange={(e) => setPriceWS(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سعر قطاع B2B (ر.ي/عبوة)</label>
              <input
                required
                type="number"
                min={0}
                value={priceB2B}
                onChange={(e) => setPriceB2B(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>خاضع لضريبة القيمة المضافة الافتراضية (15%)</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setProdModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ الصنف'}
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* Modal: Stock Count */}
      <ModalDrawer
        open={Boolean(countingBatch)}
        title={`جرد فعلي للدفعة ${countingBatch?.batchNumber || ''}`}
        subtitle={countingBatch?.productName}
        onClose={() => setCountingBatch(null)}
        maxWidthClass="max-w-md"
      >
        {countingBatch && (
          <form onSubmit={handleConfirmStockCount} className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between">
              <span>الرصيد الدفتري الحالي:</span>
              <strong className="font-mono-num">{countingBatch.remainingUnits} وحدة</strong>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الكمية الفعلية المعدودة (بالوحدة الصغرى)
              </label>
              <input
                required
                type="number"
                min={0}
                max={countingBatch.initialUnits}
                value={countedUnits}
                onChange={(e) => setCountedUnits(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">سبب التسوية</label>
              <input
                required
                value={countReason}
                onChange={(e) => setCountReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCountingBatch(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
              >
                اعتماد الجرد
              </button>
            </div>
          </form>
        )}
      </ModalDrawer>

      {/* Modal: Update Storage / Temperature / Quarantine */}
      <ModalDrawer
        open={Boolean(editingBatch)}
        title={`تحديث التخزين — ${editingBatch?.batchNumber || ''}`}
        subtitle={editingBatch?.productName}
        onClose={() => setEditingBatch(null)}
        maxWidthClass="max-w-md"
      >
        {editingBatch && (
          <form onSubmit={handleUpdateStorage} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">منطقة التخزين</label>
              <input
                required
                value={editZone}
                onChange={(e) => setEditZone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">درجة الحرارة المسجلة (°م)</label>
              <input
                required
                type="number"
                value={editTemp}
                onChange={(e) => setEditTemp(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الدفعة</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as InventoryBatch['status'])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="active">نشطة ومتاحة للبيع</option>
                <option value="quarantined">محجورة (تلف / فحص جودة)</option>
                <option value="expired">منتهية الصلاحية</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#0891B2] text-white text-xs font-semibold cursor-pointer"
              >
                حفظ التحديث
              </button>
            </div>
          </form>
        )}
      </ModalDrawer>
    </div>
  );
}
