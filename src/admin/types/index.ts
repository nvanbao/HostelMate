export interface Room {
  id: string;
  room_number: string;
  floor: number;
  area_sqm: number;
  monthly_rent: number;
  status: 'available' | 'occupied' | 'maintenance';
  max_occupants: number;
  description: string | null;
  location?: string;
  created_at: string;
  updated_at: string;
  current_tenant?: Tenant | null;
  current_assignment?: RoomAssignment | null;
  tenants?: Tenant[];
  active_assignments?: RoomAssignment[];
}

export interface Tenant {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_card_number: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
  username?: string | null;
  is_locked?: boolean;
  google_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomAssignment {
  id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  contract_end_date: string | null;
  is_active: boolean;
  is_primary: boolean;
  deposit_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  room?: Room;
}

export interface MeterReading {
  id: string;
  room_id: string;
  reading_date: string;
  electricity_old: number;
  electricity_new: number;
  water_old: number;
  water_new: number;
  electricity_price_per_unit: number;
  water_price_per_unit: number;
  created_at: string;
  updated_at: string;
  room?: Room;
}

export interface Invoice {
  id: string;
  room_id: string;
  tenant_id: string | null;
  meter_reading_id: string | null;
  invoice_month: number;
  invoice_year: number;
  room_rent: number;
  electricity_cost: number;
  water_cost: number;
  other_fees: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
  tenant?: Tenant;
  meter_reading?: MeterReading;
}

export interface RepairRequest {
  id: string;
  room_id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  location?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  reported_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
  tenant?: Tenant;
}

export type Page = 'dashboard' | 'rooms' | 'tenants' | 'tenant-accounts' | 'meter-readings' | 'invoices' | 'repairs';
