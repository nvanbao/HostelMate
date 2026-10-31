import { Wrench } from 'lucide-react';

export function MaintenanceCard({ repairSummary, onNavigate }: any) {
  return (
    <div className="bg-cream-100 rounded-3xl p-5 border border-wood-100/50 shadow-sm flex flex-col justify-between h-40 cursor-pointer hover:bg-cream-200 transition-colors" onClick={onNavigate}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-charcoal-500 mb-1">Sửa chữa</p>
        <p className="text-3xl font-serif text-charcoal-900 tracking-tight">{repairSummary.active}</p>
        <p className="text-xs text-charcoal-400 mt-1 font-light">Đang xử lý</p>
      </div>
      
      <div className="flex items-center justify-between text-wood-600">
        <span className="text-[10px] font-semibold uppercase tracking-wider">Tạo yêu cầu</span>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
          <Wrench className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
