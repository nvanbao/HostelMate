import { type ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cream-100 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-wood-600 text-white hover:bg-wood-700 focus:ring-wood-400 shadow-soft',
    secondary:
      'bg-white text-charcoal-700 border border-charcoal-200 hover:bg-cream-50 focus:ring-charcoal-300',
    danger:
      'bg-rose-100 text-rose-700 hover:bg-rose-200 focus:ring-rose-400',
    success:
      'bg-sage-100 text-sage-700 hover:bg-sage-200 focus:ring-sage-400',
    ghost:
      'bg-transparent text-charcoal-600 hover:bg-cream-100 focus:ring-charcoal-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}
