import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Loader2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { getInvoice, getSettings } from '../lib/api';
import { createVietQrSvg } from '../lib/vietqr';
import type { Invoice } from '../types';

interface PaymentSettings {
  bank_id?: string;
  bank_account_no?: string;
  bank_account_name?: string;
  vietqr_template?: string;
  payment_prefix?: string;
}

export function MockPaymentGateway({ invoiceId, amount, onBack }: { invoiceId: string; amount: number; onBack: () => void }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<PaymentSettings>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [qrSourceIndex, setQrSourceIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const paymentContent = useMemo(() => {
    const prefix = String(settings.payment_prefix || 'HM').trim().toUpperCase() || 'HM';
    const storedCode = String(invoice?.ma_hoa_don || '').trim().toUpperCase();
    if (storedCode) return storedCode.startsWith(prefix) ? storedCode : `${prefix}${storedCode}`;

    // Backward compatibility for invoices created by older database versions
    // that did not yet have ma_hoa_don. The backend also persists this code.
    const idDigits = String(invoice?.id || invoiceId).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `${prefix}${idDigits.slice(-10).padStart(10, '0')}`;
  }, [invoice?.ma_hoa_don, invoice?.id, invoiceId, settings.payment_prefix]);

  const localQrSvg = useMemo(() => {
    if (!settings.bank_id || !settings.bank_account_no || !paymentContent) return '';
    try {
      return createVietQrSvg({
        bankBin: settings.bank_id,
        accountNumber: settings.bank_account_no,
        amount: Number(amount),
        purpose: paymentContent,
      });
    } catch (error) {
      console.error('Failed to generate VietQR locally:', error);
      setLoadError((prev) => prev || `Không tạo được mã QR: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }, [settings.bank_id, settings.bank_account_no, paymentContent, amount]);

  const qrSources = useMemo(() => {
    if (!settings.bank_id || !settings.bank_account_no || !paymentContent) return [];
    const template = settings.vietqr_template || 'compact2';
    const roundedAmount = String(Math.max(0, Math.round(Number(amount) || 0)));
    const params = new URLSearchParams({ amount: roundedAmount, addInfo: paymentContent });
    if (settings.bank_account_name) params.set('accountName', settings.bank_account_name);

    const apiBase = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    const proxyParams = new URLSearchParams({ amount: roundedAmount, content: paymentContent });
    const bankAlias = settings.bank_id === '970422' ? 'MB' : settings.bank_id;
    return [
      `${apiBase}/public/vietqr-image?${proxyParams.toString()}`,
      `https://img.vietqr.io/image/${encodeURIComponent(settings.bank_id)}-${encodeURIComponent(settings.bank_account_no)}-${encodeURIComponent(template)}.jpg?${params.toString()}`,
      `https://img.vietqr.io/image/${encodeURIComponent(bankAlias)}-${encodeURIComponent(settings.bank_account_no)}-${encodeURIComponent(template)}.jpg?${params.toString()}`,
    ];
  }, [settings, paymentContent, amount]);

  const qrSourceKey = qrSources.join('|');
  const qrUrl = qrSources[qrSourceIndex] || null;
  const hasQr = Boolean(localQrSvg || (qrUrl && !qrLoadFailed));

  useEffect(() => {
    setQrSourceIndex(0);
    setQrLoadFailed(false);
  }, [qrSourceKey]);

  const refreshInvoice = async (showMessage = false) => {
    try {
      const data = await getInvoice(invoiceId);
      setInvoice(data);
      if (showMessage && data?.status !== 'paid') {
        setStatusMessage('Chưa nhận được xác nhận từ SePay. Hệ thống vẫn đang tự động kiểm tra.');
      }
    } catch (error) {
      console.error('Failed to refresh invoice:', error);
      if (showMessage) setStatusMessage('Không thể kiểm tra trạng thái lúc này. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      // Use allSettled instead of all: if one call fails (e.g. a transient
      // network hiccup on the invoice fetch), we still want to apply the
      // settings that DID load successfully, and vice versa. With Promise.all
      // a single rejection wiped out both results and made the QR silently
      // fail to render with no clear cause.
      const [invoiceResult, settingsResult] = await Promise.allSettled([
        getInvoice(invoiceId),
        getSettings(),
      ]);
      if (!mounted) return;

      const errors: string[] = [];

      if (invoiceResult.status === 'fulfilled') {
        setInvoice(invoiceResult.value);
      } else {
        console.error('Failed to load invoice:', invoiceResult.reason);
        errors.push('Không tải được thông tin hóa đơn.');
      }

      if (settingsResult.status === 'fulfilled') {
        const paymentSettings = settingsResult.value as PaymentSettings;
        setSettings(paymentSettings);
        if (!paymentSettings.bank_id || !paymentSettings.bank_account_no) {
          errors.push('Chủ trọ chưa cấu hình tài khoản ngân hàng (bank_id / bank_account_no) trong Cài đặt.');
        }
      } else {
        console.error('Failed to load settings:', settingsResult.reason);
        errors.push('Không tải được cấu hình thanh toán. Kiểm tra máy chủ API (server) đã chạy chưa và bạn đã đăng nhập chưa.');
      }

      setLoadError(errors.join(' '));
      setLoading(false);
    }

    loadData();
    const intervalId = window.setInterval(() => refreshInvoice(false), 3000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [invoiceId]);

  useEffect(() => {
    if (invoice?.status !== 'paid') return;
    const timer = window.setTimeout(onBack, 3000);
    return () => window.clearTimeout(timer);
  }, [invoice?.status, onBack]);

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStatusMessage(`Đã sao chép nội dung chuyển khoản: ${text}`);
  };

  const handleCheckPayment = async () => {
    setChecking(true);
    setStatusMessage('');
    await refreshInvoice(true);
    setChecking(false);
  };

  const pageShell = 'fixed inset-y-0 right-0 left-72 bg-white z-50 flex flex-col items-center justify-center p-6 text-center';

  if (loading) {
    return (
      <div className={pageShell}>
        <Loader2 className="w-12 h-12 text-wood-600 animate-spin mb-4" />
        <p className="text-charcoal-600">Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  if (invoice?.status === 'paid') {
    return (
      <div className={`${pageShell} animate-in fade-in zoom-in duration-500`}>
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-charcoal-900 mb-2">Thanh toán thành công!</h2>
        <p className="text-charcoal-600 mb-8 max-w-md text-lg">
          Hóa đơn {invoice.ma_hoa_don} đã được SePay xác nhận tự động.
        </p>
        <Button onClick={onBack} size="lg" className="w-full max-w-sm">Quay lại danh sách hóa đơn</Button>
      </div>
    );
  }

  if (invoice?.status === 'waiting_confirmation') {
    return (
      <div className={`${pageShell} animate-in fade-in zoom-in duration-500`}>
        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-12 h-12 text-yellow-600" />
        </div>
        <h2 className="text-3xl font-bold text-charcoal-900 mb-2">Đang chờ xác nhận</h2>
        <p className="text-charcoal-600 mb-8 max-w-md text-lg">Hệ thống đang chờ giao dịch tương ứng với mã {paymentContent || invoice.ma_hoa_don}.</p>
        <Button onClick={onBack} size="lg" className="w-full max-w-sm">Quay lại danh sách hóa đơn</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 left-72 bg-charcoal-50 z-50 overflow-y-auto">
      <div className="bg-white sticky top-0 z-10 px-6 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-charcoal-50 transition-colors" aria-label="Quay lại">
          <ArrowLeft className="w-6 h-6 text-charcoal-700" />
        </button>
        <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Thanh toán VietQR</h1>
      </div>

      <div className="max-w-md mx-auto p-4 pb-24">
        <div className="bg-gradient-to-br from-wood-600 to-wood-800 rounded-2xl p-6 text-white text-center shadow-lg mb-6">
          <p className="text-wood-100 mb-2">Tổng số tiền cần thanh toán</p>
          <p className="text-4xl font-bold">{Number(amount || 0).toLocaleString('vi-VN')} đ</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm items-center gap-4">
            <span>Nội dung:</span>
            <span className="font-mono font-bold bg-white/20 px-2 py-1 rounded select-all break-all">{paymentContent}</span>
          </div>
        </div>

        {hasQr ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-charcoal-100 flex flex-col items-center mb-6 text-center">
            <h3 className="font-semibold text-charcoal-900 mb-2">Quét mã để thanh toán</h3>
            <p className="text-sm text-charcoal-500 mb-5">Dùng ứng dụng ngân hàng để quét mã VietQR (mã được tạo trực tiếp trên máy)</p>

            <div className="bg-white p-2 rounded-xl shadow-md border border-charcoal-100 mb-5 w-full max-w-[300px] aspect-square flex items-center justify-center">
              {localQrSvg ? (
                <div
                  aria-label="Mã VietQR thanh toán hóa đơn"
                  className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: localQrSvg }}
                />
              ) : (
                <img
                  src={qrUrl || ''}
                  alt="Mã VietQR thanh toán hóa đơn"
                  className="w-full h-full object-contain rounded-lg"
                  onLoad={() => setQrLoadFailed(false)}
                  onError={() => {
                    if (qrSourceIndex < qrSources.length - 1) {
                      setQrSourceIndex((current) => current + 1);
                    } else {
                      setQrLoadFailed(true);
                    }
                  }}
                />
              )}
            </div>

            <div className="w-full grid gap-3 text-left mb-5">
              <div className="bg-charcoal-50 p-3 rounded-xl border border-charcoal-100">
                <span className="block text-xs text-charcoal-400 font-medium uppercase tracking-wide">Tài khoản nhận</span>
                <span className="font-semibold text-charcoal-900">{settings.bank_account_no}</span>
              </div>
              <div className="bg-charcoal-50 p-3 rounded-xl border border-charcoal-100">
                <span className="block text-xs text-charcoal-400 font-medium uppercase tracking-wide">Chủ tài khoản</span>
                <span className="font-semibold text-charcoal-900">{settings.bank_account_name}</span>
              </div>
              <div className="flex justify-between items-center bg-charcoal-50 p-3 rounded-xl border border-charcoal-100">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-charcoal-400 font-medium uppercase tracking-wide">Nội dung chuyển khoản</span>
                  <span className="font-bold text-charcoal-900 font-mono text-base break-all">{paymentContent}</span>
                </div>
                <button onClick={() => copyToClipboard(paymentContent)} className="p-2 bg-white text-wood-600 hover:bg-wood-50 rounded-lg transition-colors border border-charcoal-100 shadow-sm" aria-label="Sao chép nội dung">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-wood-700 bg-wood-50 px-4 py-3 rounded-xl w-full justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Đang chờ SePay xác nhận tự động...</span>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 rounded-2xl p-6 text-center border border-rose-100 mb-6 flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-3" />
            <p className="text-rose-600 font-medium mb-2">Không thể hiển thị mã VietQR</p>
            <p className="text-sm text-rose-500 mb-3">
              {loadError || 'Thiếu thông tin tài khoản ngân hàng hoặc nội dung chuyển khoản để tạo mã QR.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-rose-700 underline underline-offset-2 hover:text-rose-800"
            >
              Tải lại trang
            </button>
          </div>
        )}

        <Button onClick={handleCheckPayment} disabled={checking || !hasQr} className="w-full mb-4 justify-center" size="lg">
          {checking ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />}
          {checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái thanh toán'}
        </Button>

        {statusMessage && <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl text-sm mb-4 border border-amber-100">{statusMessage}</div>}

        <div className="bg-blue-50 text-blue-700 p-5 rounded-2xl text-sm leading-relaxed mb-6 border border-blue-100 shadow-sm">
          <p className="font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Lưu ý quan trọng:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Không sửa số tiền và nội dung chuyển khoản đã điền sẵn.</li>
            <li>Nội dung phải đúng mã <strong>{paymentContent}</strong> để hệ thống nhận diện hóa đơn.</li>
            <li>Sau khi giao dịch vào tài khoản, SePay gửi webhook và màn hình tự cập nhật trong vài giây.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
