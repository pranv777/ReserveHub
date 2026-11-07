import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const state = { session: null as unknown, role: "member" };
vi.mock("../lib/auth/AuthContext", () => ({
  useAuth: () => ({
    session: state.session, loading: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
    verifySignupOtp: vi.fn(), resendSignupOtp: vi.fn(),
  }),
  useMe: () => ({
    me: state.session ? { id: "u1", email: "m@example.com", display_name: null, role: state.role } : undefined,
    isLoading: false,
  }),
}));
vi.mock("../lib/api/endpoints", () => ({
  listSlots: () => Promise.resolve({ items: [], total: 0, page: 1, page_size: 10 }),
  myNotifications: () => Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 }),
}));

function renderApp(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.session = null;
  state.role = "member";
});

describe("App routing", () => {
  it("shows the homepage to visitors", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { level: 1, name: "Book a slot. If it's taken, join the line." })).toBeInTheDocument();
  });

  it("sends visitors from a protected page to sign in", () => {
    renderApp("/availability");
    expect(screen.getByRole("heading", { name: "Sign in to ReserveHub" })).toBeInTheDocument();
  });

  it("sends signed-in users from the homepage to availability", async () => {
    state.session = { user: { id: "u1" } };
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Find a time slot" })).toBeInTheDocument();
  });

  it("shows a not-found message inside the app for unknown pages", async () => {
    state.session = { user: { id: "u1" } };
    renderApp("/nope");
    expect(await screen.findByText("Page not found.")).toBeInTheDocument();
  });

  it("blocks members from admin pages", async () => {
    state.session = { user: { id: "u1" } };
    renderApp("/admin/resources");
    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorised");
  });

  it("shows the documentation to visitors", () => {
    renderApp("/docs");
    expect(screen.getByRole("heading", { level: 1, name: "ReserveHub documentation" })).toBeInTheDocument();
  });
});
