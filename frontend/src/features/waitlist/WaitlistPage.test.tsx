import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { WaitlistEntry } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { WaitlistPage } from "./WaitlistPage";

const myWaitlist = vi.fn();
const leaveWaitlist = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  myWaitlist: (...a: unknown[]) => myWaitlist(...a),
  leaveWaitlist: (...a: unknown[]) => leaveWaitlist(...a),
}));

const entry = (over: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: "w1", slot_id: "s1", status: "waiting", position: 2, created_at: "2030-01-01T00:00:00Z",
  promoted_at: null, cancelled_at: null, booking_id: null, resource_id: "r1", resource_name: "Room A",
  slot_start_at: "2999-01-01T10:00:00Z", slot_end_at: "2999-01-01T11:00:00Z", ...over,
});
const page = (items: WaitlistEntry[]) => ({ items, total: items.length, page: 1, page_size: 10 });

beforeEach(() => {
  myWaitlist.mockReset();
  leaveWaitlist.mockReset();
});

describe("WaitlistPage", () => {
  it("shows the queue position for waiting entries", async () => {
    myWaitlist.mockResolvedValue(page([entry()]));
    renderAt(<WaitlistPage />);
    expect(await screen.findByText("Position in queue: 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave waitlist for Room A" })).toBeInTheDocument();
  });

  it("links promoted entries to the booking and offers no Leave button", async () => {
    myWaitlist.mockResolvedValue(page([entry({ status: "promoted", position: null, booking_id: "b9" })]));
    renderAt(<WaitlistPage />);
    expect(await screen.findByText(/You were promoted!/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your booking" })).toHaveAttribute("href", "/bookings");
    expect(screen.queryByRole("button", { name: /Leave waitlist/ })).not.toBeInTheDocument();
  });

  it("asks for confirmation before leaving, then reports success", async () => {
    myWaitlist.mockResolvedValue(page([entry()]));
    leaveWaitlist.mockResolvedValue(undefined);
    renderAt(<WaitlistPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Leave waitlist for Room A" }));
    expect(leaveWaitlist).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Leave this waitlist?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave waitlist" }));
    await waitFor(() => expect(leaveWaitlist).toHaveBeenCalledWith("w1"));
    expect(await screen.findByRole("status")).toHaveTextContent("You left the waitlist.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can back out of leaving", async () => {
    myWaitlist.mockResolvedValue(page([entry()]));
    renderAt(<WaitlistPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Leave waitlist for Room A" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(leaveWaitlist).not.toHaveBeenCalled();
  });

  it("shows the API error when leaving fails", async () => {
    myWaitlist.mockResolvedValue(page([entry()]));
    leaveWaitlist.mockRejectedValue(new ApiError(404, "not_found", "That waitlist entry no longer exists."));
    renderAt(<WaitlistPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Leave waitlist for Room A" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave waitlist" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That waitlist entry no longer exists.");
  });

  it("shows an empty state", async () => {
    myWaitlist.mockResolvedValue(page([]));
    renderAt(<WaitlistPage />);
    expect(await screen.findByText("You are not on any waitlists.")).toBeInTheDocument();
  });
});
