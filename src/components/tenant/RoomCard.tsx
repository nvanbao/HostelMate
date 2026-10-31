import { MapPin, Download, PenTool, CreditCard, Wrench, AlertCircle, Crown } from 'lucide-react';

interface RoomCardProps {
  rental: any;
  userFullName: string;
  bgImg: string;
  roomInvoices?: any[];
  roomRepairs?: any[];
  onPay?: (invoice: any) => void;
  onSignContract: (assignmentId: string) => void;
  onDownloadContract: (assignmentId: string) => void;
}

export function RoomCard({ rental, userFullName, bgImg, roomInvoices = [], roomRepairs = [], onPay, onSignContract, onDownloadContract }: RoomCardProps) {
  
  const hasActionItems = roomInvoices.length > 0 || roomRepairs.length > 0;

  return (
    <div className="flex flex-col bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-wood-100/30 overflow-hidden h-full">
      
      {/* Top Image Section (Premium Look) */}
      <div className="relative h-64 shrink-0 group overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/40 to-transparent opacity-90" />
        
        <div className="absolute inset-0 p-6 flex flex-col justify-end">
          <div className="flex items-center justify-between text-white/80 mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              <span className="uppercase tracking-[0.2em] text-[10px] font-bold line-clamp-1" title={rental.room.area}>{rental.room.area}</span>
            </div>
            
            {/* Members List */}
            {rental.members && rental.members.length > 0 && (
              <div className="flex -space-x-2">
                {rental.members.map((m: any) => (
                  <div key={m.id} title={m.ho_ten} className="w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white backdrop-blur-md relative">
                    {m.ho_ten ? m.ho_ten.split(' ').pop().charAt(0).toUpperCase() : '?'}
                    {m.la_nguoi_dai_dien === 1 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-charcoal-900"></span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-4xl font-serif text-white tracking-tight mb-1 flex items-center gap-2">
                P.{rental.room.room_number}
                {rental.chu_hop_dong === userFullName && (
                  <Crown className="w-6 h-6 text-yellow-400" />
                )}
              </h3>
              <p className="text-white/70 text-xs font-light">
                {rental.chu_hop_dong === userFullName ? 'Người đứng tên chính' : `Đại diện: ${rental.chu_hop_dong || '...'}`}
                <span className="block mt-0.5 opacity-80">Tầng {rental.room.tang} • {rental.room.dien_tich}m²</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-serif text-white">{rental.room.gia_phong?.toLocaleString('vi-VN')}₫</p>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-medium">Giá thuê / tháng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Content Section (Specific Room Items) */}
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-50/30">
        
        {/* Contract Actions if needed */}
        {rental.assignment.file_hop_dong && (
          <div className="flex items-center justify-between pb-4 border-b border-wood-100">
            <span className="text-xs uppercase tracking-widest font-semibold text-charcoal-500">Hợp đồng</span>
            {rental.assignment.trang_thai_ky === 'Đã ký' ? (
              <button onClick={() => onDownloadContract(rental.assignment.id)} className="flex items-center gap-1.5 text-xs font-medium text-wood-600 hover:text-wood-800 transition-colors">
                <Download className="w-3.5 h-3.5" /> Tải về
              </button>
            ) : (
              <button onClick={() => onSignContract(rental.assignment.id)} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-wood-500 hover:bg-wood-600 px-4 py-1.5 rounded-full shadow-sm transition-colors">
                <PenTool className="w-3.5 h-3.5" /> Ký HĐ ngay
              </button>
            )}
          </div>
        )}

        {/* Room Specific Invoices & Repairs */}
        {!hasActionItems ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 mt-auto">
            <div className="w-12 h-12 bg-cream-100 rounded-full flex items-center justify-center mb-3 text-wood-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm text-charcoal-500 font-medium">Phòng đang hoạt động tốt</p>
            <p className="text-xs text-charcoal-400 mt-1 font-light">Không có hóa đơn nợ hay sửa chữa.</p>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-3">
            {roomInvoices.map((inv: any) => (
              <div key={inv.id} className="bg-white border border-rose-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">Nợ Hóa Đơn T{inv.invoice_month}</p>
                  <p className="text-lg font-serif text-charcoal-900">{inv.total_amount.toLocaleString('vi-VN')}₫</p>
                </div>
                <button onClick={() => onPay?.(inv)} className="bg-charcoal-900 hover:bg-charcoal-800 text-white p-2.5 rounded-xl shadow-md transition-all">
                  <CreditCard className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {roomRepairs.map((rep: any) => (
              <div key={rep.id} className="bg-white border border-wood-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 bg-cream-100 rounded-xl flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4 text-wood-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-charcoal-900 line-clamp-1">{rep.title}</p>
                  <p className="text-xs text-charcoal-500 mt-0.5 capitalize">{rep.status === 'new' ? 'Mới' : 'Đang xử lý'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
