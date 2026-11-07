import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ApiError } from "../lib/api/client";
import { AuthProvider } from "../lib/auth/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            // Never retry client errors (401/403/404/409/422); retry only network/5xx once.
            retry: (count, err) => count < 1 && (!(err instanceof ApiError) || err.status === 0 || err.status >= 500),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
