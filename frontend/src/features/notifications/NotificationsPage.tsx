import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { errorMessage } from "../../lib/api/client";
import { markNotificationRead, myNotifications } from "../../lib/api/endpoints";
import { formatDateTime } from "../../lib/format";

const PAGE_SIZE = 10;

export function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => myNotifications({ page, page_size: PAGE_SIZE }), refetchInterval: 20_000 });
  const read = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <section>
      <h1 className="text-2xl font-bold">Notifications</h1>
      {read.error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{errorMessage(read.error)}</p>}
      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="No notifications yet." onRetry={() => void q.refetch()}>
          <ul className="space-y-2" data-testid="notification-list">
            {q.data?.items.map((n) => (
              <li key={n.id} className={`card flex items-center justify-between gap-3 ${n.read_at ? "opacity-70" : "border-indigo-300"}`}>
                <div>
                  <p className={n.read_at ? "" : "font-semibold"}>{n.message}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.read_at && (
                  <button type="button" className="btn" disabled={read.isPending} onClick={() => read.mutate(n.id)}>
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>
    </section>
  );
}
