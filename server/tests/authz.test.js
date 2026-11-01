import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady, queryOne, run } from '../db.js';

const login = async (username, password) => {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  return response.headers['set-cookie']?.[0];
};

describe('API authorization and password handling', () => {
  let adminCookie;
  let aliceCookie;
  let bobCookie;
  let alice;
  let bob;
  let roomId;
  let aliceContractId;
  let aliceInvoiceId;

  const createTenantWithRoom = async (name, username, roomNumber) => {
    const room = await request(app).post('/api/rooms').set('Cookie', adminCookie)
      .send({ room_number: roomNumber, max_occupants: 2 });
    const tenant = await request(app).post('/api/tenants').set('Cookie', adminCookie)
      .send({ full_name: name, id_card_number: `CCCD-${username}` });
    const assignment = await request(app).post('/api/room_assignments').set('Cookie', adminCookie)
      .send({ room_id: room.body.id, tenant_id: tenant.body.id, start_date: '2026-07-01', deposit_amount: 0 });
    const credentials = await request(app).post(`/api/tenants/${tenant.body.id}/credentials`).set('Cookie', adminCookie)
      .send({ username });
    return { tenant: credentials.body, roomId: room.body.id, contractId: assignment.body.id };
  };

  beforeAll(async () => {
    process.env.SEPAY_WEBHOOK_API_KEY = 'test-webhook-key';
    await dbReady;
    adminCookie = await login('admin', '123456');

    const first = await createTenantWithRoom('Alice', 'alice', 'A1');
    const second = await createTenantWithRoom('Bob', 'bob', 'B1');
    alice = first.tenant;
    bob = second.tenant;
    roomId = first.roomId;
    aliceContractId = first.contractId;
    aliceCookie = await login('alice', alice.temporary_password);
    bobCookie = await login('bob', bob.temporary_password);

    const invoice = await request(app).post('/api/invoices').set('Cookie', adminCookie).send({
      room_id: roomId, tenant_id: alice.id, invoice_month: 7, invoice_year: 2026, room_rent: 100, total_amount: 100,
    });
    aliceInvoiceId = invoice.body.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test.each([
    ['get', '/api/rooms'],
    ['post', '/api/rooms'],
    ['get', '/api/tenants'],
    ['put', '/api/tenants/any'],
    ['post', '/api/tenants/any/credentials'],
    ['get', '/api/meter_readings'],
    ['get', '/api/invoices'],
    ['get', '/api/invoices/export'],
    ['put', '/api/invoices/any/paid'],
    ['delete', '/api/invoices/any'],
    ['get', '/api/repair_requests'],
    ['post', '/api/contracts/any/sign'],
    ['get', '/api/contracts/any/download'],
    ['get', '/api/tenant/portal'],
    ['post', '/api/ai/chat'],
  ])('%s %s requires login', async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
  });

  test.each([
    ['get', '/api/rooms'],
    ['get', '/api/tenants'],
    ['post', '/api/tenants'],
    ['get', '/api/invoices/export'],
    ['post', '/api/invoices'],
    ['delete', '/api/repair_requests/any'],
    ['post', '/api/room_assignments'],
  ])('%s %s is admin only', async (method, path) => {
    const response = await request(app)[method](path).set('Cookie', aliceCookie);
    expect(response.status).toBe(403);
  });

  test('a tenant cannot mark an invoice as paid or take over another account', async () => {
    const paid = await request(app).put(`/api/invoices/${aliceInvoiceId}/paid`).set('Cookie', aliceCookie);
    expect(paid.status).toBe(403);

    const takeover = await request(app).put(`/api/tenants/${alice.id}`).set('Cookie', bobCookie).send({ password: 'hacked' });
    expect(takeover.status).toBe(403);
  });

  test('tenant data is scoped to the signed-in tenant', async () => {
    const own = await request(app).get('/api/invoices').set('Cookie', aliceCookie);
    expect(own.body.map((invoice) => invoice.id)).toEqual([aliceInvoiceId]);

    // The tenant_id parameter must not widen what a tenant can see.
    const other = await request(app).get(`/api/invoices?tenant_id=${alice.id}`).set('Cookie', bobCookie);
    expect(other.body).toEqual([]);

    const detail = await request(app).get(`/api/invoices/${aliceInvoiceId}`).set('Cookie', bobCookie);
    expect(detail.status).toBe(403);

    const portal = await request(app).get(`/api/tenant/portal?tenant_id=${alice.id}`).set('Cookie', bobCookie);
    expect(portal.body.rentals.map((rental) => rental.assignment.khach_thue_id)).toEqual([bob.id]);
  });

  test('roommates see shared invoices without personal details', async () => {
    const carol = await request(app).post('/api/tenants').set('Cookie', adminCookie).send({ full_name: 'Carol' });
    await request(app).post('/api/room_assignments').set('Cookie', adminCookie)
      .send({ room_id: roomId, tenant_id: carol.body.id, start_date: '2026-07-01', deposit_amount: 0 });
    const issued = await request(app).post(`/api/tenants/${carol.body.id}/credentials`).set('Cookie', adminCookie).send({ username: 'carol' });
    const carolCookie = await login('carol', issued.body.temporary_password);

    const invoice = await request(app).get(`/api/invoices/${aliceInvoiceId}`).set('Cookie', carolCookie);
    expect(invoice.status).toBe(200);
    expect(invoice.body.tenant).toEqual({ id: alice.id, full_name: 'Alice' });
  });

  test('only the contract tenant can sign and download it', async () => {
    const signature = { signatureBase64: 'data:image/png;base64,AAAA' };
    const stranger = await request(app).post(`/api/contracts/${aliceContractId}/sign`).set('Cookie', bobCookie).send(signature);
    expect(stranger.status).toBe(403);
    const admin = await request(app).post(`/api/contracts/${aliceContractId}/sign`).set('Cookie', adminCookie).send(signature);
    expect(admin.status).toBe(403);

    const download = await request(app).get(`/api/contracts/${aliceContractId}/download`).set('Cookie', bobCookie);
    expect(download.status).toBe(403);
  });

  test('passwords are hashed and never returned by the API', async () => {
    const stored = await queryOne('SELECT password FROM khach_thue WHERE id = ?', [alice.id]);
    expect(stored.password).toMatch(/^\$2/);

    const listed = await request(app).get('/api/tenants').set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    listed.body.forEach((tenant) => expect(tenant).not.toHaveProperty('password'));

    const updated = await request(app).put(`/api/tenants/${bob.id}`).set('Cookie', adminCookie).send({ password: 'new-password' });
    expect(updated.body).not.toHaveProperty('password');
    const hashed = await queryOne('SELECT password FROM khach_thue WHERE id = ?', [bob.id]);
    expect(hashed.password).toMatch(/^\$2/);

    const admin = await queryOne("SELECT password_hash FROM users WHERE username = 'admin'");
    expect(admin.password_hash).toMatch(/^\$2/);
  });

  test('a plain text value in the database no longer works as a password', async () => {
    await run("UPDATE khach_thue SET password = 'plain-text' WHERE id = ?", [bob.id]);
    const response = await request(app).post('/api/auth/login').send({ username: 'bob', password: 'plain-text' });
    expect(response.status).toBe(401);
  });

  test('locked accounts cannot log in and lose their session', async () => {
    const reset = await request(app).post(`/api/tenants/${alice.id}/credentials`).set('Cookie', adminCookie).send({});
    expect(reset.body.username).toBe('alice');
    expect(reset.body.temporary_password).not.toBe(alice.temporary_password);

    await request(app).put(`/api/tenants/${alice.id}`).set('Cookie', adminCookie).send({ is_locked: true });
    const session = await request(app).get('/api/auth/me').set('Cookie', aliceCookie);
    expect(session.status).toBe(401);
    const blocked = await request(app).post('/api/auth/login').send({ username: 'alice', password: reset.body.temporary_password });
    expect(blocked.status).toBe(403);
  });

  test('duplicate usernames are rejected when issuing credentials', async () => {
    const response = await request(app).post(`/api/tenants/${alice.id}/credentials`).set('Cookie', adminCookie).send({ username: 'bob' });
    expect(response.status).toBe(400);
  });

  test('the SePay webhook rejects missing keys and refuses to run unconfigured', async () => {
    const payload = { id: 'AUTHZ-1', transferType: 'in', transferAmount: 100, content: 'HM0' };
    const noKey = await request(app).post('/api/webhooks/sepay').send(payload);
    expect(noKey.status).toBe(401);

    delete process.env.SEPAY_WEBHOOK_API_KEY;
    const unconfigured = await request(app).post('/api/webhooks/sepay').send(payload);
    expect(unconfigured.status).toBe(503);
    process.env.SEPAY_WEBHOOK_API_KEY = 'test-webhook-key';
  });

  test('repeated failed logins are rate limited', async () => {
    let status;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
      status = response.status;
    }
    expect(status).toBe(429);
  });
});
