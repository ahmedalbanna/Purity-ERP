import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, Boxes, Truck, TrendingUp } from 'lucide-react';
import { useErp } from '../context/ErpContext';

export function LoginGate() {
  const { signInWithGoogle, authError } = useErp();
  const [imgError, setImgError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-display font-bold text-lg">
                ن
              </div>
              <span className="font-display text-xl font-bold text-slate-900 whitespace-nowrap">
                نقاء ERP
              </span>
            </div>

            <h1 className="font-display text-2xl lg:text-3xl font-bold text-slate-900 leading-snug mb-4 [text-wrap:balance]">
              نظام إدارة تجارة وتوزيع منتجات التنظيف
            </h1>
            <p className="text-sm lg:text-base text-slate-600 leading-relaxed mb-8">
              منصة تشغيلية موحدة تربط المشتريات الدولية وتكاليف الاستيراد مع مراقبة الصلاحيات FEFO، وتوزيع الأسطول، وحسابات العملاء والموردين بالريال اليمني.
            </p>

            <div className="space-y-4 border-t border-slate-200 pt-6 mb-8">
              <div className="flex items-start gap-3">
                <Boxes className="w-5 h-5 text-[#0891B2] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    مخزون ذكي بالدفعات والصلاحيات (FEFO / FIFO)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    إدارة الكرتون والعبوة واللتر مع مراقبة حرارة التخزين وحد الطلب
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-[#0891B2] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    مبيعات القطاعات وأسطول خطوط السير
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    تسعير متدرج للسوبرماركت والجملة و B2B مع التحصيل الميداني
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-[#0891B2] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    ربحية دقيقة لكل صنف وعميل ومندوب
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    احتساب التكلفة الشاملة للشحن والجمارك وضريبة 15% تلقائياً
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-[#0F4C81] hover:bg-[#0c3c66] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{signingIn ? 'جاري التحقق من الحساب...' : 'تسجيل الدخول عبر حساب Google'}</span>
              <ArrowLeft className="w-4 h-4 mr-auto" />
            </button>
            <p className="text-xs text-slate-500 mt-3 text-center">
              تُحفظ البيانات سحابياً عبر Firebase Firestore مع فصل الصلاحيات حسب الدور الوظيفي
            </p>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[280px] lg:min-h-full bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
          {!imgError ? (
            <img
              src="/src/assets/images/login_cleaning_warehouse_1794938949005.jpg"
              alt="مستودع توزيع منتجات التنظيف الحديث"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sky-900 via-[#0F4C81] to-cyan-700 flex flex-col items-center justify-center p-8 text-white text-center">
              <Boxes className="w-12 h-12 mb-3 opacity-90" />
              <div className="font-display text-lg font-bold">مركز التوزيع واللوجستيات</div>
              <div className="text-xs text-cyan-100 mt-1">تغطية شاملة للمستودعات وأسطول التوزيع</div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent flex items-end p-8">
            <div className="text-white">
              <div className="text-xs text-cyan-200 mb-1">العملة المعتمدة: الريال اليمني (YER) · الضريبة: 15%</div>
              <div className="font-display text-lg font-bold">
                رقابة متكاملة من الميناء حتى نقطة البيع
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
