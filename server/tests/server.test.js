import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady } from '../db.js';

let adminCookie = '';
let tenantCookie = '';
let roomId = '';
let tenantId = '';
let assignmentId = '';
let invoiceId = '';
let invoiceCode = '';

describe('HostelMate API', () => {
  beforeAll(async () => {
    process.env.SEPAY_WEBHOOK_API_KEY = 'test-webhook-key';
    await dbReady;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('starts with an empty database and the default admin account', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.database).toMatchObject({
      phong: 0,
      khach_thue: 0,
      hop_dong_thue: 0,
      hoa_don: 0,
      yeu_cau_sua_chua: 0,
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: '123456' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('ADMIN');
    adminCookie = login.headers['set-cookie'][0];
  });

  test('admin can create a room, tenant, assignment and tenant account', async () => {
    const room = await request(app).post('/api/rooms').set('Cookie', adminCookie).send({
      room_number: 'T101',
      floor: 1,
      area_sqm: 25,
      monthly_rent: 2500000,
      max_occupants: 2,
      location: 'Khu A',
    });
    expect(room.status).toBe(201);
    roomId = room.body.id;

    const tenant = await request(app).post('/api/tenants').set('Cookie', adminCookie).send({
      full_name: 'Khách thuê Test',
      phone: '0900000000',
      email: 'tenant@test.local',
    });
    expect(tenant.status).toBe(201);
    tenantId = tenant.body.id;

    const assignment = await request(app).post('/api/room_assignments').set('Cookie', adminCookie).send({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: '2026-07-01',
      contract_end_date: '2027-07-01',
      deposit_amount: 2500000,
      is_primary: true,
    });
    expect(assignment.status).toBe(201);
    assignmentId = assignment.body.id;

    const account = await request(app).put(`/api/tenants/${tenantId}`).set('Cookie', adminCookie).send({
      username: 'tenanttest',
      password: '654321',
    });
    expect(account.status).toBe(200);
    expect(account.body.username).toBe('tenanttest');
  });

  test('tenant can log in and see the assigned room', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tenanttest', password: '654321' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('TENANT');
    tenantCookie = login.headers['set-cookie'][0];

    const portal = await request(app).get(`/api/tenant/portal?tenant_id=${tenantId}`).set('Cookie', tenantCookie);
    expect(portal.status).toBe(200);
    expect(portal.body.rentals).toHaveLength(1);
    expect(portal.body.rentals[0].assignment.id).toBe(assignmentId);
  });

  test('invoice and repair modules share the same data', async () => {
    const invoice = await request(app).post('/api/invoices').set('Cookie', adminCookie).send({
      room_id: roomId,
      tenant_id: tenantId,
      invoice_month: 7,
      invoice_year: 2026,
      room_rent: 2500000,
      electricity_cost: 35000,
      water_cost: 30000,
      other_fees: 0,
      total_amount: 2565000,
      due_date: '2026-07-22',
    });
    expect(invoice.status).toBe(201);
    invoiceId = invoice.body.id;
    invoiceCode = invoice.body.ma_hoa_don;

    const repair = await request(app)
      .post('/api/tenant/repair_requests')
      .set('Cookie', tenantCookie)
      .send({
      room_id: roomId,
      title: 'Máy lạnh không hoạt động',
      description: 'Cần kiểm tra',
      priority: 'high',
    });
    expect(repair.status).toBe(201);
    expect(repair.body.tenant_id).toBe(tenantId);

    const portal = await request(app).get(`/api/tenant/portal?tenant_id=${tenantId}`).set('Cookie', tenantCookie);
    expect(portal.body.unpaidInvoices).toHaveLength(1);

    const repairs = await request(app)
      .get('/api/tenant/repair_requests')
      .set('Cookie', tenantCookie);
    expect(repairs.body).toHaveLength(1);
  });

  test('SePay webhook marks the correct invoice as paid and is idempotent', async () => {
    const webhook = await request(app)
      .post('/api/webhooks/sepay')
      .set('Authorization', `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`)
      .send({
        id: 'TEST-TRANSACTION-001',
        accountNumber: '0123456789',
        transferType: 'in',
        transferAmount: 2565000,
        content: invoiceCode,
      });
    expect(webhook.status).toBe(200);
    expect(webhook.body).toEqual({ success: true });

    const invoice = await request(app).get(`/api/invoices/${invoiceId}`).set('Cookie', adminCookie);
    expect(invoice.body.status).toBe('paid');

    const duplicate = await request(app)
      .post('/api/webhooks/sepay')
      .set('Authorization', `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`)
      .send({
        id: 'TEST-TRANSACTION-001',
        accountNumber: '0123456789',
        transferType: 'in',
        transferAmount: 2565000,
        content: invoiceCode,
      });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toEqual({ success: true });
  });

  test('admin can list tenant accounts', async () => {
    const users = await request(app)
      .get('/api/admin/users')
      .set('Cookie', adminCookie);
    expect(users.status).toBe(200);
    expect(users.body.data[0]).toMatchObject({ role: 'TENANT', tenant_id: tenantId });
  });
});
