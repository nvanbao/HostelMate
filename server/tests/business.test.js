import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../server.js';
import { closeDatabase, dbReady, queryOne } from '../db.js';
import { socketAuth } from '../src/middleware/socketAuth.js';

describe('Business rules', () => {
  let admin;
  let tenantCookie;
  let tenantId;
  let roomId;
  let assignmentId;

  const asAdmin = (method, path) => request(app)[method](path).set('Cookie', admin);

  beforeAll(async () => {
    process.env.SEPAY_WEBHOOK_API_KEY = 'test-webhook-key';
    await dbReady;
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: '123456' });
    admin = login.headers['set-cookie'][0];

    const room = await asAdmin('post', '/api/rooms').send({ room_number: 'R1', max_occupants: 1, monthly_rent: 1000 });
    roomId = room.body.id;
    const tenant = await asAdmin('post', '/api/tenants').send({ full_name: 'Dana' });
    tenantId = tenant.body.id;
    const assignment = await asAdmin('post', '/api/room_assignments')
      .send({ room_id: roomId, tenant_id: tenantId, start_date: '2026-07-01', deposit_amount: 0 });
    assignmentId = assignment.body.id;
    const credentials = await asAdmin('post', `/api/tenants/${tenantId}/credentials`).send({ username: 'dana' });
    const tenantLogin = await request(app).post('/api/auth/login')
      .send({ username: 'dana', password: credentials.body.temporary_password });
    tenantCookie = tenantLogin.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('rooms and contracts', () => {
    test('room numbers are unique within an area', async () => {
      const first = await asAdmin('post', '/api/rooms').send({ room_number: 'DUP', location: 'Khu B' });
      expect(first.status).toBe(201);
      const second = await asAdmin('post', '/api/rooms').send({ room_number: 'DUP', location: 'Khu B' });
      expect(second.status).toBe(400);
    });

    test('a full room rejects new tenants and an occupied room cannot be deleted', async () => {
      const other = await asAdmin('post', '/api/tenants').send({ full_name: 'Extra' });
      const full = await asAdmin('post', '/api/room_assignments')
        .send({ room_id: roomId, tenant_id: other.body.id, start_date: '2026-07-01', deposit_amount: 0 });
      expect(full.status).toBe(400);

      const removal = await asAdmin('delete', `/api/rooms/${roomId}`);
      expect(removal.status).toBe(400);
    });

    test('a tenant with an active contract cannot be deleted', async () => {
      const removal = await asAdmin('delete', `/api/tenants/${tenantId}`);
      expect(removal.status).toBe(400);
    });

    test('ending the last contract makes the room available again', async () => {
      const room = await asAdmin('post', '/api/rooms').send({ room_number: 'R2', max_occupants: 2 });
      const tenant = await asAdmin('post', '/api/tenants').send({ full_name: 'Leaving' });
      const assignment = await asAdmin('post', '/api/room_assignments')
        .send({ room_id: room.body.id, tenant_id: tenant.body.id, start_date: '2026-07-01', deposit_amount: 0 });
      expect((await asAdmin('get', `/api/rooms/${room.body.id}`)).body.status).toBe('occupied');

      await asAdmin('post', `/api/room_assignments/${assignment.body.id}/end`);
      expect((await asAdmin('get', `/api/rooms/${room.body.id}`)).body.status).toBe('available');
    });
  });

  describe('meter readings', () => {
    const reading = {
      reading_date: '2026-08-01', electricity_old: 100, electricity_new: 150, water_old: 10, water_new: 12,
    };

    test('new values cannot be lower than old values', async () => {
      const electricity = await asAdmin('post', '/api/meter_readings')
        .send({ ...reading, room_id: roomId, electricity_new: 90 });
      expect(electricity.status).toBe(400);
      const water = await asAdmin('post', '/api/meter_readings').send({ ...reading, room_id: roomId, water_new: 5 });
      expect(water.status).toBe(400);
    });

    test('a room has at most one reading per month', async () => {
      const first = await asAdmin('post', '/api/meter_readings').send({ ...reading, room_id: roomId });
      expect(first.status).toBe(201);
      const second = await asAdmin('post', '/api/meter_readings')
        .send({ ...reading, room_id: roomId, reading_date: '2026-08-20' });
      expect(second.status).toBe(400);

      const latest = await asAdmin('get', `/api/meter_readings/latest/${roomId}`);
      expect(latest.body.electricity_new).toBe(150);
    });
  });

  describe('SePay webhook logic', () => {
    const createInvoice = async (month, total) => {
      const invoice = await asAdmin('post', '/api/invoices').send({
        room_id: roomId, tenant_id: tenantId, invoice_month: month, invoice_year: 2026, room_rent: total, total_amount: total,
      });
      return invoice.body;
    };
    const sendTransfer = (body) => request(app)
      .post('/api/webhooks/sepay')
      .set('Authorization', 'Apikey test-webhook-key')
      .send(body);

    test('a partial transfer needs review, and the remainder completes the invoice', async () => {
      const invoice = await createInvoice(1, 1000);

      await sendTransfer({ id: 'PART-1', transferAmount: 400, content: `CK ${invoice.ma_hoa_don}` });
      expect((await asAdmin('get', `/api/invoices/${invoice.id}`)).body.status).toBe('review_needed');

      await sendTransfer({ id: 'PART-2', transferAmount: 600, content: `CK ${invoice.ma_hoa_don}` });
      expect((await asAdmin('get', `/api/invoices/${invoice.id}`)).body.status).toBe('paid');
    });

    test('a repeated transaction is only counted once', async () => {
      const invoice = await createInvoice(2, 1000);

      await sendTransfer({ id: 'DUP-1', transferAmount: 400, content: invoice.ma_hoa_don });
      await sendTransfer({ id: 'DUP-1', transferAmount: 400, content: invoice.ma_hoa_don });

      const stored = await queryOne('SELECT so_tien_da_nhan FROM hoa_don WHERE id = ?', [invoice.id]);
      expect(stored.so_tien_da_nhan).toBe(400);
    });

    test('outgoing and unmatched transfers do not touch invoices', async () => {
      const invoice = await createInvoice(3, 1000);

      await sendTransfer({ id: 'OUT-1', transferType: 'out', transferAmount: 1000, content: invoice.ma_hoa_don });
      await sendTransfer({ id: 'NONE-1', transferAmount: 1000, content: 'KHONG CO MA HOA DON' });

      expect((await asAdmin('get', `/api/invoices/${invoice.id}`)).body.status).toBe('pending');
      const unmatched = await queryOne("SELECT status FROM giao_dich_sepay WHERE reference_code = 'NONE-1'");
      expect(unmatched.status).toBe('unmatched');
    });
  });

  describe('repair requests', () => {
    const createRepair = async () => {
      const repair = await request(app).post('/api/tenant/repair_requests').set('Cookie', tenantCookie)
        .send({ room_id: roomId, title: 'Hỏng vòi nước', priority: 'medium' });
      expect(repair.status).toBe(201);
      return repair.body;
    };
    const closeRepair = (id) => request(app).put(`/api/tenant/repair_requests/${id}`)
      .set('Cookie', tenantCookie).send({ status: 'closed' });

    test('a tenant can only close a request after it is resolved', async () => {
      const repair = await createRepair();
      expect((await closeRepair(repair.id)).status).toBe(400);

      const resolved = await asAdmin('put', `/api/repair_requests/${repair.id}`).send({ status: 'resolved' });
      expect(resolved.body.resolved_at).toBeTruthy();

      const closed = await closeRepair(repair.id);
      expect(closed.status).toBe(200);
      expect(closed.body.status).toBe('closed');
    });

    test('a resolved request can no longer be edited by the tenant', async () => {
      const repair = await createRepair();
      await asAdmin('put', `/api/repair_requests/${repair.id}`).send({ status: 'resolved' });

      const edit = await request(app).put(`/api/tenant/repair_requests/${repair.id}`)
        .set('Cookie', tenantCookie).send({ title: 'Sửa lại tiêu đề' });
      expect(edit.status).toBe(400);
    });
  });

  describe('admin management flows', () => {
    test('rooms can be listed with their tenants, updated and deleted', async () => {
      const list = await asAdmin('get', '/api/rooms');
      const occupied = list.body.find((room) => room.id === roomId);
      expect(occupied.current_tenant.id).toBe(tenantId);

      const detail = await asAdmin('get', `/api/rooms/${roomId}`);
      expect(detail.body.active_assignments).toHaveLength(1);

      const updated = await asAdmin('put', `/api/rooms/${roomId}`).send({ monthly_rent: 1200 });
      expect(updated.body.monthly_rent).toBe(1200);

      const room = await asAdmin('post', '/api/rooms').send({ room_number: 'TMP' });
      expect((await asAdmin('delete', `/api/rooms/${room.body.id}`)).status).toBe(204);
      expect((await asAdmin('get', `/api/rooms/${room.body.id}`)).status).toBe(404);
    });

    test('contracts can change representative, be extended and show up as expiring', async () => {
      const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const extended = await asAdmin('put', `/api/room_assignments/${assignmentId}/extend`).send({ contract_end_date: soon });
      expect(extended.body.contract_end_date).toBe(soon);

      const expiring = await asAdmin('get', '/api/room_assignments/expiring?withinDays=30');
      expect(expiring.body.map((item) => item.id)).toContain(assignmentId);

      const primary = await asAdmin('put', `/api/room_assignments/${assignmentId}/primary`).send({ room_id: roomId });
      expect(primary.status).toBe(200);
    });

    test('a meter reading can be listed, corrected and deleted', async () => {
      const created = await asAdmin('post', '/api/meter_readings').send({
        room_id: roomId, reading_date: '2026-09-01', electricity_old: 150, electricity_new: 170, water_old: 12, water_new: 13,
      });
      const list = await asAdmin('get', '/api/meter_readings');
      expect(list.body.map((item) => item.id)).toContain(created.body.id);
      expect((await asAdmin('get', `/api/meter_readings/room/${roomId}`)).status).toBe(200);

      const invalid = await asAdmin('put', `/api/meter_readings/${created.body.id}`).send({ electricity_new: 100 });
      expect(invalid.status).toBe(400);
      const corrected = await asAdmin('put', `/api/meter_readings/${created.body.id}`).send({ electricity_new: 180 });
      expect(corrected.body.electricity_new).toBe(180);

      expect((await asAdmin('delete', `/api/meter_readings/${created.body.id}`)).status).toBe(204);
    });

    test('invoices can be edited, exported, marked overdue, paid and deleted', async () => {
      const created = await asAdmin('post', '/api/invoices').send({
        room_id: roomId, tenant_id: tenantId, invoice_month: 11, invoice_year: 2025, room_rent: 500, total_amount: 500, due_date: '2020-01-01',
      });
      const id = created.body.id;

      const edited = await asAdmin('put', `/api/invoices/${id}`).send({ other_fees: 50, total_amount: 550 });
      expect(edited.body.total_amount).toBe(550);

      await asAdmin('post', '/api/invoices/mark-overdue');
      expect((await asAdmin('get', `/api/invoices/${id}`)).body.status).toBe('overdue');

      const exported = await asAdmin('get', '/api/invoices/export');
      expect(exported.headers['content-type']).toContain('text/csv');
      expect(exported.text).toContain('Dana');

      const paid = await asAdmin('put', `/api/invoices/${id}/paid`);
      expect(paid.body.status).toBe('paid');
      expect(paid.body.paid_date).toBeTruthy();

      expect((await asAdmin('delete', `/api/invoices/${id}`)).status).toBe(204);
    });

    test('admins see every repair request and can filter by tenant', async () => {
      const repair = await request(app).post('/api/tenant/repair_requests').set('Cookie', tenantCookie)
        .send({ room_id: roomId, title: 'Hỏng đèn', priority: 'low' });

      const all = await asAdmin('get', '/api/repair_requests');
      expect(all.body.map((item) => item.id)).toContain(repair.body.id);
      const filtered = await asAdmin('get', `/api/repair_requests?tenant_id=${tenantId}`);
      expect(filtered.body.every((item) => item.tenant_id === tenantId)).toBe(true);
      expect((await asAdmin('get', `/api/repair_requests/${repair.body.id}`)).body.title).toBe('Hỏng đèn');

      const assigned = await asAdmin('put', `/api/repair_requests/${repair.body.id}`)
        .send({ status: 'in_progress', assigned_to: 'Thợ điện' });
      expect(assigned.body.assigned_to).toBe('Thợ điện');

      expect((await asAdmin('delete', `/api/repair_requests/${repair.body.id}`)).status).toBe(204);
    });

    test('a tenant can sign the contract and download it as a PDF', async () => {
      const signed = await request(app).post(`/api/contracts/${assignmentId}/sign`).set('Cookie', tenantCookie)
        .send({ signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC' });
      expect(signed.status).toBe(200);

      const stored = await queryOne('SELECT trang_thai_ky FROM hop_dong_thue WHERE id = ?', [assignmentId]);
      expect(stored.trang_thai_ky).toBe('Đã ký');

      const download = await request(app).get(`/api/contracts/${assignmentId}/download`).set('Cookie', tenantCookie);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('application/pdf');
    });

    test('a wrong current password cannot change the password', async () => {
      const wrong = await request(app).post('/api/auth/change-password').set('Cookie', tenantCookie)
        .send({ oldPassword: 'wrong', newPassword: 'new-password-1' });
      expect(wrong.status).toBeGreaterThanOrEqual(400);

      const me = await request(app).get('/api/auth/me').set('Cookie', tenantCookie);
      expect(me.body.user.role).toBe('TENANT');
      expect(me.body.user).not.toHaveProperty('password');
    });
  });

  describe('Socket.IO authentication', () => {
    const connect = (cookie) => {
      const next = jest.fn();
      const socket = { data: {}, handshake: { headers: { cookie } } };
      socketAuth('socket-secret')(socket, next);
      return { next, socket };
    };

    test('accepts a valid login cookie', () => {
      const token = jwt.sign({ id: 'u1', role: 'TENANT' }, 'socket-secret');
      const { next, socket } = connect(`theme=dark; token=${token}`);
      expect(next).toHaveBeenCalledWith();
      expect(socket.data.user.id).toBe('u1');
    });

    test.each([
      ['no cookie', undefined],
      ['a forged token', `token=${jwt.sign({ id: 'u1' }, 'another-secret')}`],
    ])('rejects %s', (_name, cookie) => {
      const { next } = connect(cookie);
      expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });
});
