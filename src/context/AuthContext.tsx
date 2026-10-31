import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { PiLockKeyLight, PiSignOutLight } from 'react-icons/pi';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || '/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include' // Use HttpOnly cookie
        });
        
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error(err);
    }
    setUser(null);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
        {user?.is_locked ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-charcoal-900/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in border border-charcoal-100">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-500">
                <PiLockKeyLight className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-charcoal-900 mb-2 tracking-wide">Tài khoản bị khóa</h2>
              <p className="text-charcoal-500 text-sm mb-8 leading-relaxed">
                Tài khoản của bạn đã bị khóa tạm thời. Vui lòng liên hệ với Chủ trọ hoặc Quản lý để biết thêm chi tiết.
              </p>
              <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-charcoal-900 text-white px-5 py-3 rounded-xl font-medium hover:bg-charcoal-800 transition-colors"
              >
                <PiSignOutLight className="w-5 h-5" /> Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          children
        )}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
