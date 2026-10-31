import qrcode from '../vendor/qrcode-generator.js';

const tlv = (id: string, value: string): string => {
  const normalized = String(value ?? '');
  const byteLength = new TextEncoder().encode(normalized).length;
  if (byteLength > 99) throw new Error(`VietQR field ${id} is too long`);
  return `${id}${String(byteLength).padStart(2, '0')}${normalized}`;
};

const crc16Ccitt = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

export interface VietQrPayloadInput {
  bankBin: string;
  accountNumber: string;
  amount: number;
  purpose: string;
}

export function buildVietQrPayload({ bankBin, accountNumber, amount, purpose }: VietQrPayloadInput): string {
  const normalizedBank = String(bankBin || '').replace(/\D/g, '');
  const normalizedAccount = String(accountNumber || '').replace(/\s+/g, '');
  const normalizedPurpose = String(purpose || '').trim().replace(/[^A-Za-z0-9._ -]/g, '').slice(0, 50);
  const normalizedAmount = String(Math.max(1, Math.round(Number(amount) || 0)));

  if (!/^\d{6}$/.test(normalizedBank)) throw new Error('Mã BIN ngân hàng không hợp lệ');
  if (!/^[A-Za-z0-9]{4,32}$/.test(normalizedAccount)) throw new Error('Số tài khoản không hợp lệ');
  if (!normalizedPurpose) throw new Error('Nội dung chuyển khoản không hợp lệ');

  const consumer = tlv('00', normalizedBank) + tlv('01', normalizedAccount);
  const provider = tlv('00', 'A000000727') + tlv('01', consumer) + tlv('02', 'QRIBFTTA');
  const additionalData = tlv('08', normalizedPurpose);

  const dataWithoutCrc = [
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('38', provider),
    tlv('53', '704'),
    tlv('54', normalizedAmount),
    tlv('58', 'VN'),
    tlv('62', additionalData),
    '6304',
  ].join('');

  return `${dataWithoutCrc}${crc16Ccitt(dataWithoutCrc)}`;
}

export function createVietQrSvg(input: VietQrPayloadInput): string {
  const payload = buildVietQrPayload(input);
  const qr = qrcode(0, 'M') as any;
  qr.addData(payload, 'Byte');
  qr.make();

  // Generate an SVG data URL instead of the library's GIF data URL.
  // SVG is supported directly by all modern browsers and does not depend on
  // external VietQR image servers, DNS, ad blockers, VPNs or Canvas APIs.
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const size = moduleCount + quietZone * 2;
  const paths: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        paths.push(`M${col + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<path d="${paths.join('')}" fill="black"/>`,
    `</svg>`,
  ].join('');

  return svg;
}

export function createVietQrDataUrl(input: VietQrPayloadInput): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createVietQrSvg(input))}`;
}
