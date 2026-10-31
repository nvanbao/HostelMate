import { describe, expect, test } from 'vitest';
import { buildVietQrPayload } from './vietqr';

const input = { bankBin: '970422', accountNumber: '0123456789', amount: 2565000, purpose: 'HM0000000001' };

// Reads the EMVCo id-length-value format used by VietQR.
const readFields = (payload: string) => {
  const fields: Record<string, string> = {};
  for (let i = 0; i < payload.length;) {
    const length = Number(payload.slice(i + 2, i + 4));
    fields[payload.slice(i, i + 2)] = payload.slice(i + 4, i + 4 + length);
    i += 4 + length;
  }
  return fields;
};

describe('buildVietQrPayload', () => {
  test('encodes the bank, account, amount and transfer content', () => {
    const payload = buildVietQrPayload(input);
    const fields = readFields(payload);

    expect(fields['38']).toContain('970422');
    expect(fields['38']).toContain('0123456789');
    expect(fields['54']).toBe('2565000');
    expect(fields['62']).toContain('HM0000000001');
  });

  test('ends with a 4 character CRC that changes with the content', () => {
    const payload = buildVietQrPayload(input);
    const other = buildVietQrPayload({ ...input, amount: 2565001 });

    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    expect(payload.slice(-4)).not.toBe(other.slice(-4));
  });

  test('rejects invalid bank codes, accounts and empty content', () => {
    expect(() => buildVietQrPayload({ ...input, bankBin: '123' })).toThrow();
    expect(() => buildVietQrPayload({ ...input, accountNumber: '12' })).toThrow();
    expect(() => buildVietQrPayload({ ...input, purpose: '   ' })).toThrow();
  });
});
