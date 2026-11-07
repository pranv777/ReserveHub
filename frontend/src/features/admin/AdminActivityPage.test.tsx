import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { AdminBooking, AuditEvent } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { AdminActivityPage } from "./AdminActivityPage";

const adminBookings = vi.fn();
const auditEvents = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  adminBookings: (...a: unknown[]) => adminBookings(...a),
  auditEvents: (...a: unknown[]) => auditEvents(...a),
}));

const booking = (over: Partial<AdminBooking> = {}): AdminBooking => ({
  id: "b1", slot_id: "s1", user_id: "u1", status: "confirmed", source: "direct", created_at: "2030-01-01T00:00:00Z",
  cancelled_at: null, resource_id: "r1", resource_name: "Room A", slot_start_at: "2999-01-01T10:00:00Z",
  slot_end_at: "2999-01-01T11:00:00Z", user_email: "m@example.com", ...over,
});
const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: "e1", actor_id: null, event_type: "booking.created", target_type: "booking", target_id: "b1",
  metadata: {}, created_at: "2030-01-01T00:00:00Z", ...over,
});
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, page_size: 15 });

beforeEach(() => {
  adminBookings.mockReset();
  auditEvents.mockReset();
  auditEvents.mockResolvedValue(page([event()]));
});

describe("AdminActivityPage", () => {
  it("lists bookings and falls back to the user id when there is no email", async () => {
    adminBookings.mockResolvedValue(page([booking(), booking({ id: "b2", user_email: null, user_id: "u-xyz" })]));
    renderAt(<AdminActivityPage />);
    expect(await screen.findByText("m@example.com")).toBeInTheDocument();
    expect(screen.getByText("u-xyz")).toBeInTheDocument();
  });

  it("filters bookings by status", async () => {
    adminBookings.mockResolvedValue(page([booking()]));
    renderAt(<AdminActivityPage />);
    await screen.findByText("m@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");
    await waitFor(() =>
      expect(adminBookings).toHaveBeenLastCalledWith(expect.objectContaining({ status: "cancelled", page: 1, page_size: 15 })),
    );
  });

  it("switches to the audit tab and shows 'system' for events without an actor", async () => {
    adminBookings.mockResolvedValue(page([booking()]));
    renderAt(<AdminActivityPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Audit events" }));
    expect(screen.getByRole("tab", { name: "Audit events" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("booking.created")).toBeInTheDocument();
    expect(screen.getByText("system")).toBeInTheDocument();
  });

  it("filters audit events by type", async () => {
    adminBookings.mockResolvedValue(page([booking()]));
    renderAt(<AdminActivityPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Audit events" }));
    await screen.findByText("booking.created");
    await userEvent.type(screen.getByLabelText("Event type"), "booking.cancelled");
    await waitFor(() =>
      expect(auditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: "booking.cancelled" })),
    );
  });

  it("shows empty states", async () => {
    adminBookings.mockResolvedValue(page([]));
    auditEvents.mockResolvedValue(page([]));
    renderAt(<AdminActivityPage />);
    expect(await screen.findByText("No bookings found.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Audit events" }));
    expect(await screen.findByText("No audit events found.")).toBeInTheDocument();
  });

  it("shows an error when bookings fail to load", async () => {
    adminBookings.mockRejectedValue(new ApiError(403, "admin_required", "Administrator permission is required."));
    renderAt(<AdminActivityPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Administrator permission is required.");
  });
});
