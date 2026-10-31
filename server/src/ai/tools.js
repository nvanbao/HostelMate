export const aiTools = [
  {
    name: "search_rooms",
    description: "Tìm kiếm danh sách phòng dựa trên các tiêu chí (ví dụ: giá phòng, tiện ích, trạng thái).",
    parameters: {
      type: "OBJECT",
      properties: {
        maxPrice: {
          type: "NUMBER",
          description: "Mức giá tối đa của phòng."
        },
        area: {
          type: "STRING",
          description: "Khu vực hoặc địa chỉ của nhà trọ (ví dụ: Khu A, Khu B)."
        },
        airConditioner: {
          type: "BOOLEAN",
          description: "Có điều hòa hay không."
        },
        washingMachine: {
          type: "BOOLEAN",
          description: "Có máy giặt hay không."
        },
        furnished: {
          type: "BOOLEAN",
          description: "Có nội thất hay không."
        },
        balcony: {
          type: "BOOLEAN",
          description: "Có ban công hay không."
        },
        availableOnly: {
          type: "BOOLEAN",
          description: "Chỉ tìm các phòng đang trống (AVAILABLE)."
        }
      }
    }
  },
  {
    name: "get_room_by_code",
    description: "Tìm thông tin chi tiết của một phòng cụ thể bằng mã phòng.",
    parameters: {
      type: "OBJECT",
      properties: {
        roomCode: {
          type: "STRING",
          description: "Mã phòng cần tìm (ví dụ: 101, 202)."
        },
        area: {
          type: "STRING",
          description: "Khu vực hoặc địa chỉ của nhà trọ (ví dụ: Khu A, Khu B) nếu người dùng có nhắc đến."
        }
      },
      required: ["roomCode"]
    }
  },
  {
    name: "get_available_rooms",
    description: "Lấy danh sách tất cả các phòng đang trống hiện tại.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_all_areas",
    description: "Lấy danh sách tất cả các khu vực / địa chỉ hiện có trong hệ thống.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_my_current_room",
    description: "Lấy thông tin phòng đang thuê của chính người dùng (Tenant). Không cần truyền tham số, tự động lấy thông tin của người đang nhắn tin.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_my_invoices",
    description: "Lấy danh sách hóa đơn điện nước/phòng của chính người dùng (Tenant).",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_my_repair_requests",
    description: "Lấy danh sách các yêu cầu sửa chữa mà người dùng (Tenant) đã báo cáo.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_admin_room_summary",
    description: "Lấy thông tin thống kê tổng quan về số lượng phòng (trống, đang bảo trì, đã cho thuê) dành cho Admin.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_admin_invoice_summary",
    description: "Lấy thống kê hóa đơn (đã thu, chưa thu) dành cho Admin.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "admin_get_room_invoices",
    description: "Quản trị viên (Admin) lấy danh sách hóa đơn chi tiết của một phòng cụ thể.",
    parameters: {
      type: "OBJECT",
      properties: {
        roomCode: {
          type: "STRING",
          description: "Mã phòng cần lấy hóa đơn (ví dụ: 101, 202)."
        },
        area: {
          type: "STRING",
          description: "Khu vực hoặc địa chỉ của nhà trọ (ví dụ: Khu A, Khu B) nếu người dùng có nhắc đến."
        }
      },
      required: ["roomCode"]
    }
  },
  {
    name: "admin_get_room_repair_requests",
    description: "Quản trị viên (Admin) lấy danh sách yêu cầu sửa chữa của một phòng cụ thể.",
    parameters: {
      type: "OBJECT",
      properties: {
        roomCode: {
          type: "STRING",
          description: "Mã phòng cần lấy yêu cầu sửa chữa (ví dụ: 101, 202)."
        },
        area: {
          type: "STRING",
          description: "Khu vực hoặc địa chỉ của nhà trọ (ví dụ: Khu A, Khu B) nếu người dùng có nhắc đến."
        }
      },
      required: ["roomCode"]
    }
  },
  {
    name: "admin_get_room_tenant",
    description: "Quản trị viên (Admin) lấy thông tin người thuê đang ở của một phòng cụ thể.",
    parameters: {
      type: "OBJECT",
      properties: {
        roomCode: {
          type: "STRING",
          description: "Mã phòng cần lấy thông tin khách thuê (ví dụ: 101, 202)."
        },
        area: {
          type: "STRING",
          description: "Khu vực hoặc địa chỉ của nhà trọ (ví dụ: Khu A, Khu B) nếu người dùng có nhắc đến."
        }
      },
      required: ["roomCode"]
    }
  },
  {
    name: "get_roommate_requests",
    description: "Lấy danh sách các yêu cầu tìm người ở ghép đang mở. Trả về thông tin phòng và giá chia sẻ.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "get_my_roommates",
    description: "Lấy thông tin những người đang ở chung phòng với người dùng (Tenant).",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  }
];
