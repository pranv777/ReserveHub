import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

export function renderAt(ui: ReactElement, opts: { route?: string; path?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const route = opts.route ?? "/";
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={opts.path ?? "*"} element={ui} />
          <Route path="/bookings" element={<div>bookings page</div>} />
          <Route path="/signin" element={<div>signin page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
