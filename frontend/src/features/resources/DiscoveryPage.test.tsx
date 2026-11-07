import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { Slot } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { DiscoveryPage } from "./DiscoveryPage";

const listSlots = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({ listSlots: (...a: unknown[]) => listSlots(...a) }));

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: "s1", resource_id: "r1", resource_name: "Room A", resource_location: "Floor 2", resource_category: "room",
  resource_active: true, start_at: "2030-01-01T10:00:00Z", end_at: "2030-01-01T11:00:00Z",
  is_available: true, booked_by_me: false, waitlist_count: 0, ...over,
});
const page = (items: Slot[], total = items.length) => ({ items, total, page: 1, page_size: 10 });

beforeEach(() => listSlots.mockReset());

describe("DiscoveryPage", () => {
  it("lists slots with a status and a link to each one", async () => {
    listSlots.mockResolvedValue(
      page([
        slot({ id: "s1", resource_name: "Room A", resource_location: "Floor 9" }),
        slot({ id: "s2", resource_name: "Court 1", is_available: false }),
        slot({ id: "s3", resource_name: "Lab", is_available: false, booked_by_me: true }),
      ]),
    );
    renderAt(<DiscoveryPage />);
    expect(await screen.findByText("Room A")).toBeInTheDocument();
    expect(screen.getByText(/Floor 9/)).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(screen.getByText("booked")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Room A/ })).toHaveAttribute("href", "/slots/s1");
  });

  it("starts with available slots only and the first page", async () => {
    listSlots.mockResolvedValue(page([slot()]));
    renderAt(<DiscoveryPage />);
    await screen.findByText("Room A");
    expect(listSlots).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 10, available_only: true }));
  });

  it("sends text filters to the API", async () => {
    listSlots.mockResolvedValue(page([slot()]));
    renderAt(<DiscoveryPage />);
    await screen.findByText("Room A");
    await userEvent.type(screen.getByLabelText("Location"), "Floor 2");
    await userEvent.type(screen.getByLabelText("Category"), "room");
    await waitFor(() =>
      expect(listSlots).toHaveBeenLastCalledWith(expect.objectContaining({ location: "Floor 2", category: "room" })),
    );
  });

  it("converts the date filters to UTC and can include booked slots", async () => {
    listSlots.mockResolvedValue(page([slot()]));
    renderAt(<DiscoveryPage />);
    await screen.findByText("Room A");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2030-01-01T10:00" } });
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: "2030-01-02T10:00" } });
    await userEvent.click(screen.getByLabelText("Available only"));
    await waitFor(() => {
      const q = listSlots.mock.lastCall?.[0];
      expect(q.start_from).toBe(new Date("2030-01-01T10:00").toISOString());
      expect(q.start_to).toBe(new Date("2030-01-02T10:00").toISOString());
      expect(q.available_only).toBeUndefined();
    });
  });

  it("pages forward and returns to page 1 when a filter changes", async () => {
    listSlots.mockResolvedValue(page([slot()], 25));
    renderAt(<DiscoveryPage />);
    expect(await screen.findByText("Page 1 of 3 · 25 total")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3 · 25 total")).toBeInTheDocument();
    expect(listSlots).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await userEvent.type(screen.getByLabelText("Location"), "x");
    expect(await screen.findByText("Page 1 of 3 · 25 total")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    listSlots.mockResolvedValue(page([]));
    renderAt(<DiscoveryPage />);
    expect(await screen.findByText("No slots match your filters.")).toBeInTheDocument();
  });

  it("shows a retryable error", async () => {
    listSlots
      .mockRejectedValueOnce(new ApiError(0, "network_error", "Cannot reach the server."))
      .mockResolvedValue(page([slot()]));
    renderAt(<DiscoveryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Room A")).toBeInTheDocument();
  });
});
