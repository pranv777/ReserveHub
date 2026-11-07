import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { adminBookings, auditEvents } from "../../lib/api/endpoints";
import { formatDateTime, formatRange } from "../../lib/format";

const PAGE_SIZE = 15;

function BookingsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const q = useQuery({ queryKey: ["admin-bookings", page, status], queryFn: () => adminBookings({ page, page_size: PAGE_SIZE, status: status || undefined }) });
  return (
    <div>
      <label className="label mt-4" htmlFor="b-status">Status</label>
      <select id="b-status" className="input max-w-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="No bookings found." onRetry={() => void q.refetch()}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="admin-bookings-table">
              <thead><tr><th className="p-2">Resource</th><th className="p-2">Slot</th><th className="p-2">Member</th><th className="p-2">Status</th><th className="p-2">Booked</th></tr></thead>
              <tbody>
                {q.data?.items.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">{b.resource_name}</td>
                    <td className="p-2">{formatRange(b.slot_start_at, b.slot_end_at)}</td>
                    <td className="p-2">{b.user_email ?? b.user_id}</td>
                    <td className="p-2"><StatusBadge status={b.status} /></td>
                    <td className="p-2">{formatDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>
    </div>
  );
}

function AuditTab() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const q = useQuery({ queryKey: ["admin-audit", page, eventType], queryFn: () => auditEvents({ page, page_size: PAGE_SIZE, event_type: eventType || undefined }) });
  return (
    <div>
      <label className="label mt-4" htmlFor="a-type">Event type</label>
      <input id="a-type" className="input max-w-xs" placeholder="e.g. booking.created" value={eventType}
        onChange={(e) => { setEventType(e.target.value); setPage(1); }} />
      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="No audit events found." onRetry={() => void q.refetch()}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="audit-table">
              <thead><tr><th className="p-2">When</th><th className="p-2">Event</th><th className="p-2">Target</th><th className="p-2">Actor</th></tr></thead>
              <tbody>
                {q.data?.items.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{formatDateTime(e.created_at)}</td>
                    <td className="p-2 font-mono">{e.event_type}</td>
                    <td className="p-2">{e.target_type}</td>
                    <td className="p-2 font-mono text-xs">{e.actor_id ?? "system"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>
    </div>
  );
}

export function AdminActivityPage() {
  const [tab, setTab] = useState<"bookings" | "audit">("bookings");
  return (
    <section>
      <h1 className="text-2xl font-bold">Bookings &amp; audit</h1>
      <div role="tablist" aria-label="Admin views" className="mt-4 flex gap-2">
        {(["bookings", "audit"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? "btn-primary" : ""}`} onClick={() => setTab(t)}>
            {t === "bookings" ? "All bookings" : "Audit events"}
          </button>
        ))}
      </div>
      {tab === "bookings" ? <BookingsTab /> : <AuditTab />}
    </section>
  );
}
