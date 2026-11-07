import type { ReactNode } from "react";
import { errorMessage } from "../lib/api/client";

interface Props {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  children: ReactNode;
}

/** Consistent loading / error (retryable) / empty handling for list views. */
export function QueryState({ isLoading, error, isEmpty, emptyMessage, onRetry, children }: Props) {
  if (isLoading) {
    return <p role="status" className="py-8 text-center text-slate-600">Loading…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="card border-red-200 bg-red-50 text-red-800">
        <p>{errorMessage(error)}</p>
        <button type="button" className="btn mt-3" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (isEmpty) return <p className="card text-center text-slate-600">{emptyMessage}</p>;
  return <>{children}</>;
}
