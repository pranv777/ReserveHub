import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ep from "./endpoints";

const api = vi.fn();
vi.mock("./client", () => ({ api: (...a: unknown[]) => api(...a) }));

beforeEach(() => api.mockReset());

const cases: [string, () => unknown, unknown[]][] = [
  ["getMe", () => ep.getMe(), ["/me"]],
  ["listResources", () => ep.listResources({ page: 2 }), ["/resources", { query: { page: 2 } }]],
  ["listResources default", () => ep.listResources(), ["/resources", { query: {} }]],
  ["createResource", () => ep.createResource({ name: "A" }), ["/resources", { method: "POST", body: { name: "A" } }]],
  ["updateResource", () => ep.updateResource("r1", { name: "B" }), ["/resources/r1", { method: "PATCH", body: { name: "B" } }]],
  ["deactivateResource", () => ep.deactivateResource("r1"), ["/resources/r1/deactivate", { method: "POST" }]],
  ["listSlots", () => ep.listSlots({ location: "X" }), ["/slots", { query: { location: "X" } }]],
  ["getSlot", () => ep.getSlot("s1"), ["/slots/s1"]],
  [
    "createSlot",
    () => ep.createSlot("r1", { start_at: "a", end_at: "b" }),
    ["/resources/r1/slots", { method: "POST", body: { start_at: "a", end_at: "b" } }],
  ],
  [
    "createBooking sends the idempotency key",
    () => ep.createBooking("s1", "key-1"),
    ["/bookings", { method: "POST", body: { slot_id: "s1" }, headers: { "Idempotency-Key": "key-1" } }],
  ],
  ["myBookings", () => ep.myBookings({ when: "upcoming" }), ["/bookings/me", { query: { when: "upcoming" } }]],
  ["cancelBooking", () => ep.cancelBooking("b1"), ["/bookings/b1/cancel", { method: "POST" }]],
  ["joinWaitlist", () => ep.joinWaitlist("s1"), ["/slots/s1/waitlist", { method: "POST" }]],
  ["myWaitlist", () => ep.myWaitlist({ page: 1 }), ["/waitlist/me", { query: { page: 1 } }]],
  ["leaveWaitlist", () => ep.leaveWaitlist("w1"), ["/waitlist/w1", { method: "DELETE" }]],
  ["myNotifications", () => ep.myNotifications({ unread_only: true }), ["/notifications/me", { query: { unread_only: true } }]],
  ["markNotificationRead", () => ep.markNotificationRead("n1"), ["/notifications/n1/read", { method: "POST" }]],
  ["adminBookings", () => ep.adminBookings({ status: "cancelled" }), ["/admin/bookings", { query: { status: "cancelled" } }]],
  ["auditEvents", () => ep.auditEvents({ event_type: "x" }), ["/admin/audit-events", { query: { event_type: "x" } }]],
];

describe("endpoints", () => {
  it.each(cases)("%s calls the right path", (_name, call, expected) => {
    call();
    expect(api).toHaveBeenCalledWith(...expected);
  });
});
