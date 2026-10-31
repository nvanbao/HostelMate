import { expect, test } from '@playwright/test';
import { ADMIN, chooseOption, formWith, login, openMenu, unique } from './helpers';

test('Admin tạo phòng, thêm người thuê, xếp phòng, cấp tài khoản; khách đăng nhập thấy đúng phòng', async ({ browser, page }) => {
  const roomNumber = unique('A');
  const fullName = `Nguyen Van ${unique('Test')}`;

  await login(page, ADMIN.username, ADMIN.password);

  await test.step('tạo phòng', async () => {
    await openMenu(page, 'Phòng trọ');
    await page.getByRole('button', { name: 'Thêm phòng mới' }).click();
    await page.locator('[name="location"]').fill('123 Nguyễn Văn Linh');
    await page.locator('[name="room_number"]').fill(roomNumber);
    await page.locator('[name="floor"]').fill('2');
    await page.locator('[name="area_sqm"]').fill('25');
    await page.locator('[name="monthly_rent"]').fill('2500000');
    await page.locator('[name="max_occupants"]').fill('2');
    await formWith(page, 'room_number').locator('button[type="submit"]').click();
    await expect(page.getByText(roomNumber).first()).toBeVisible();
  });

  await test.step('thêm người thuê', async () => {
    await openMenu(page, 'Người thuê');
    await page.getByRole('button', { name: 'Thêm người thuê' }).click();
    await page.locator('[name="full_name"]').fill(fullName);
    await page.locator('[name="phone"]').fill('987654321');
    await page.locator('[name="email"]').fill(`${roomNumber.toLowerCase()}@example.com`);
    await page.locator('[name="id_card_number"]').fill('012345678901');
    await formWith(page, 'full_name').locator('button[type="submit"]').click();
    await expect(page.getByText(fullName).first()).toBeVisible();
  });

  await test.step('xếp phòng', async () => {
    const row = page.locator('tr', { hasText: fullName });
    await row.hover();
    await row.getByTitle('Gán phòng').click();
    await chooseOption(page, 'Chọn phòng', new RegExp(`Phòng ${roomNumber} `));
    await page.locator('[name="start_date"]').fill('2026-10-01');
    await page.locator('[name="deposit_amount"]').fill('1000000');
    await page.locator('[name="contract_end_date"]').fill('2027-10-01');
    await formWith(page, 'deposit_amount').locator('button[type="submit"]').click();
    await expect(page.locator('tr', { hasText: fullName }).getByText(roomNumber).first()).toBeVisible();
  });

  let username = '';
  let password = '';
  await test.step('cấp tài khoản và chỉ thấy mật khẩu sau khi cấp', async () => {
    await openMenu(page, 'Tài khoản');
    const row = page.locator('tr', { hasText: fullName });
    await row.hover();
    await row.getByTitle('Cấp tài khoản').click();
    await expect(row.getByText('Đã cấp TK')).toBeVisible();

    const passwordCell = row.locator('.group\\/pass');
    await expect(passwordCell.locator('span')).toHaveText('********');
    await passwordCell.hover();
    await passwordCell.getByRole('button').click();
    password = (await passwordCell.locator('span').innerText()).trim();
    expect(password).toHaveLength(12);
    username = (await row.locator('td').nth(3).locator('span').first().innerText()).trim();

    await page.reload();
    await openMenu(page, 'Tài khoản');
    const reloaded = page.locator('tr', { hasText: fullName }).locator('.group\\/pass');
    await expect(reloaded.locator('span')).toHaveText('********');
    await expect(reloaded.getByRole('button')).toHaveCount(0);
  });

  await test.step('khách thuê đăng nhập thấy phòng được xếp', async () => {
    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();
    await login(tenantPage, username, password);
    await expect(tenantPage.getByText(fullName).first()).toBeVisible();
    await expect(tenantPage.getByText(roomNumber).first()).toBeVisible();
    await tenantContext.close();
  });
});
