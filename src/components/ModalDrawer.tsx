import React from 'react';
import { X } from 'lucide-react';

interface ModalDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalDrawer({
  open,
  title,
  subtitle,
  onClose,
  maxWidthClass = 'max-w-2xl',
  children,
}: ModalDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 overflow-y-auto">
      <div
        className={`w-full ${maxWidthClass} bg-white border border-slate-200 rounded-xl overflow-hidden my-8`}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
