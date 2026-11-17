import React from 'react';
import { Shield, Database } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { ROLE_LABELS, UserRole } from '../types/erp';

export function UsersView() {
  const {
    usersList,
    userProfile,
    updateUserRole,
    canEdit,
    seedOperationalData,
    seeding,
    products,
  } = useErp();

  const isAdmin = canEdit(['admin']);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#0F4C81] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              إدارة صلاحيات الموظفين والأدوار (RBAC)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تُطبق الصلاحيات على مستوى واجهة النظام وقواعد أمان Firestore السحابية
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={seedOperationalData}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-4 h-4 text-[#0891B2]" />
            <span>
              {seeding
                ? 'جاري تهيئة البيانات...'
                : products.length > 0
                  ? 'إعادة تهيئة البيانات التجريبية'
                  : 'تهيئة بيانات الشركة التجريبية'}
            </span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-3 font-medium">اسم الموظف</th>
                <th className="py-3 font-medium">معرف الحساب</th>
                <th className="py-3 font-medium">الدور الوظيفي</th>
                <th className="py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {usersList.map((u) => {
                const isSelf = u.uid === userProfile?.uid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="py-3 font-medium text-slate-900">
                      {u.displayName} {isSelf && <span className="text-xs text-[#0891B2]">(حسابك)</span>}
                    </td>
                    <td className="py-3 font-mono-num text-xs text-slate-500">{u.uid}</td>
                    <td className="py-3">
                      {isAdmin && !isSelf ? (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateUserRole(u.uid, e.target.value as UserRole, u.active)
                          }
                          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        >
                          {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                            <option key={roleKey} value={roleKey}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-slate-800">
                          {ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-xs">
                      {isAdmin && !isSelf ? (
                        <button
                          type="button"
                          onClick={() => updateUserRole(u.uid, u.role, !u.active)}
                          className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                            u.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {u.active ? 'نشط' : 'موقوف'}
                        </button>
                      ) : (
                        <span className={u.active ? 'text-emerald-700 font-semibold' : 'text-red-700'}>
                          {u.active ? 'نشط' : 'موقوف'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
