import { expect, request, test, type Page } from '@playwright/test';
import { ADMIN, SEPAY_TEST_KEY, WEB_URL, adminApi, login, openMenu, seedInvoice, seedTenant, unique } from './helpers';

const openPayment = async (page: Page, roomNumber: string) => {
  await openMenu(page, 'Hóa đơn');
  const row = page.locator('tr', { hasText: roomNumber });
  await row.hover();
  await row.getByRole('button', { name: 'Thanh toán' }).click();
};

// SePay is simulated: the request has the same shape as the real webhook.
const sendWebhook = async (key: string, data: Record<string, unknown>) => {
  const bank = await request.newContext({ baseURL: WEB_URL });
  const response = await bank.post('/api/webhooks/sepay', { headers: { Authorization: `Apikey ${key}` }, data });
  await bank.dispose();
  return response.status();
};

test('khách thấy mã VietQR, webhook SePay giả lập làm hóa đơn chuyển sang đã thanh toán', async ({ browser, page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);
  const invoice = await seedInvoice(api, tenant.roomId, tenant.tenantId);

  await login(page, tenant.username, tenant.password);
  await openPayment(page, tenant.roomNumber);

  await expect(page.getByLabel('Mã VietQR thanh toán hóa đơn').locator('svg').or(page.getByAltText('Mã VietQR thanh toán hóa đơn'))).toBeVisible();
  await expect(page.getByText(invoice.ma_hoa_don).first()).toBeVisible();

  expect(await sendWebhook('sai-key', { id: unique('BAD'), transferAmount: 2565000, content: invoice.ma_hoa_don })).toBe(401);
  await expect(page.getByText('Thanh toán thành công!')).toHaveCount(0);

  expect(await sendWebhook(SEPAY_TEST_KEY, { id: unique('OK'), transferAmount: 2565000, content: invoice.ma_hoa_don })).toBe(200);
  await expect(page.getByText('Thanh toán thành công!')).toBeVisible({ timeout: 10_000 });

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN.username, ADMIN.password);
  await openMenu(adminPage, 'Hóa đơn');
  await expect(adminPage.locator('tr', { hasText: tenant.roomNumber }).getByText('Đã thanh toán')).toBeVisible();
  await adminContext.close();
});

test('chuyển thiếu tiền thì hóa đơn chưa được tính là đã thanh toán', async ({ page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);
  const invoice = await seedInvoice(api, tenant.roomId, tenant.tenantId, 1000000);

  await login(page, tenant.username, tenant.password);
  await openPayment(page, tenant.roomNumber);
  expect(await sendWebhook(SEPAY_TEST_KEY, { id: unique('PART'), transferAmount: 400000, content: invoice.ma_hoa_don })).toBe(200);

  await page.waitForTimeout(4000);
  await expect(page.getByText('Thanh toán thành công!')).toHaveCount(0);
  const stored = await (await api.get(`/api/invoices/${invoice.id}`)).json();
  expect(stored.status).toBe('review_needed');
});

test('khách này không xem được hóa đơn của khách khác', async ({ page }) => {
  const api = await adminApi();
  const owner = await seedTenant(api);
  const stranger = await seedTenant(api);
  const invoice = await seedInvoice(api, owner.roomId, owner.tenantId);

  await login(page, stranger.username, stranger.password);
  await openMenu(page, 'Hóa đơn');

  await expect(page.locator('main')).toContainText('Hóa đơn');
  await expect(page.getByText(owner.roomNumber)).toHaveCount(0);
  expect((await page.request.get(`/api/invoices/${invoice.id}`)).status()).toBe(403);
});
