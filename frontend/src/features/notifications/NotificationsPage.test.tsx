import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { AppNotification } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { NotificationsPage } from "./NotificationsPage";

const myNotifications = vi.fn();
const markNotificationRead = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  myNotifications: (...a: unknown[]) => myNotifications(...a),
  markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
}));

const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: "n1", type: "booking_confirmed", message: "Your booking for Room A is confirmed.", slot_id: "s1",
  booking_id: "b1", read_at: null, created_at: "2030-01-01T00:00:00Z", ...over,
});
const page = (items: AppNotification[]) => ({ items, total: items.length, page: 1, page_size: 10 });

beforeEach(() => {
  myNotifications.mockReset();
  markNotificationRead.mockReset();
});

describe("NotificationsPage", () => {
  it("shows an empty state", async () => {
    myNotifications.mockResolvedValue(page([]));
    renderAt(<NotificationsPage />);
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });

  it("offers Mark as read only for unread notifications", async () => {
    myNotifications.mockResolvedValue(
      page([note(), note({ id: "n2", message: "You moved off the waitlist.", read_at: "2030-01-02T00:00:00Z" })]),
    );
    renderAt(<NotificationsPage />);
    expect(await screen.findByText("Your booking for Room A is confirmed.")).toBeInTheDocument();
    expect(screen.getByText("You moved off the waitlist.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark as read" })).toHaveLength(1);
  });

  it("marks a notification as read", async () => {
    myNotifications.mockResolvedValue(page([note()]));
    markNotificationRead.mockResolvedValue(note({ read_at: "2030-01-02T00:00:00Z" }));
    renderAt(<NotificationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
  });

  it("shows the API error when marking as read fails", async () => {
    myNotifications.mockResolvedValue(page([note()]));
    markNotificationRead.mockRejectedValue(new ApiError(404, "not_found", "Notification not found."));
    renderAt(<NotificationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Mark as read" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Notification not found.");
  });
});
