import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, LogIn, Lock, User, ArrowRight } from 'lucide-react';

import { loginUser, changePassword } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser({ username, password });
      if (data.require_password_change) {
        setRequirePasswordChange(true);
      } else {
        login(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('Vui lòng liên hệ Chủ nhà trọ hoặc Ban quản lý để được hỗ trợ cấp lại mật khẩu.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await changePassword(password, newPassword);
      // Login after change
      const data = await loginUser({ username, password: newPassword });
      login(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-cream-50 font-sans selection:bg-wood-200 selection:text-wood-900">
      {/* Left side: Hero Image (Hidden on mobile/tablet) */}
      <div className="relative hidden w-1/2 lg:block">
        <div className="absolute inset-0 bg-charcoal-900/10" /> {/* Subtle overlay */}
        <img
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=2070&auto=format&fit=crop"
          alt="Luxury modern scandinavian interior"
          className="h-full w-full object-cover"
        />
        {/* Editorial Text Overlay */}
        <div className="absolute bottom-16 left-16 max-w-lg text-white">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            HostelMate
          </p>
          <h1 className="font-serif text-5xl leading-tight text-white drop-shadow-lg">
            Khởi nguồn <br />
            <span className="italic text-wood-200">cuộc sống đẳng cấp.</span>
          </h1>
        </div>
      </div>

      {/* Right side: Form Container */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-24 xl:px-32">
        <div className="mx-auto w-full max-w-md">
          {/* Logo / Branding */}
          <div className="mb-12 flex items-center justify-center lg:justify-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wood-900 text-cream-50 shadow-soft">
              <Building2 className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="ml-4 font-serif text-2xl font-bold tracking-wide text-charcoal-950">
              HostelMate.
            </span>
          </div>

          {requirePasswordChange ? (
            /* CHANGE PASSWORD FLOW */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="mb-3 font-serif text-3xl font-semibold text-charcoal-900">
                Bảo mật tài khoản
              </h2>
              <p className="mb-10 text-sm leading-relaxed text-charcoal-500">
                Đây là lần đăng nhập đầu tiên của bạn. Vì sự an toàn, vui lòng thiết lập một mật khẩu mới để tiếp tục.
              </p>

              <form className="space-y-6" onSubmit={handleChangePassword}>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-400" strokeWidth={1.5} />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-2xl border border-charcoal-200 bg-white py-4 pl-12 pr-4 text-charcoal-900 transition-all placeholder:text-charcoal-300 focus:border-wood-400 focus:outline-none focus:ring-4 focus:ring-wood-100"
                      placeholder="Nhập mật khẩu mới"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-400" strokeWidth={1.5} />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-charcoal-200 bg-white py-4 pl-12 pr-4 text-charcoal-900 transition-all placeholder:text-charcoal-300 focus:border-wood-400 focus:outline-none focus:ring-4 focus:ring-wood-100"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-8 flex w-full items-center justify-center rounded-2xl bg-charcoal-950 py-4 text-sm font-semibold text-white transition-all hover:bg-wood-800 focus:outline-none focus:ring-4 focus:ring-wood-200 disabled:opacity-70"
                >
                  {loading ? (
                    'Đang xử lý...'
                  ) : (
                    <>
                      Hoàn tất & Đăng nhập
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* NORMAL LOGIN FLOW */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="mb-3 font-serif text-3xl font-semibold text-charcoal-900">
                Chào mừng trở lại
              </h2>
              <p className="mb-10 text-sm leading-relaxed text-charcoal-500">
                Vui lòng nhập thông tin để truy cập hệ thống quản lý.
              </p>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                    Tên đăng nhập / Email
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-400" strokeWidth={1.5} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-2xl border border-charcoal-200 bg-white py-4 pl-12 pr-4 text-charcoal-900 transition-all placeholder:text-charcoal-300 focus:border-wood-400 focus:outline-none focus:ring-4 focus:ring-wood-100"
                      placeholder="Ví dụ: admin, user@hostelmate.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                      Mật khẩu
                    </label>
                    <button 
                      type="button" 
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-wood-600 transition-colors hover:text-wood-800"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-400" strokeWidth={1.5} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-charcoal-200 bg-white py-4 pl-12 pr-4 text-charcoal-900 transition-all placeholder:text-charcoal-300 focus:border-wood-400 focus:outline-none focus:ring-4 focus:ring-wood-100"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-8 flex w-full items-center justify-center rounded-2xl bg-charcoal-950 py-4 text-sm font-semibold text-white transition-all hover:bg-wood-800 focus:outline-none focus:ring-4 focus:ring-wood-200 disabled:opacity-70"
                >
                  {loading ? (
                    'Đang đăng nhập...'
                  ) : (
                    <>
                      Đăng nhập
                      <LogIn className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-12 text-center text-xs text-charcoal-400">
            <p>Vui lòng liên hệ ban quản lý nếu chưa có tài khoản.</p>
            <p className="mt-1">© {new Date().getFullYear()} HostelMate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
