// Vietnamese database columns -> English API fields.
export const mapRoom = (r) => {
  if (!r) return null;
  return {
    id: r.id,
    room_number: r.so_phong,
    floor: r.tang,
    area_sqm: r.dien_tich,
    monthly_rent: r.gia_phong,
    status: r.trang_thai,
    description: r.mo_ta,
    max_occupants: r.so_nguoi_toi_da,
    location: r.khu_vuc || '',
    created_at: r.ngay_tao,
    updated_at: r.ngay_cap_nhat
  };
};

export const mapTenant = (t) => {
  if (!t) return null;
  return {
    id: t.id,
    full_name: t.ho_ten,
    phone: t.so_dien_thoai,
    email: t.email,
    id_card_number: t.so_cccd,
    date_of_birth: t.ngay_sinh,
    address: t.dia_chi,
    emergency_contact: t.lien_he_khan_cap,
    notes: t.ghi_chu,
    username: t.username,
    google_email: t.google_email,
    is_locked: !!t.is_locked,
    created_at: t.ngay_tao,
    updated_at: t.ngay_cap_nhat
  };
};

export const mapAssignment = (a) => {
  if (!a) return null;
  return {
    id: a.id,
    room_id: a.phong_id,
    tenant_id: a.khach_thue_id,
    start_date: a.ngay_bat_dau,
    end_date: a.ngay_ket_thuc,
    is_active: !!a.dang_hoat_dong,
    deposit_amount: a.tien_dat_coc,
    is_primary: !!a.la_nguoi_dai_dien,
    contract_end_date: a.ngay_het_han_hop_dong,
    notes: a.ghi_chu,
    created_at: a.ngay_tao,
    updated_at: a.ngay_cap_nhat
  };
};

export const mapReading = (m) => {
  if (!m) return null;
  return {
    id: m.id,
    room_id: m.phong_id,
    reading_date: m.ngay_ghi_so,
    electricity_old: m.so_dien_cu,
    electricity_new: m.so_dien_moi,
    water_old: m.so_nuoc_cu,
    water_new: m.so_nuoc_moi,
    electricity_price_per_unit: m.don_gia_dien,
    water_price_per_unit: m.don_gia_nuoc,
    created_at: m.ngay_tao,
    updated_at: m.ngay_cap_nhat
  };
};

export const mapInvoice = (i) => {
  if (!i) return null;
  return {
    id: i.id,
    ma_hoa_don: i.ma_hoa_don,
    room_id: i.phong_id,
    tenant_id: i.khach_thue_id,
    meter_reading_id: i.chi_so_dien_nuoc_id,
    invoice_month: i.thang_hoa_don,
    invoice_year: i.nam_hoa_don,
    room_rent: i.tien_phong,
    electricity_cost: i.tien_dien,
    water_cost: i.tien_nuoc,
    other_fees: i.chi_phi_khac,
    total_amount: i.tong_tien,
    status: i.trang_thai,
    due_date: i.han_thanh_toan,
    paid_date: i.ngay_thanh_toan,
    notes: i.ghi_chu,
    created_at: i.ngay_tao,
    updated_at: i.ngay_cap_nhat
  };
};

export const mapRepair = (rep) => {
  if (!rep) return null;
  return {
    id: rep.id,
    room_id: rep.phong_id,
    tenant_id: rep.khach_thue_id,
    title: rep.tieu_de,
    description: rep.mo_ta,
    priority: rep.muc_do_uu_tien,
    status: rep.trang_thai,
    reported_at: rep.ngay_bao,
    resolved_at: rep.ngay_xu_ly_xong,
    assigned_to: rep.nguoi_xu_ly,
    resolution_notes: rep.ghi_chu_giai_quyet,
    created_at: rep.ngay_tao,
    updated_at: rep.ngay_cap_nhat
  };
};
