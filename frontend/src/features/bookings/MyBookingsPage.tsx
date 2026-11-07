import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { errorMessage } from "../../lib/api/client";
import { cancelBooking, myBookings } from "../../lib/api/endpoints";
import type { Booking } from "../../lib/api/types";
import { formatDateTime, formatRange } from "../../lib/format";

const PAGE_SIZE = 10;

export function MyBookingsPage() {
  const qc = useQueryClient();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Booking | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const q = useQuery({ queryKey: ["bookings", when, page], queryFn: () => myBookings({ when, page, page_size: PAGE_SIZE }) });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: async (b) => {
      setMessage({ kind: "ok", text: `Your booking for ${b.resource_name} was cancelled.` });
      setTarget(null);
      await Promise.all(["bookings", "slots", "slot", "waitlist", "notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
    onError: async (err) => {
      setMessage({ kind: "error", text: errorMessage(err) });
      setTarget(null);
      await qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  return (
    <section>
      <h1 className="text-2xl font-bold">My bookings</h1>
      <div role="tablist" aria-label="Booking filter" className="mt-4 flex gap-2">
        {(["upcoming", "past"] as const).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={when === w}
            className={`btn ${when === w ? "btn-primary" : ""}`} onClick={() => { setWhen(w); setPage(1); }}>
            {w === "upcoming" ? "Upcoming" : "History"}
          </button>
        ))}
      </div>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded p-3 text-sm ${message.kind === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage={when === "upcoming" ? "You have no upcoming bookings." : "No booking history yet."}
          onRetry={() => void q.refetch()}>
          <ul className="space-y-2" data-testid="booking-list">
            {q.data?.items.map((b) => (
              <li key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{b.resource_name}</p>
                  <p className="text-sm text-slate-600">{formatRange(b.slot_start_at, b.slot_end_at)}</p>
                  <p className="text-xs text-slate-500">
                    Booked {formatDateTime(b.created_at)}{b.source === "waitlist" ? " (from waitlist)" : ""}
                    {b.cancelled_at ? ` · Cancelled ${formatDateTime(b.cancelled_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  {b.status === "confirmed" && new Date(b.slot_start_at) > new Date() && (
                    <button type="button" className="btn" onClick={() => { setMessage(null); setTarget(b); }}
                      aria-label={`Cancel booking for ${b.resource_name}`}>
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>
      {target && (
        <ConfirmDialog title="Cancel this booking?" confirmLabel="Yes, cancel booking"
          busy={cancel.isPending} onConfirm={() => cancel.mutate(target.id)} onCancel={() => setTarget(null)}>
          {target.resource_name}, {formatRange(target.slot_start_at, target.slot_end_at)}. If people are waiting,
          the next person will get this slot immediately.
        </ConfirmDialog>
      )}
    </section>
  );
}
