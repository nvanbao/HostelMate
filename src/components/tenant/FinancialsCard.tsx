import { CreditCard, FileText } from 'lucide-react';

export function FinancialsCard({ unpaidInvoices, totalUnpaid, onPay }: any) {
  return (
    <div className="bg-wood-500 rounded-3xl p-5 text-white shadow-lg flex flex-col justify-between h-40">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-wood-200 mb-1">Cần thanh toán</p>
        <p className="text-3xl font-serif tracking-tight">{totalUnpaid.toLocaleString('vi-VN')}₫</p>
      </div>
      
      {unpaidInvoices.length > 0 ? (
        <button 
          onClick={() => onPay(unpaidInvoices[0])}
          className="w-full bg-white text-wood-900 hover:bg-wood-50 rounded-2xl py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-3.5 h-3.5" /> TT Hóa đơn cũ nhất
        </button>
      ) : (
        <div className="flex items-center gap-2 text-wood-200 text-xs font-light">
          <FileText className="w-3.5 h-3.5" /> Đã đóng đủ
        </div>
      )}
    </div>
  );
}
