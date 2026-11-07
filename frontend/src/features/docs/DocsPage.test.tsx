import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocsPage } from "./DocsPage";

const state = { session: null as unknown };
vi.mock("../../lib/auth/AuthContext", () => ({ useAuth: () => ({ session: state.session }) }));

const renderDocs = () =>
  render(
    <MemoryRouter>
      <DocsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.session = null;
});

describe("DocsPage", () => {
  it("has a title and the main sections", () => {
    renderDocs();
    expect(screen.getByRole("heading", { level: 1, name: "ReserveHub documentation" })).toBeInTheDocument();
    for (const name of ["Getting started", "The waitlist", "For administrators", "Rules at a glance"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("links every table-of-contents entry to a section that exists", () => {
    renderDocs();
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("#"));
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), `section #${id}`).not.toBeNull();
    }
  });

  it("offers Sign in to visitors", () => {
    renderDocs();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });

  it("offers Open app to signed-in users", () => {
    state.session = { user: { id: "u1" } };
    renderDocs();
    expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/availability");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
