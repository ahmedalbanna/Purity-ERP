import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Plus, Truck } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import {
  DELIVERY_STATUS_LABELS,
  formatYer,
  SalesOrder,
  VEHICLE_STATUS_LABELS,
  VehicleStatus,
} from '../types/erp';
import { ModalDrawer } from '../components/ModalDrawer';

interface FleetViewProps {
  externalTrigger?: number;
}

export function FleetView({ externalTrigger }: FleetViewProps) {
  const {
    vehicles,
    salesOrders,
    createVehicle,
    updateVehicleStatus,
    updateSalesOrderDelivery,
    canEdit,
  } = useErp();

  const [tab, setTab] = useState<'dispatch' | 'vehicles'>('dispatch');
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [modelName, setModelName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [capacityCartons, setCapacityCartons] = useState(300);
  const [currentRoute, setCurrentRoute] = useState('خط السير الشمالي — صنعاء');

  const [deliveringOrder, setDeliveringOrder] = useState<SalesOrder | null>(null);
  const [collectAmountYer, setCollectAmountYer] = useState(0);
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allowFleetEdit = canEdit(['admin', 'sales', 'warehouse']);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && allowFleetEdit) {
      setVehModalOpen(true);
    }
  }, [externalTrigger]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim() || !driverName.trim()) return;
    setSubmitting(true);
    try {
      await createVehicle({
        plateNumber: plateNumber.trim(),
        modelName: modelName.trim() || 'شاحنة توزيع',
        driverName: driverName.trim(),
        capacityCartons: Number(capacityCartons) || 250,
        currentRoute: currentRoute.trim(),
        status: 'ready',
      });
      setVehModalOpen(false);
      setPlateNumber('');
      setModelName('');
      setDriverName('');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeliveryModal = (order: SalesOrder) => {
    setDeliveringOrder(order);
    const remaining = Math.max(0, order.totalYer - order.paidAmountYer);
    setCollectAmountYer(remaining);
    setAssignVehicleId(order.vehicleId || vehicles[0]?.id || '');
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringOrder) return;
    setSubmitting(true);
    try {
      const veh = vehicles.find((v) => v.id === assignVehicleId);
      await updateSalesOrderDelivery({
        order: deliveringOrder,
        deliveryStatus: 'delivered',
        vehicleId: veh?.id || deliveringOrder.vehicleId,
        routeName: veh?.currentRoute || deliveringOrder.routeName,
        collectCashAmountYer: Number(collectAmountYer) || 0,
      });
      setDeliveringOrder(null);
    } finally {
      setSubmitting(false);
    }
  };

  const activeDeliveries = salesOrders.filter((o) => o.deliveryStatus !== 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('dispatch')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'dispatch'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            التسليم والتحصيل الميداني ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('vehicles')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'vehicles'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            أسطول سيارات التوزيع ({vehicles.length})
          </button>
        </div>

        {allowFleetEdit && (
          <button
            type="button"
            onClick={() => setVehModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-semibold cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مركبة توزيع</span>
          </button>
        )}
      </div>

      {tab === 'dispatch' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 font-medium">الفاتورة والعميل</th>
                  <th className="py-3 font-medium">خط السير والمركبة</th>
                  <th className="py-3 font-medium">قيمة الفاتورة</th>
                  <th className="py-3 font-medium">المحصل / المتبقي</th>
                  <th className="py-3 font-medium">حالة التسليم</th>
                  <th className="py-3 font-medium">إجراء الميدان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeDeliveries.map((ord) => {
                  const veh = vehicles.find((v) => v.id === ord.vehicleId);
                  const remaining = Math.max(0, ord.totalYer - ord.paidAmountYer);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70">
                      <td className="py-3">
                        <div className="font-mono-num font-semibold text-slate-900">
                          {ord.invoiceNumber}
                        </div>
                        <div className="text-xs text-slate-600">{ord.customerName}</div>
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        <div>{ord.routeName || '—'}</div>
                        <div className="text-slate-500">
                          {veh ? `${veh.plateNumber} · ${veh.driverName}` : 'لم تُسند سيارة'}
                        </div>
                      </td>
                      <td className="py-3 font-mono-num font-bold text-slate-900">
                        {formatYer(ord.totalYer)}
                      </td>
                      <td className="py-3 font-mono-num text-xs">
                        <div className="text-emerald-700">
                          محصل: {formatYer(ord.paidAmountYer)}
                        </div>
                        <div className={remaining > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                          متبقي: {formatYer(remaining)}
                        </div>
                      </td>
                      <td className="py-3 text-xs">
                        <span
                          className={`font-semibold ${
                            ord.deliveryStatus === 'delivered'
                              ? 'text-emerald-700'
                              : ord.deliveryStatus === 'dispatched'
                                ? 'text-[#0891B2]'
                                : 'text-amber-700'
                          }`}
                        >
                          {DELIVERY_STATUS_LABELS[ord.deliveryStatus]}
                        </span>
                      </td>
                      <td className="py-3">
                        {allowFleetEdit && ord.deliveryStatus !== 'delivered' ? (
                          <div className="flex items-center gap-2">
                            {ord.deliveryStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateSalesOrderDelivery({
                                    order: ord,
                                    deliveryStatus: 'dispatched',
                                    vehicleId: ord.vehicleId || vehicles[0]?.id,
                                  })
                                }
                                className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                              >
                                خروج للخط
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openDeliveryModal(ord)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0F4C81] hover:bg-[#0c3c66] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>تسليم وتحصيل</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>منجز</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {activeDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      لا توجد رحلات توصيل مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {vehicles.map((veh) => {
            const assignedOrders = salesOrders.filter(
              (o) => o.vehicleId === veh.id && o.deliveryStatus !== 'delivered'
            );
            return (
              <div key={veh.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-display font-bold text-base text-slate-900">
                      {veh.plateNumber}
                    </div>
                    <div className="text-xs text-slate-500">{veh.modelName}</div>
                  </div>
                  <Truck className="w-4 h-4 text-[#0F4C81]" />
                </div>

                <div className="space-y-2 text-xs border-t border-slate-100 pt-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">السائق:</span>
                    <span className="font-medium text-slate-900">{veh.driverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">خط السير:</span>
                    <span className="text-slate-800">{veh.currentRoute}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">السعة القصوى:</span>
                    <span className="font-mono-num text-slate-800">{veh.capacityCartons} كرتون</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">طلبات قيد التوصيل:</span>
                    <span className="font-mono-num font-bold text-[#0891B2]">
                      {assignedOrders.length} فاتورة
                    </span>
                  </div>
                </div>

                {allowFleetEdit && (
                  <select
                    value={veh.status}
                    onChange={(e) =>
                      updateVehicleStatus(veh.id, e.target.value as VehicleStatus)
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50"
                  >
                    {Object.entries(VEHICLE_STATUS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        الحالة: {label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Deliver & Collect Field Cash */}
      <ModalDrawer
        open={Boolean(deliveringOrder)}
        title={`تسليم الفاتورة ${deliveringOrder?.invoiceNumber || ''} والتحصيل الميداني`}
        subtitle={deliveringOrder?.customerName}
        onClose={() => setDeliveringOrder(null)}
        maxWidthClass="max-w-md"
      >
        {deliveringOrder && (
          <form onSubmit={handleConfirmDelivery} className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <strong className="font-mono-num">{formatYer(deliveringOrder.totalYer)}</strong>
              </div>
              <div className="flex justify-between">
                <span>المتبقي للتحصيل:</span>
                <strong className="font-mono-num text-[#0F4C81]">
                  {formatYer(Math.max(0, deliveringOrder.totalYer - deliveringOrder.paidAmountYer))}
                </strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المركبة المنفذة</label>
              <select
                value={assignVehicleId}
                onChange={(e) => setAssignVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.driverName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                المبلغ المحصل نقداً عند التسليم (ر.ي — اتركه 0 للآجل)
              </label>
              <input
                type="number"
                min={0}
                max={Math.max(0, deliveringOrder.totalYer - deliveringOrder.paidAmountYer)}
                value={collectAmountYer}
                onChange={(e) => setCollectAmountYer(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeliveringOrder(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
              >
                {submitting ? 'جاري التأكيد...' : 'تأكيد التسليم والتحصيل'}
              </button>
            </div>
          </form>
        )}
      </ModalDrawer>

      {/* Modal: Add Vehicle */}
      <ModalDrawer
        open={vehModalOpen}
        title="إضافة مركبة توزيع للأسطول"
        onClose={() => setVehModalOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateVehicle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">رقم اللوحة</label>
              <input
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="صنعاء 88211"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع وطراز السيارة</label>
              <input
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="إيسوزو دينا مبردة"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم السائق</label>
              <input
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الحمولة القصوى (كرتون)</label>
              <input
                required
                type="number"
                min={20}
                value={capacityCartons}
                onChange={(e) => setCapacityCartons(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">خط السير الأساسي</label>
            <input
              required
              value={currentRoute}
              onChange={(e) => setCurrentRoute(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setVehModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold cursor-pointer"
            >
              حفظ المركبة
            </button>
          </div>
        </form>
      </ModalDrawer>
    </div>
  );
}
