import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في النظام',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ERP ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error && parsed.operationType) {
          friendlyMessage = `تعذر تنفيذ العملية (${parsed.operationType}) على المسار (${parsed.path || 'غير محدد'}): ${parsed.error}`;
        }
      } catch {
        // Keep raw message if not JSON
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 text-right">
            <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              تنبيه تشغيل النظام
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 break-words">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0c3c66] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل النظام</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
