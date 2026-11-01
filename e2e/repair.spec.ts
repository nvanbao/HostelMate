import { expect, test } from '@playwright/test';
import { ADMIN, adminApi, chooseOption, login, openMenu, seedTenant, unique } from './helpers';

test('khách gửi yêu cầu, Admin thấy ngay không cần tải lại, xử lý xong và khách xác nhận', async ({ browser, page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);
  const title = unique('Hỏng máy lạnh ');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN.username, ADMIN.password);
  await openMenu(adminPage, 'Sửa chữa');
  await expect(adminPage.getByText(title)).toHaveCount(0);

  await login(page, tenant.username, tenant.password);
  await openMenu(page, 'Sửa chữa');

  await test.step('khách thuê gửi yêu cầu', async () => {
    await page.getByRole('button', { name: 'Tạo yêu cầu' }).first().click();
    await page.locator('[name="title"]').fill(title);
    await page.locator('textarea[name="description"]').fill('Máy lạnh không lạnh từ sáng nay');
    await page.getByRole('button', { name: 'Lưu yêu cầu' }).click();
    await expect(page.getByText(title)).toBeVisible();
  });

  await test.step('Admin nhận qua Socket.IO và xử lý', async () => {
    const row = adminPage.locator('tr', { hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.hover();
    await row.getByTitle('Cập nhật xử lý').click();
    await chooseOption(adminPage, 'Trạng thái xử lý', 'Đã hoàn thành');
    await adminPage.locator('[name="assigned_to"]').fill('Kỹ thuật viên A');
    await adminPage.getByRole('button', { name: 'Lưu cập nhật' }).click();
    await expect(adminPage.getByRole('button', { name: 'Lưu cập nhật' })).toHaveCount(0);
    const stored = await (await api.get('/api/repair_requests')).json();
    expect(stored.find((item: { title: string }) => item.title === title).status).toBe('resolved');
  });

  await test.step('khách thuê xác nhận đã xong', async () => {
    await page.reload();
    await openMenu(page, 'Sửa chữa');
    const row = page.locator('tr', { hasText: title });
    await row.getByTitle('Xem chi tiết').click();
    await page.getByRole('button', { name: 'Xác nhận đã xong' }).click();
    await expect(page.locator('tr', { hasText: title }).getByText('Đã đóng')).toBeVisible();
  });

  await adminContext.close();
});

test('khách ký hợp đồng bằng chữ ký tay và tải được PDF', async ({ page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await login(page, tenant.username, tenant.password);

  await page.getByRole('button', { name: 'Ký HĐ ngay' }).click();

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Không thấy khung ký');
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 70, { steps: 8 });
  await page.mouse.move(box.x + 220, box.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: /^Xác nhận/ }).click();

  await expect.poll(() => dialogs).toContain('Ký hợp đồng thành công!');
  await expect(page.getByRole('button', { name: 'Tải về' })).toBeVisible();
  const contract = await page.request.get(`/api/contracts/${tenant.assignmentId}/download`);
  expect(contract.status()).toBe(200);
  expect(contract.headers()['content-type']).toContain('application/pdf');
  const portal = await (await page.request.get('/api/tenant/portal')).json();
  expect(portal.rentals[0].assignment.trang_thai_ky).toBe('Đã ký');
});
