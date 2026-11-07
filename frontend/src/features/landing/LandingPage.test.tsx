import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeRoute } from "./LandingPage";

const state = { session: null as unknown, loading: false };
vi.mock("../../lib/auth/AuthContext", () => ({
  useAuth: () => ({ session: state.session, loading: state.loading }),
}));

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/availability" element={<div>availability page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.session = null;
  state.loading = false;
});

describe("HomeRoute and landing page", () => {
  it("shows the homepage to visitors with the main sections", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Book a slot. If it's taken, join the line.");
    expect(screen.getByRole("heading", { name: "What ReserveHub is for" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What's built in" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "About" })[0]).toHaveAttribute("href", "#about");
    expect(screen.getAllByRole("link", { name: "Features" })[0]).toHaveAttribute("href", "#features");
  });

  it("points sign-in and sign-up links to the right places", () => {
    renderHome();
    for (const link of screen.getAllByRole("link", { name: "Sign in" })) {
      expect(link).toHaveAttribute("href", "/signin");
    }
    for (const link of screen.getAllByRole("link", { name: "Create an account" })) {
      expect(link).toHaveAttribute("href", "/signin?mode=signup");
    }
  });

  it("links to the documentation page", () => {
    renderHome();
    const links = screen.getAllByRole("link", { name: "Documentation" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", "/docs");
  });

  it("redirects signed-in users to the app", () => {
    state.session = { user: { id: "u1" } };
    renderHome();
    expect(screen.getByText("availability page")).toBeInTheDocument();
  });

  it("shows a loading state while the session is resolving", () => {
    state.loading = true;
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
