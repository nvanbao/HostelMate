import React from 'react';

interface PageSizeSelectorProps {
  limit: number;
  onLimitChange: (limit: number) => void;
  options?: number[];
}

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  limit,
  onLimitChange,
  options = [10, 20, 50, 100]
}) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">Hiển thị</span>
      <select
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        className="block w-full rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-500">dòng</span>
    </div>
  );
};
