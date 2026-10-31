import { type ReactNode, useState, useRef, useEffect } from 'react';
import { PiCaretDownLight } from 'react-icons/pi';

interface InputProps {
  label?: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'textarea' | 'select';
  name: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number | string;
  options?: { value: string; label: string }[];
  rows?: number;
  className?: string;
}

export function Input({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  min,
  max,
  step,
  options,
  rows = 3,
  className = '',
}: InputProps) {
  const inputClasses = `w-full px-3.5 py-2.5 rounded-2xl border ${
    error
      ? 'border-rose-300 focus:ring-rose-400 focus:border-rose-400'
      : 'border-charcoal-200 focus:ring-wood-400 focus:border-wood-400'
  } bg-white text-charcoal-900 placeholder-charcoal-400 transition-colors disabled:bg-cream-100 disabled:cursor-not-allowed ${className}`;

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={inputClasses}
        />
      );
    }

    if (type === 'select') {
      return (
        <CustomSelect 
          value={value} 
          onChange={onChange} 
          options={options || []} 
          disabled={disabled} 
          className={inputClasses}
        />
      );
    }

    return (
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={type === 'number' ? (e) => e.target.select() : undefined}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={inputClasses}
      />
    );
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium font-sans text-charcoal-800"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      {renderInput()}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  variant?: 'default' | 'wood' | 'sage' | 'amber' | 'rose';
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
}: StatCardProps) {
  const iconBgClasses = {
    default: 'bg-charcoal-100 text-charcoal-500',
    wood: 'bg-wood-100 text-wood-600',
    sage: 'bg-sage-100 text-sage-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-charcoal-500">{title}</p>
          <p className="text-2xl font-bold text-charcoal-900 mt-2">
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
          </p>
          {trend && (
            <p className="text-xs text-charcoal-400 mt-1.5">
              {trend.label}: {trend.value.toLocaleString('vi-VN')}
            </p>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBgClasses[variant]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ status, variant = 'default', size = 'md' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-charcoal-100 text-charcoal-600',
    success: 'bg-sage-100 text-sage-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-wood-100 text-wood-700',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const statusLabels: Record<string, string> = {
    available: 'Trống',
    occupied: 'Đang thuê',
    maintenance: 'Bảo trì',
    new: 'Mới',
    in_progress: 'Đang xử lý',
    resolved: 'Đã xong',
    closed: 'Đã đóng',
    pending: 'Chưa thanh toán',
    paid: 'Đã thanh toán',
    overdue: 'Quá hạn',
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Khẩn cấp',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-lg ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 bg-cream-200 rounded-2xl flex items-center justify-center mb-5">
          <div className="text-charcoal-400">{icon}</div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-charcoal-900">{title}</h3>
      <p className="text-charcoal-500 mt-2 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-4 border-wood-200 border-t-wood-500 rounded-full animate-spin" />
    </div>
  );
}


function CustomSelect({ value, onChange, options, disabled, className }: { value: string | number, onChange: (v: string) => void, options: {value: string, label: string}[], disabled?: boolean, className: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === String(value));
  const baseClasses = className.replace('focus:ring-wood-400', '').replace('focus:border-wood-400', '');

  return (
    <div ref={selectRef} className="relative w-full">
      <div 
        className={`${baseClasses} flex items-center justify-between cursor-pointer select-none ${disabled ? 'opacity-70 pointer-events-none' : ''} ${isOpen ? 'ring-1 ring-wood-400 border-wood-400' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-charcoal-900' : 'text-charcoal-400'}>
          {selectedOption ? selectedOption.label : '-- Chọn --'}
        </span>
        <PiCaretDownLight className={`w-4 h-4 text-charcoal-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-charcoal-100 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                String(value) === opt.value 
                  ? 'bg-wood-50 text-wood-700 font-medium' 
                  : 'text-charcoal-700 hover:bg-cream-50'
              }`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
