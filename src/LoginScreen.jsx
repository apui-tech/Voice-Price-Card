import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function LoginScreen({ onLogin, onSetup, isSetup, isLoading, error }) {
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);

  const pinMismatch = isSetup && pin && pinConfirm && pin !== pinConfirm;
  const canSubmit = !isLoading && pin && (!isSetup || (pin === pinConfirm));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isSetup) onSetup(pin);
    else onLogin(pin);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 flex flex-col items-center justify-center px-5 py-10">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Logo + Title */}
      <div className="mb-8 text-center relative z-10">
        <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-5xl mb-4 mx-auto shadow-2xl border border-white/30">
          🧺
        </div>
        <h1 className="text-3xl font-black text-white drop-shadow-sm">Sổ Giá Giọng Nói</h1>
        <p className="text-emerald-100/80 text-sm mt-1.5">Đọc giá thông minh • Trích xuất bằng AI</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-xs relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
          {/* Card Header */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-emerald-200" />
            <h2 className="text-white font-bold text-lg">
              {isSetup ? 'Thiết lập mã PIN' : 'Đăng nhập'}
            </h2>
          </div>
          <p className="text-emerald-100/70 text-xs text-center mb-5">
            {isSetup
              ? 'Tạo mã PIN để bảo vệ ứng dụng của bạn'
              : 'Nhập mã PIN để truy cập Sổ Giá'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* PIN Input */}
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="••••••"
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoFocus
                required
                className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-white/20 text-white placeholder-white/40 text-center text-2xl font-bold tracking-[0.4em] outline-none border border-white/30 focus:border-white/70 focus:bg-white/25 transition"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm PIN (setup only) */}
            {isSetup && (
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="Nhập lại PIN"
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/20 text-white placeholder-white/40 text-center text-2xl font-bold tracking-[0.4em] outline-none border border-white/30 focus:border-white/70 focus:bg-white/25 transition"
                />
              </div>
            )}

            {/* PIN mismatch warning */}
            {pinMismatch && (
              <p className="text-yellow-200 text-xs text-center flex items-center justify-center gap-1">
                ⚠️ Hai mã PIN không khớp nhau
              </p>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-500/25 border border-red-400/40 rounded-xl px-3 py-2.5">
                <p className="text-red-100 text-xs text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 mt-1 bg-white text-emerald-700 font-black rounded-2xl text-sm tracking-wide transition hover:bg-emerald-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-black/20"
            >
              {isLoading
                ? '⏳ Đang xác thực...'
                : isSetup
                  ? '✅ Tạo mã PIN & Vào app'
                  : '🚀 Đăng nhập'}
            </button>
          </form>

          {/* Help text */}
          <p className="text-white/30 text-[10px] text-center mt-4 leading-relaxed">
            {isSetup
              ? 'Chỉ cần thiết lập 1 lần. Mã PIN được mã hóa và lưu trên Cloud.'
              : 'Quên mã PIN? Liên hệ admin để reset trong Supabase Dashboard.'}
          </p>
        </div>
      </div>
    </div>
  );
}
