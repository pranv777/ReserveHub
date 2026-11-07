import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { listSlots } from "../../lib/api/endpoints";
import type { SlotQuery } from "../../lib/api/types";
import { formatRange, localInputToIso } from "../../lib/format";

const PAGE_SIZE = 10;

export function DiscoveryPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ location: "", category: "", from: "", to: "", availableOnly: true });

  const query: SlotQuery = {
    page,
    page_size: PAGE_SIZE,
    location: filters.location || undefined,
    category: filters.category || undefined,
    start_from: filters.from ? localInputToIso(filters.from) : undefined,
    start_to: filters.to ? localInputToIso(filters.to) : undefined,
    available_only: filters.availableOnly || undefined,
  };
  const q = useQuery({ queryKey: ["slots", query], queryFn: () => listSlots(query) });

  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <section>
      <h1 className="text-2xl font-bold">Find a time slot</h1>
      <form className="card mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="label" htmlFor="f-location">Location</label>
          <input id="f-location" className="input" value={filters.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="f-category">Category</label>
          <input id="f-category" className="input" value={filters.category} onChange={(e) => set("category", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="f-from">From</label>
          <input id="f-from" type="datetime-local" className="input" value={filters.from} onChange={(e) => set("from", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="f-to">Until</label>
          <input id="f-to" type="datetime-local" className="input" value={filters.to} onChange={(e) => set("to", e.target.value)} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={filters.availableOnly} onChange={(e) => set("availableOnly", e.target.checked)} />
          Available only
        </label>
      </form>

      <div className="mt-4">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="No slots match your filters." onRetry={() => void q.refetch()}>
          <ul className="space-y-2" data-testid="slot-list">
            {q.data?.items.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.resource_name}</p>
                  <p className="text-sm text-slate-600">
                    {formatRange(s.start_at, s.end_at)}
                    {s.resource_location ? ` · ${s.resource_location}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={s.booked_by_me ? "confirmed" : s.is_available ? "available" : "booked"} />
                  <Link className="btn" to={`/slots/${s.id}`} aria-label={`View ${s.resource_name} ${formatRange(s.start_at, s.end_at)}`}>
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>
    </section>
  );
}
