import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { Slot } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { SlotDetailPage } from "./SlotDetailPage";

const getSlot = vi.fn();
const createBooking = vi.fn();
const joinWaitlist = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  getSlot: (...a: unknown[]) => getSlot(...a),
  createBooking: (...a: unknown[]) => createBooking(...a),
  joinWaitlist: (...a: unknown[]) => joinWaitlist(...a),
}));

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: "s1", resource_id: "r1", resource_name: "Room A", resource_location: "Floor 2", resource_category: "room",
  resource_active: true, start_at: "2030-01-01T10:00:00Z", end_at: "2030-01-01T11:00:00Z",
  is_available: true, booked_by_me: false, waitlist_count: 0, ...over,
});

const open = () => renderAt(<SlotDetailPage />, { route: "/slots/s1", path: "/slots/:slotId" });

beforeEach(() => {
  getSlot.mockReset();
  createBooking.mockReset();
  joinWaitlist.mockReset();
});

describe("SlotDetailPage booking flow", () => {
  it("submits once even if confirm is double-clicked, then goes to my bookings", async () => {
    getSlot.mockResolvedValue(slot());
    let resolve!: (v: unknown) => void;
    createBooking.mockReturnValue(new Promise((r) => (resolve = r)));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Book this slot" }));
    const confirm = screen.getByRole("button", { name: "Confirm booking" });
    await userEvent.dblClick(confirm);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(createBooking.mock.calls[0]).toEqual(["s1", expect.any(String)]);
    resolve({ id: "b1" });
    expect(await screen.findByText("bookings page")).toBeInTheDocument();
  });

  it("shows the API's conflict message and refetches authoritative state", async () => {
    getSlot.mockResolvedValueOnce(slot());
    createBooking.mockRejectedValue(new ApiError(409, "slot_unavailable", "This slot is no longer available."));
    getSlot.mockResolvedValue(slot({ is_available: false }));
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Book this slot" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This slot is no longer available.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Join the waitlist" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Book this slot" })).not.toBeInTheDocument();
  });

  it("offers the waitlist (not booking) for a booked slot", async () => {
    getSlot.mockResolvedValue(slot({ is_available: false, waitlist_count: 2 }));
    open();
    expect(await screen.findByRole("button", { name: "Join the waitlist" })).toBeInTheDocument();
    expect(screen.getByText("2 on the waitlist")).toBeInTheDocument();
  });

  it("shows a retryable error when loading fails", async () => {
    getSlot.mockRejectedValue(new ApiError(0, "network_error", "Cannot reach the server."));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
