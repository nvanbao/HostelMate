import type { Room, Tenant, RoomAssignment, MeterReading, Invoice, RepairRequest } from '../types';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  unreadCount?: number;
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

function asPaginated<T>(value: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
  if (!Array.isArray(value)) return value;
  return {
    data: value,
    pagination: {
      page: 1,
      limit: value.length || 1,
      totalItems: value.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Rooms API
export async function getRooms(params?: PaginationParams): Promise<PaginatedResponse<Room>> {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return asPaginated(await request<PaginatedResponse<Room> | Room[]>(`/rooms${query}`));
}

export async function getRoom(id: string): Promise<Room | null> {
  return request<Room>(`/rooms/${id}`);
}

export async function createRoom(room: Partial<Room>): Promise<Room> {
  return request<Room>('/rooms', {
    method: 'POST',
    body: JSON.stringify(room),
  });
}

export async function updateRoom(id: string, room: Partial<Room>): Promise<Room> {
  return request<Room>(`/rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(room),
  });
}

export async function deleteRoom(id: string): Promise<void> {
  return request<void>(`/rooms/${id}`, {
    method: 'DELETE',
  });
}

// Users API
// AI API
export async function sendAiMessage(message: string, role: string, tenantId?: string, history: any[] = []): Promise<{ reply: string }> {
  return request<{ reply: string }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, role, tenant_id: tenantId, history })
  });
}

// Tenants API
export async function getTenants(params?: PaginationParams): Promise<PaginatedResponse<Tenant>> {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return asPaginated(await request<PaginatedResponse<Tenant> | Tenant[]>(`/tenants${query}`));
}

export async function getTenant(id: string): Promise<Tenant | null> {
  return request<Tenant>(`/tenants/${id}`);
}

export async function createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
  return request<Tenant>('/tenants', {
    method: 'POST',
    body: JSON.stringify(tenant),
  });
}

export async function updateTenant(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
  return request<Tenant>(`/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tenant),
  });
}

export async function deleteTenant(id: string): Promise<void> {
  return request<void>(`/tenants/${id}`, {
    method: 'DELETE',
  });
}

// Room Assignments API
export async function assignTenantToRoom(
  roomId: string,
  tenantId: string,
  startDate: string,
  deposit: number,
  isPrimary: boolean,
  notes?: string,
  contractEndDate?: string
): Promise<RoomAssignment> {
  return request<RoomAssignment>('/room_assignments', {
    method: 'POST',
    body: JSON.stringify({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: startDate,
      deposit_amount: deposit,
      is_primary: isPrimary,
      notes,
      contract_end_date: contractEndDate,
    }),
  });
}

export async function setPrimaryTenant(assignmentId: string, roomId: string): Promise<void> {
  return request<void>(`/room_assignments/${assignmentId}/primary`, {
    method: 'PUT',
    body: JSON.stringify({ room_id: roomId }),
  });
}

export async function endRoomAssignment(assignmentId: string): Promise<void> {
  return request<void>(`/room_assignments/${assignmentId}/end`, {
    method: 'POST',
  });
}

export async function extendContract(assignmentId: string, newContractEndDate: string): Promise<RoomAssignment> {
  return request<RoomAssignment>(`/room_assignments/${assignmentId}/extend`, {
    method: 'PUT',
    body: JSON.stringify({ contract_end_date: newContractEndDate }),
  });
}

export async function getExpiringContracts(withinDays: number = 30): Promise<RoomAssignment[]> {
  return request<RoomAssignment[]>(`/room_assignments/expiring?withinDays=${withinDays}`);
}

// Meter Readings API
export async function getMeterReadings(params?: PaginationParams): Promise<PaginatedResponse<MeterReading>> {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return asPaginated(await request<PaginatedResponse<MeterReading> | MeterReading[]>(`/meter_readings${query}`));
}

export async function getMeterReadingsByRoom(roomId: string): Promise<MeterReading[]> {
  return request<MeterReading[]>(`/meter_readings/room/${roomId}`);
}

export async function getLatestMeterReading(roomId: string): Promise<MeterReading | null> {
  return request<MeterReading | null>(`/meter_readings/latest/${roomId}`);
}

export async function createMeterReading(reading: Partial<MeterReading>): Promise<MeterReading> {
  return request<MeterReading>('/meter_readings', {
    method: 'POST',
    body: JSON.stringify(reading),
  });
}

export async function updateMeterReading(id: string, reading: Partial<MeterReading>): Promise<MeterReading> {
  return request<MeterReading>(`/meter_readings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(reading),
  });
}

export async function deleteMeterReading(id: string): Promise<void> {
  return request<void>(`/meter_readings/${id}`, {
    method: 'DELETE',
  });
}

// Invoices API
export async function getInvoices(params?: PaginationParams): Promise<PaginatedResponse<Invoice>> {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return asPaginated(await request<PaginatedResponse<Invoice> | Invoice[]>(`/invoices${query}`));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  return request<Invoice>(`/invoices/${id}`);
}

export async function createInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
  return request<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(invoice),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  return request<void>(`/invoices/${id}`, {
    method: 'DELETE',
  });
}

export async function markOverdueInvoices(): Promise<void> {
  return request<void>('/invoices/mark-overdue', {
    method: 'POST',
  });
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}/paid`, {
    method: 'PUT',
  });
}

// Repair Requests API
export async function getRepairRequests(params?: PaginationParams): Promise<PaginatedResponse<RepairRequest>> {
  const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return asPaginated(await request<PaginatedResponse<RepairRequest> | RepairRequest[]>(`/repair_requests${query}`));
}

export async function getRepairRequest(id: string): Promise<RepairRequest | null> {
  return request<RepairRequest>(`/repair_requests/${id}`);
}

export async function createRepairRequest(requestData: Partial<RepairRequest>): Promise<RepairRequest> {
  return request<RepairRequest>('/repair_requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

export async function updateRepairRequest(id: string, requestData: Partial<RepairRequest>): Promise<RepairRequest> {
  return request<RepairRequest>(`/repair_requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(requestData),
  });
}

export async function deleteRepairRequest(id: string): Promise<void> {
  return request<void>(`/repair_requests/${id}`, {
    method: 'DELETE',
  });
}

// Authenticated tenant repair API. The backend derives tenant_id from the
// signed-in account, so a request cannot be attached to the wrong tenant.
export async function getMyRepairRequests(): Promise<RepairRequest[]> {
  return request<RepairRequest[]>('/tenant/repair_requests');
}

export async function createMyRepairRequest(requestData: {
  room_id: string;
  title: string;
  description?: string;
  priority?: RepairRequest['priority'];
}): Promise<RepairRequest> {
  return request<RepairRequest>('/tenant/repair_requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

export async function updateMyRepairRequest(
  id: string,
  requestData: Partial<Pick<RepairRequest, 'title' | 'priority'>> & { description?: string; status?: 'closed' },
): Promise<RepairRequest> {
  return request<RepairRequest>(`/tenant/repair_requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(requestData),
  });
}

export async function deleteMyRepairRequest(id: string): Promise<void> {
  return request<void>(`/tenant/repair_requests/${id}`, {
    method: 'DELETE',
  });
}

// Roommate Requests API
// Dashboard stats
export async function getDashboardStats() {
  const [roomsRes, tenantsRes, invoicesRes, repairsRes] = await Promise.all([
    getRooms({ limit: 10000 }),
    getTenants({ limit: 10000 }),
    getInvoices({ limit: 10000 }),
    getRepairRequests({ limit: 10000 }),
  ]);

  const rooms = roomsRes.data || [];
  const tenants = tenantsRes.data || [];
  const invoices = invoicesRes.data || [];
  const repairs = repairsRes.data || [];

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const pendingPayments = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;

  const pendingRepairs = repairs.filter(r => r.status === 'new' || r.status === 'in_progress').length;

  return {
    totalRooms: rooms.length,
    occupiedRooms,
    availableRooms,
    maintenanceRooms: rooms.filter(r => r.status === 'maintenance').length,
    totalTenants: tenants.length,
    totalRevenue,
    pendingPayments,
    pendingInvoices: invoices.filter(i => i.status === 'pending').length,
    overdueInvoices: invoices.filter(i => i.status === 'overdue').length,
    pendingRepairs,
    recentRepairs: repairs.filter((r) => r.status !== 'closed').slice(0, 5),
    recentInvoices: invoices.filter((i) => i.status !== 'paid').slice(0, 5),
  };
}

export async function confirmPayment(invoiceId: string) {
  const res = await fetch(`${BASE_URL}/admin/invoices/${invoiceId}/confirm-payment`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to confirm payment');
  return res.json();
}

// --- REPAIR REQUESTS ---
export async function getSettings() {
  const res = await fetch(`${BASE_URL}/settings`, { headers: getHeaders(), credentials: 'include' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch settings (status ${res.status})`);
  }
  return res.json();
}

// --- NOTIFICATIONS API ---
// --- FRIENDS API ---
// --- CHAT API ---
export async function loginUser(data: any): Promise<any> {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<any> {
  return request<any>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword })
  });
}

export async function getBadges(): Promise<{ chat: number, notifications: number, invoices: number, repairs: number }> {
  return request<{ chat: number, notifications: number, invoices: number, repairs: number }>('/badges');
}

