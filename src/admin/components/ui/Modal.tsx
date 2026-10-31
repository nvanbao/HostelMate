import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-charcoal-900/40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative flex flex-col w-full ${sizeClasses[size]} bg-white rounded-[2rem] shadow-elevated transform transition-all animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[95vh]`}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-charcoal-100 bg-white/80 backdrop-blur-sm z-10">
          <h2 className="text-xl font-serif text-charcoal-900 tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-cream-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-2">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

