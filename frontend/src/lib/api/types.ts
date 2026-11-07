export interface Page<T> { items: T[]; total: number; page: number; page_size: number }

export interface Me { id: string; email: string | null; display_name: string | null; role: "member" | "admin" }

export interface Resource {
  id: string; name: string; description: string; location: string; category: string;
  capacity: number; is_active: boolean; created_at: string; updated_at: string;
}
export interface ResourceInput {
  name: string; description?: string; location?: string; category?: string; capacity?: number;
}

export interface Slot {
  id: string; resource_id: string; resource_name: string; resource_location: string;
  resource_category: string; resource_active: boolean; start_at: string; end_at: string;
  is_available: boolean; booked_by_me: boolean; waitlist_count: number;
}
export interface SlotQuery {
  page?: number; page_size?: number; resource_id?: string; location?: string; category?: string;
  start_from?: string; start_to?: string; available_only?: boolean; include_inactive?: boolean;
}

export interface Booking {
  id: string; slot_id: string; user_id: string; status: "confirmed" | "cancelled";
  source: "direct" | "waitlist"; created_at: string; cancelled_at: string | null;
  resource_id: string; resource_name: string; slot_start_at: string; slot_end_at: string;
}
export interface AdminBooking extends Booking { user_email: string | null }

export interface WaitlistEntry {
  id: string; slot_id: string; status: "waiting" | "promoted" | "cancelled" | "expired";
  position: number | null; created_at: string; promoted_at: string | null;
  cancelled_at: string | null; booking_id: string | null; resource_id: string;
  resource_name: string; slot_start_at: string; slot_end_at: string;
}

export interface AppNotification {
  id: string; type: string; message: string; slot_id: string | null; booking_id: string | null;
  read_at: string | null; created_at: string;
}

export interface AuditEvent {
  id: string; actor_id: string | null; event_type: string; target_type: string;
  target_id: string | null; metadata: Record<string, unknown>; created_at: string;
}
