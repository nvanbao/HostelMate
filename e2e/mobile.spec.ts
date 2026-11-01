import { expect, test, type Page } from '@playwright/test';
import { ADMIN, adminApi, login, seedInvoice, seedTenant } from './helpers';

test.use({ viewport: { width: 375, height: 812 } });

// Reports the widest offenders, because a bare scrollWidth does not say what to fix.
const expectNoPageOverflow = async (page: Page, name = '') => {
  const offenders = await page.evaluate(() => {
    const isClipped = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(parent).overflowX)) return true;
      }
      return false;
    };
    return [...document.querySelectorAll('main *')]
      .filter((element) => element.getBoundingClientRect().right > 376 && !isClipped(element))
      .slice(0, 4)
      .map((element) => `${element.tagName} ${element.className}`.slice(0, 120));
  });
  expect.soft(offenders, `Tràn ngang ở trang ${name}`).toEqual([]);
};

const openFromMenu = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.locator('aside').getByText(name, { exact: true }).click();
  await expect(page.locator('aside')).not.toBeInViewport();
};

test('khách thuê dùng được trên điện thoại', async ({ page }) => {
  const api = await adminApi();
  const tenant = await seedTenant(api);
  await seedInvoice(api, tenant.roomId, tenant.tenantId);

  await login(page, tenant.username, tenant.password);
  await expect(page.getByText(tenant.roomNumber).first()).toBeVisible();
  await expect(page.locator('aside')).not.toBeInViewport();
  await expectNoPageOverflow(page);

  await openFromMenu(page, 'Hóa đơn');
  await expect(page.getByRole('heading', { name: 'Hóa đơn' })).toBeVisible();
  await expectNoPageOverflow(page);

  await openFromMenu(page, 'Sửa chữa');
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu' }).first()).toBeVisible();
  await expectNoPageOverflow(page);
});

test('Admin mở được các trang quản lý trên điện thoại', async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.password);
  await expect(page.getByRole('button', { name: 'Mở menu' })).toBeVisible();

  for (const name of ['Phòng trọ', 'Người thuê', 'Tài khoản', 'Điện nước', 'Hóa đơn', 'Sửa chữa']) {
    await openFromMenu(page, name);
    await expectNoPageOverflow(page, name);
  }
});
