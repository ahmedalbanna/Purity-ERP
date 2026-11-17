/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErpProvider, useErp } from './context/ErpContext';
import { LoginGate } from './components/LoginGate';
import { LayoutShell, NavSection } from './components/LayoutShell';
import { DashboardView } from './views/DashboardView';
import { ProcurementView } from './views/ProcurementView';
import { InventoryView } from './views/InventoryView';
import { SalesView } from './views/SalesView';
import { FleetView } from './views/FleetView';
import { FinancialsView } from './views/FinancialsView';
import { UsersView } from './views/UsersView';

function ErpWorkspace() {
  const { firebaseUser, authLoading, canEdit } = useErp();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [actionTriggers, setActionTriggers] = useState<Record<NavSection, number>>({
    dashboard: 0,
    procurement: 0,
    inventory: 0,
    sales: 0,
    fleet: 0,
    financials: 0,
    users: 0,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-display font-bold text-lg mx-auto animate-pulse">
            ن
          </div>
          <div className="text-sm text-slate-600">جاري تهيئة نظام نقاء ERP...</div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginGate />;
  }

  const getPrimaryAction = (): { label: string; handler: () => void } | undefined => {
    if (activeSection === 'dashboard' && canEdit(['admin', 'sales'])) {
      return {
        label: 'فاتورة مبيعات جديدة',
        handler: () => {
          setActiveSection('sales');
          setActionTriggers((prev) => ({ ...prev, sales: prev.sales + 1 }));
        },
      };
    }
    if (activeSection === 'procurement' && canEdit(['admin', 'procurement'])) {
      return {
        label: 'أمر شراء جديد',
        handler: () =>
          setActionTriggers((prev) => ({ ...prev, procurement: prev.procurement + 1 })),
      };
    }
    if (activeSection === 'inventory' && canEdit(['admin', 'warehouse', 'procurement'])) {
      return {
        label: 'صنف تنظيف جديد',
        handler: () =>
          setActionTriggers((prev) => ({ ...prev, inventory: prev.inventory + 1 })),
      };
    }
    if (activeSection === 'sales' && canEdit(['admin', 'sales'])) {
      return {
        label: 'فاتورة مبيعات جديدة',
        handler: () => setActionTriggers((prev) => ({ ...prev, sales: prev.sales + 1 })),
      };
    }
    if (activeSection === 'fleet' && canEdit(['admin', 'sales', 'warehouse'])) {
      return {
        label: 'مركبة توزيع جديدة',
        handler: () => setActionTriggers((prev) => ({ ...prev, fleet: prev.fleet + 1 })),
      };
    }
    if (activeSection === 'financials' && canEdit(['admin', 'finance', 'sales'])) {
      return {
        label: 'سند قبض جديد',
        handler: () =>
          setActionTriggers((prev) => ({ ...prev, financials: prev.financials + 1 })),
      };
    }
    return undefined;
  };

  const primaryAction = getPrimaryAction();

  return (
    <LayoutShell
      activeSection={activeSection}
      onNavigate={setActiveSection}
      primaryActionLabel={primaryAction?.label}
      onPrimaryAction={primaryAction?.handler}
    >
      {activeSection === 'dashboard' && <DashboardView onNavigate={setActiveSection} />}
      {activeSection === 'procurement' && (
        <ProcurementView externalTrigger={actionTriggers.procurement} />
      )}
      {activeSection === 'inventory' && (
        <InventoryView externalTrigger={actionTriggers.inventory} />
      )}
      {activeSection === 'sales' && <SalesView externalTrigger={actionTriggers.sales} />}
      {activeSection === 'fleet' && <FleetView externalTrigger={actionTriggers.fleet} />}
      {activeSection === 'financials' && (
        <FinancialsView externalTrigger={actionTriggers.financials} />
      )}
      {activeSection === 'users' && <UsersView />}
    </LayoutShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErpProvider>
        <ErpWorkspace />
      </ErpProvider>
    </ErrorBoundary>
  );
}
