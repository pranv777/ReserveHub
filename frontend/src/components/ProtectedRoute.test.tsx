import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const state = {
  auth: { session: null as unknown, loading: false },
  me: { me: undefined as { role: string } | undefined, isLoading: false },
};
vi.mock("../lib/auth/AuthContext", () => ({
  useAuth: () => state.auth,
  useMe: () => state.me,
}));

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/signin" element={<div>signin page</div>} />
        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin" element={<div>admin area</div>} />
        </Route>
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.auth = { session: null, loading: false };
  state.me = { me: undefined, isLoading: false };
});

describe("ProtectedRoute", () => {
  it("redirects anonymous users to sign in", () => {
    renderRoutes();
    expect(screen.getByText("signin page")).toBeInTheDocument();
  });

  it("blocks signed-in members from admin pages", () => {
    state.auth = { session: { user: { id: "u" } }, loading: false };
    state.me = { me: { role: "member" }, isLoading: false };
    renderRoutes();
    expect(screen.getByRole("alert")).toHaveTextContent("Not authorised");
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("lets admins in", () => {
    state.auth = { session: { user: { id: "u" } }, loading: false };
    state.me = { me: { role: "admin" }, isLoading: false };
    renderRoutes();
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });

  it("shows a loading state while the role is resolving", () => {
    state.auth = { session: { user: { id: "u" } }, loading: false };
    state.me = { me: undefined, isLoading: true };
    renderRoutes();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
