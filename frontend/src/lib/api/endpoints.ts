import { api } from "./client";
import type {
  AdminBooking, AppNotification, AuditEvent, Booking, Me, Page, Resource, ResourceInput, Slot,
  SlotQuery, WaitlistEntry,
} from "./types";

export const getMe = () => api<Me>("/me");

export const listResources = (query: { page?: number; page_size?: number; include_inactive?: boolean } = {}) =>
  api<Page<Resource>>("/resources", { query });
export const createResource = (body: ResourceInput) => api<Resource>("/resources", { method: "POST", body });
export const updateResource = (id: string, body: Partial<ResourceInput>) =>
  api<Resource>(`/resources/${id}`, { method: "PATCH", body });
export const deactivateResource = (id: string) =>
  api<Resource>(`/resources/${id}/deactivate`, { method: "POST" });

export const listSlots = (query: SlotQuery) => api<Page<Slot>>("/slots", { query: { ...query } });
export const getSlot = (id: string) => api<Slot>(`/slots/${id}`);
export const createSlot = (resourceId: string, body: { start_at: string; end_at: string }) =>
  api<Slot>(`/resources/${resourceId}/slots`, { method: "POST", body });

export const createBooking = (slotId: string, idempotencyKey: string) =>
  api<Booking>("/bookings", {
    method: "POST",
    body: { slot_id: slotId },
    headers: { "Idempotency-Key": idempotencyKey },
  });
export const myBookings = (query: { page?: number; page_size?: number; when?: "all" | "upcoming" | "past" }) =>
  api<Page<Booking>>("/bookings/me", { query });
export const cancelBooking = (id: string) => api<Booking>(`/bookings/${id}/cancel`, { method: "POST" });

export const joinWaitlist = (slotId: string) => api<WaitlistEntry>(`/slots/${slotId}/waitlist`, { method: "POST" });
export const myWaitlist = (query: { page?: number; page_size?: number; active_only?: boolean }) =>
  api<Page<WaitlistEntry>>("/waitlist/me", { query });
export const leaveWaitlist = (id: string) => api<void>(`/waitlist/${id}`, { method: "DELETE" });

export const myNotifications = (query: { page?: number; page_size?: number; unread_only?: boolean }) =>
  api<Page<AppNotification>>("/notifications/me", { query });
export const markNotificationRead = (id: string) =>
  api<AppNotification>(`/notifications/${id}/read`, { method: "POST" });

export const adminBookings = (query: { page?: number; page_size?: number; status?: string; resource_id?: string }) =>
  api<Page<AdminBooking>>("/admin/bookings", { query });
export const auditEvents = (query: { page?: number; page_size?: number; event_type?: string }) =>
  api<Page<AuditEvent>>("/admin/audit-events", { query });
