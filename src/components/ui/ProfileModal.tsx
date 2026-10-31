import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User, Phone, Lock, Loader2, Mail, CreditCard, Calendar, MapPin } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cccd, setCccd] = useState(user?.cccd || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '');
  const [address, setAddress] = useState(user?.address || '');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !user) return null;

  const calculateAge = (dobString: string) => {
    if (!dobString) return '';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return '';
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `(${age} tuổi)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          full_name: fullName, 
          phone, 
          email, 
          cccd, 
          date_of_birth: dateOfBirth, 
          address, 
          password 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Cập nhật thất bại');
      }

      updateUser(data.user);
      setSuccess('Cập nhật thông tin thành công!');
      setPassword(''); // Clear password field after update
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        <div className="flex items-center justify-between p-6 border-b border-charcoal-100 bg-cream-50/50 sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-charcoal-900">Hồ sơ cá nhân</h2>
          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-600 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-terra-100 flex items-center justify-center text-2xl font-bold text-terra-700">
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-charcoal-900">{user.username}</h3>
              <p className="text-sm text-charcoal-500 font-medium">{user.role}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
                {error}
              </div>
            )}
            
            {success && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-xl border border-green-100">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                    placeholder="Nhập họ và tên"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Số điện thoại
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Ngày sinh {calculateAge(dateOfBirth)}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Số CCCD / CMND
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="text"
                    value={cccd}
                    onChange={(e) => setCccd(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                    placeholder="Nhập số CCCD"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">
                  Mật khẩu mới <span className="text-xs text-charcoal-400 font-normal">(để trống nếu không đổi)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-charcoal-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">
                Địa chỉ thường trú
              </label>
              <div className="relative">
                <div className="absolute top-2.5 left-3 pointer-events-none">
                  <MapPin className="h-5 w-5 text-charcoal-400" />
                </div>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 transition-colors min-h-[80px]"
                  placeholder="Nhập địa chỉ của bạn"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-charcoal-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-50 border border-charcoal-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-terra-500 hover:bg-terra-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Lưu thay đổi'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
