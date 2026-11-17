import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Store,
  Truck,
  Landmark,
  Users,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { ROLE_LABELS } from '../types/erp';

export type NavSection =
  | 'dashboard'
  | 'procurement'
  | 'inventory'
  | 'sales'
  | 'fleet'
  | 'financials'
  | 'users';

interface LayoutShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'procurement', label: 'المشتريات والموردون', icon: ShoppingBag },
  { id: 'inventory', label: 'المخزون والصلاحيات', icon: Boxes },
  { id: 'sales', label: 'المبيعات والمناديب', icon: Store },
  { id: 'fleet', label: 'الأسطول وخطوط السير', icon: Truck },
  { id: 'financials', label: 'المالية والربحية', icon: Landmark },
  { id: 'users', label: 'الصلاحيات والمستخدمون', icon: Users },
];

export function LayoutShell({
  activeSection,
  onNavigate,
  primaryActionLabel,
  onPrimaryAction,
  children,
}: LayoutShellProps) {
  const { userProfile, firebaseUser, signOutUser, toasts, dismissToast } = useErp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const handleNav = (id: NavSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (260px on desktop, RTL right side) */}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 h-screen w-[260px] shrink-0 bg-white border-l border-slate-200 flex flex-col justify-between transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-display font-bold text-sm">
                ن
              </div>
              <span className="font-display font-bold text-base text-slate-900 whitespace-nowrap">
                نقاء ERP
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#0F4C81] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-200' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              {!avatarErr ? (
                <img
                  src={
                    firebaseUser?.photoURL ||
                    '/src/assets/images/avatar_manager_user_1794938948087.jpg'
                  }
                  alt={userProfile?.displayName || 'المستخدم'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarErr(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#0F4C81]">
                  {userProfile?.displayName?.slice(0, 1) || 'م'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {userProfile?.displayName || 'مستخدم'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {userProfile ? ROLE_LABELS[userProfile.role] : 'جاري التحميل'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="فتح القائمة"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">نقاء ERP</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-display font-bold text-slate-900 truncate">
                {currentNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
              العملة: <span className="font-mono-num font-semibold text-slate-700">YER</span> · الضريبة: <span className="font-mono-num font-semibold text-slate-700">15%</span>
            </span>
            {primaryActionLabel && onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4C81] hover:bg-[#0c3c66] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{primaryActionLabel}</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium shadow-sm ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : toast.type === 'info'
                    ? 'bg-cyan-50 border-cyan-200 text-cyan-900'
                    : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="إغلاق التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
