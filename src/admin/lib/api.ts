import type { Room, Tenant, RoomAssignment, MeterReading, Invoice, RepairRequest } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Rooms API
export async function getRooms(): Promise<Room[]> {
  return request<Room[]>('/rooms');
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

// Tenants API
export async function getTenants(): Promise<Tenant[]> {
  return request<Tenant[]>('/tenants');
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

export async function issueTenantCredentials(id: string, username?: string): Promise<Tenant & { temporary_password: string }> {
  return request<Tenant & { temporary_password: string }>(`/tenants/${id}/credentials`, {
    method: 'POST',
    body: JSON.stringify({ username }),
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
export async function getMeterReadings(): Promise<MeterReading[]> {
  return request<MeterReading[]>('/meter_readings');
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
export async function getInvoices(): Promise<Invoice[]> {
  return request<Invoice[]>('/invoices');
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
export async function getRepairRequests(): Promise<RepairRequest[]> {
  return request<RepairRequest[]>('/repair_requests');
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

// Dashboard stats
export async function getDashboardStats() {
  const [rooms, tenants, invoices, repairs, expiringContracts] = await Promise.all([
    getRooms(),
    getTenants(),
    getInvoices(),
    getRepairRequests(),
    getExpiringContracts(30),
  ]);

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const pendingPayments = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;

  const pendingRepairs = repairs.filter(r => r.status === 'new' || r.status === 'in_progress').length;

  const missingIdTenants = tenants.filter(t => !t.id_card_number || t.id_card_number.length < 9).length;

  return {
    expiringContracts,
    missingIdTenants,
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
    recentRepairs: repairs.filter(r => r.status !== 'closed').slice(0, 5),
    recentInvoices: invoices.filter(i => i.status !== 'paid').slice(0, 5),
  };
}
