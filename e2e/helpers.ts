import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

export const WEB_URL = 'http://localhost:5198';
export const SEPAY_TEST_KEY = 'e2e-webhook-key';
export const ADMIN = { username: 'admin', password: '123456' };

let counter = 0;
export const unique = (prefix: string) => `${prefix}${Date.now().toString().slice(-6)}${counter++}`;

export async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('Ví dụ: admin, user@hostelmate.com').fill(username);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

export async function openMenu(page: Page, name: string) {
  await page.locator('aside').getByText(name, { exact: true }).click();
}

// The admin form uses a custom dropdown instead of a native <select>.
export async function chooseOption(page: Page, label: string, option: string | RegExp) {
  const field = page.locator('div.space-y-1\\.5', { has: page.locator('label', { hasText: label }) });
  await field.locator('.cursor-pointer').first().click();
  await field.locator('.cursor-pointer', { hasText: option }).last().click();
}

export const formWith = (page: Page, fieldName: string) => page.locator('form', { has: page.locator(`[name="${fieldName}"]`) });

const json = async (response: Awaited<ReturnType<APIRequestContext['post']>>) => {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
};

export async function adminApi() {
  const api = await request.newContext({ baseURL: WEB_URL });
  await json(await api.post('/api/auth/login', { data: ADMIN }));
  return api;
}

// Faster than clicking through the admin pages, for tests about what happens afterwards.
export async function seedTenant(api: APIRequestContext) {
  const roomNumber = unique('R');
  const username = unique('tenant').toLowerCase();
  const room = await json(await api.post('/api/rooms', {
    data: { room_number: roomNumber, floor: 1, area_sqm: 25, monthly_rent: 2500000, max_occupants: 2, location: 'Khu E2E' },
  }));
  const tenant = await json(await api.post('/api/tenants', {
    data: { full_name: `Khách ${username}`, phone: '0900000000', email: `${username}@example.com` },
  }));
  const assignment = await json(await api.post('/api/room_assignments', {
    data: { room_id: room.id, tenant_id: tenant.id, start_date: '2026-10-01', contract_end_date: '2027-10-01', deposit_amount: 1000000, is_primary: true },
  }));
  const credentials = await json(await api.post(`/api/tenants/${tenant.id}/credentials`, { data: { username } }));
  return {
    roomId: room.id as string,
    roomNumber,
    tenantId: tenant.id as string,
    tenantName: tenant.full_name as string,
    assignmentId: assignment.id as string,
    username,
    password: credentials.temporary_password as string,
  };
}

export async function seedInvoice(api: APIRequestContext, roomId: string, tenantId: string, total = 2565000) {
  return json(await api.post('/api/invoices', {
    data: {
      room_id: roomId,
      tenant_id: tenantId,
      invoice_month: 10,
      invoice_year: 2026,
      room_rent: total,
      total_amount: total,
      due_date: '2099-12-31',
    },
  }));
}
