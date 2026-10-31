import { useState, useRef, useEffect } from 'react';
import { PiCaretDownLight, PiCheckLight } from 'react-icons/pi';

export function FilterDropdown({ value, onChange, options, className = "" }: {
  value: string;
  onChange: (val: string) => void;
  options: {value: string, label: string}[];
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-sm rounded-full border border-charcoal-100 hover:border-charcoal-200 focus:ring-2 focus:ring-wood-400 focus:border-wood-400 bg-white text-charcoal-800 transition-all shadow-soft flex items-center justify-between outline-none gap-2"
      >
        <span className="truncate font-medium">{selectedOption?.label || ''}</span>
        <PiCaretDownLight className={`w-4 h-4 text-charcoal-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 min-w-max bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-cream-200 py-2 z-50 animate-fade-in overflow-hidden">
          {options.map(option => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-5 py-2.5 text-sm transition-colors flex items-center justify-between gap-4 ${
                option.value === value 
                  ? 'bg-wood-50 text-wood-700 font-semibold' 
                  : 'text-charcoal-700 hover:bg-cream-50 hover:text-wood-600'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <PiCheckLight className="w-4 h-4 text-wood-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
