import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { errorMessage } from "../../lib/api/client";
import { leaveWaitlist, myWaitlist } from "../../lib/api/endpoints";
import type { WaitlistEntry } from "../../lib/api/types";
import { formatRange } from "../../lib/format";

const PAGE_SIZE = 10;

export function WaitlistPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<WaitlistEntry | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const q = useQuery({ queryKey: ["waitlist", page], queryFn: () => myWaitlist({ page, page_size: PAGE_SIZE }), refetchInterval: 20_000 });

  const leave = useMutation({
    mutationFn: (id: string) => leaveWaitlist(id),
    onSuccess: async () => {
      setMessage({ kind: "ok", text: "You left the waitlist." });
      setTarget(null);
      await Promise.all(["waitlist", "slots", "slot"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
    onError: async (err) => {
      setMessage({ kind: "error", text: errorMessage(err) });
      setTarget(null);
      await qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });

  return (
    <section>
      <h1 className="text-2xl font-bold">My waitlist</h1>
      <p className="mt-1 text-sm text-slate-600">When a booked slot is cancelled, the person who has waited longest is promoted automatically.</p>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded p-3 text-sm ${message.kind === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
          {message.text}
        </p>
      )}
      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="You are not on any waitlists." onRetry={() => void q.refetch()}>
          <ul className="space-y-2" data-testid="waitlist-list">
            {q.data?.items.map((e) => (
              <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{e.resource_name}</p>
                  <p className="text-sm text-slate-600">{formatRange(e.slot_start_at, e.slot_end_at)}</p>
                  {e.status === "waiting" && e.position && <p className="text-sm">Position in queue: {e.position}</p>}
                  {e.status === "promoted" && (
                    <p className="text-sm text-green-800">You were promoted! <Link className="underline" to="/bookings">View your booking</Link></p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={e.status} />
                  {e.status === "waiting" && (
                    <button type="button" className="btn" onClick={() => { setMessage(null); setTarget(e); }}
                      aria-label={`Leave waitlist for ${e.resource_name}`}>
                      Leave
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
        <ConfirmDialog title="Leave this waitlist?" confirmLabel="Leave waitlist" busy={leave.isPending}
          onConfirm={() => leave.mutate(target.id)} onCancel={() => setTarget(null)}>
          You will lose your place in the queue for {target.resource_name}.
        </ConfirmDialog>
      )}
    </section>
  );
}
