import React, { useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Eye,
  EyeOff,
  Lock,
  Phone,
  ShieldCheck,
  TrendingUp,
  Truck,
  User,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';

export function LoginGate() {
  const {
    signInWithGoogle,
    loginWithCredentials,
    registerWithCredentials,
    clearAuthError,
    authError,
    authNeedsConsoleSetup,
  } = useErp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    clearAuthError();
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithCredentials({ identifier, password });
      } else {
        await registerWithCredentials({ displayName, identifier, password });
      }
    } catch {
      // authError state handles user feedback cleanly
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-6 p-7 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-display font-bold text-base">
                  ن
                </div>
                <span className="font-display text-lg font-bold text-slate-900 whitespace-nowrap">
                  نقاء ERP
                </span>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  حساب جديد
                </button>
              </div>
            </div>

            <h1 className="font-display text-xl lg:text-2xl font-bold text-slate-900 leading-snug mb-2 [text-wrap:balance]">
              {mode === 'login'
                ? 'الدخول إلى نظام تجارة وتوزيع منتجات التنظيف'
                : 'إنشاء حساب موظف جديد'}
            </h1>
            <p className="text-xs lg:text-sm text-slate-600 leading-relaxed mb-6">
              {mode === 'login'
                ? 'سجل الدخول بالبريد الإلكتروني أو رقم الهاتف وكلمة المرور، أو عبر حساب Google.'
                : 'أنشئ حساباً جديداً باستخدام بريدك الإلكتروني أو رقم هاتفك للوصول إلى لوحة العمليات.'}
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1.5">
                <div className="font-semibold">{authError}</div>
                {authNeedsConsoleSetup && (
                  <div className="text-[11px] text-red-700 leading-relaxed">
                    لتفعيل الدخول بكلمة المرور: افتح Firebase Console ← Authentication ← Sign-in method ← فعّل خيار{' '}
                    <span className="font-mono-num font-semibold">Email/Password</span>.
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الاسم الكامل
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="مثال: سالم محمد الحيمي"
                      className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0891B2]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البريد الإلكتروني أو رقم الهاتف
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@company.com أو 777123456"
                    className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0891B2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-9 pl-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0891B2]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C81] hover:bg-[#0c3c66] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? 'جاري التنفيذ...'
                    : mode === 'login'
                      ? 'دخول إلى النظام'
                      : 'إنشاء الحساب والدخول'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400">أو المتابعة السريعة عبر</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4 text-[#0891B2]" />
              <span>تسجيل الدخول بحساب Google</span>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-3 gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-[#0891B2] shrink-0" />
              <span>مخزون FEFO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#0891B2] shrink-0" />
              <span>أسطول التوزيع</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#0891B2] shrink-0" />
              <span>ربحية بالريال</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-full bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
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
              <div className="text-xs text-cyan-200 mb-1">
                العملة المعتمدة: الريال اليمني (YER) · الضريبة: 15%
              </div>
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
