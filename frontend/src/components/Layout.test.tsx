import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../test/utils";
import { Layout } from "./Layout";

const state = { me: { email: "m@example.com", role: "member" } };
const signOut = vi.fn();
const myNotifications = vi.fn();
vi.mock("../lib/auth/AuthContext", () => ({
  useAuth: () => ({ signOut }),
  useMe: () => ({ me: state.me, isLoading: false }),
}));
vi.mock("../lib/api/endpoints", () => ({ myNotifications: (...a: unknown[]) => myNotifications(...a) }));

beforeEach(() => {
  state.me = { email: "m@example.com", role: "member" };
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  myNotifications.mockReset();
  myNotifications.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
});

describe("Layout", () => {
  it("shows member navigation without admin links", async () => {
    renderAt(<Layout />);
    expect(await screen.findByRole("link", { name: "Availability" })).toHaveAttribute("href", "/availability");
    expect(screen.getByRole("link", { name: "My bookings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Waitlist" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage resources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bookings & audit" })).not.toBeInTheDocument();
    expect(screen.getByText("m@example.com")).toBeInTheDocument();
    expect(screen.getByText(/All times are shown in your local time zone/)).toBeInTheDocument();
  });

  it("shows admin links for administrators", async () => {
    state.me = { email: "a@example.com", role: "admin" };
    renderAt(<Layout />);
    expect(await screen.findByRole("link", { name: "Manage resources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bookings & audit" })).toBeInTheDocument();
  });

  it("shows the unread notification count", async () => {
    myNotifications.mockResolvedValue({ items: [], total: 3, page: 1, page_size: 1 });
    renderAt(<Layout />);
    expect(await screen.findByRole("link", { name: "Notifications (3)" })).toBeInTheDocument();
    expect(myNotifications).toHaveBeenCalledWith({ unread_only: true, page_size: 1 });
  });

  it("signs out and returns to the sign-in page", async () => {
    renderAt(<Layout />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("signin page")).toBeInTheDocument();
  });
});
