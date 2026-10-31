import { expect, test } from '@playwright/test';
import { ADMIN, adminApi, login, seedTenant } from './helpers';

test('sai mật khẩu thì báo lỗi và ở lại trang đăng nhập', async ({ page }) => {
  await login(page, ADMIN.username, 'sai-mat-khau');

  await expect(page.getByText('Sai tài khoản hoặc mật khẩu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
});

test('Admin đăng nhập, tải lại vẫn giữ phiên, đăng xuất thì về trang đăng nhập', async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.password);
  const menu = page.locator('aside');
  await expect(menu.getByText('Phòng trọ', { exact: true })).toBeVisible();

  await page.reload();
  await expect(menu.getByText('Phòng trọ', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
});

test('khách thuê không thấy menu quản lý và bị API của Admin từ chối', async ({ page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);

  await login(page, tenant.username, tenant.password);
  const menu = page.locator('aside');
  await expect(menu.getByText('Hóa đơn', { exact: true })).toBeVisible();
  await expect(menu.getByText('Phòng trọ', { exact: true })).toHaveCount(0);
  await expect(menu.getByText('Người thuê', { exact: true })).toHaveCount(0);

  const tenants = await page.request.get('/api/tenants');
  expect(tenants.status()).toBe(403);
});

test('tài khoản bị khóa không đăng nhập được', async ({ page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);
  await api.put(`/api/tenants/${tenant.tenantId}`, { data: { is_locked: true } });

  await login(page, tenant.username, tenant.password);

  await expect(page.getByText('Tài khoản đã bị khóa')).toBeVisible();
});
