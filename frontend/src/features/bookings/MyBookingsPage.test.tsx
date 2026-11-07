import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { Booking } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { MyBookingsPage } from "./MyBookingsPage";

const myBookings = vi.fn();
const cancelBooking = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  myBookings: (...a: unknown[]) => myBookings(...a),
  cancelBooking: (...a: unknown[]) => cancelBooking(...a),
}));

const booking: Booking = {
  id: "b1", slot_id: "s1", user_id: "u1", status: "confirmed", source: "direct",
  created_at: "2030-01-01T00:00:00Z", cancelled_at: null, resource_id: "r1", resource_name: "Room A",
  slot_start_at: "2999-01-01T10:00:00Z", slot_end_at: "2999-01-01T11:00:00Z",
};
const page = (items: Booking[]) => ({ items, total: items.length, page: 1, page_size: 10 });

beforeEach(() => {
  myBookings.mockReset();
  cancelBooking.mockReset();
});

describe("MyBookingsPage", () => {
  it("shows an empty state", async () => {
    myBookings.mockResolvedValue(page([]));
    renderAt(<MyBookingsPage />);
    expect(await screen.findByText("You have no upcoming bookings.")).toBeInTheDocument();
  });

  it("requires confirmation before cancelling, then reports the result", async () => {
    myBookings.mockResolvedValue(page([booking]));
    cancelBooking.mockResolvedValue({ ...booking, status: "cancelled" });
    renderAt(<MyBookingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel booking for Room A" }));
    expect(cancelBooking).not.toHaveBeenCalled(); // nothing happens until confirmed
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Yes, cancel booking" }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith("b1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Your booking for Room A was cancelled.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can back out of the confirmation", async () => {
    myBookings.mockResolvedValue(page([booking]));
    renderAt(<MyBookingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel booking for Room A" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it("shows API errors from a failed cancellation", async () => {
    myBookings.mockResolvedValue(page([booking]));
    cancelBooking.mockRejectedValue(new ApiError(409, "invalid_state_transition", "A cancelled booking cannot become cancelled."));
    renderAt(<MyBookingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel booking for Room A" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel booking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot become cancelled");
  });
});
