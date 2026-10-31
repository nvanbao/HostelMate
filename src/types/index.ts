export interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'TENANT';
  tenant_id: string | null;
  full_name?: string;
  phone?: string;
  email?: string;
  cccd?: string;
  date_of_birth?: string;
  address?: string;
  is_locked?: boolean;
}


export interface Room {
  id: string;
  area: string;
  room_number: string;
  floor: number;
  area_sqm: number;
  monthly_rent: number;
  status: 'available' | 'occupied' | 'maintenance';
  max_occupants: number;
  description: string | null;
  address?: string | null;
  distance_km?: number;
  air_conditioner?: boolean;
  washing_machine?: boolean;
  furnished?: boolean;
  balcony?: boolean;
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
  is_locked?: boolean;
  username?: string | null;
  password?: string | null;
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
  ma_hoa_don: string;
  qrUrl?: string;
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
  status: 'pending' | 'paid' | 'overdue' | 'waiting_confirmation';
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

export interface RoommateRequest {
  id: number;
  khach_thue_id?: number;
  phong_id?: number;
  tieu_de: string;
  mo_ta: string | null;
  gia_chia_se: number;
  trang_thai?: 'open' | 'closed';
  ngay_dang: string;
  ngay_cap_nhat?: string;
  // Bổ sung các trường từ JOIN query
  so_phong?: string;
  dien_tich?: number;
  dieu_hoa?: number;
  may_giat?: number;
  noi_that?: number;
  ban_cong?: number;
  dia_chi?: string | null;
  ten_nha_tro?: string | null;
  ho_ten?: string;
  so_dien_thoai?: string | null;
}

export type Page = 'dashboard' | 'rooms' | 'tenants' | 'tenant-accounts' | 'meter-readings' | 'invoices' | 'repairs';
