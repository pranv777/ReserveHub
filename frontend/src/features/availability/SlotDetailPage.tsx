import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError, errorMessage } from "../../lib/api/client";
import { createBooking, getSlot, joinWaitlist } from "../../lib/api/endpoints";
import { formatRange } from "../../lib/format";

export function SlotDetailPage() {
  const { slotId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  // One key per booking attempt: retries/double-clicks reuse it, so the API creates at most one booking.
  const keyRef = useRef<string>(crypto.randomUUID());
  const inFlight = useRef(false);

  const slot = useQuery({ queryKey: ["slot", slotId], queryFn: () => getSlot(slotId), enabled: !!slotId });

  const invalidate = () =>
    Promise.all(["slots", "slot", "bookings", "waitlist", "notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  const book = useMutation({
    mutationFn: () => createBooking(slotId, keyRef.current),
    onSuccess: async () => {
      await invalidate();
      navigate("/bookings");
    },
    onError: async (err) => {
      setConflict(errorMessage(err));
      setConfirming(false);
      keyRef.current = crypto.randomUUID(); // a new attempt after a failure gets a new key
      await invalidate(); // show the authoritative state
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const wait = useMutation({
    mutationFn: () => joinWaitlist(slotId),
    onSuccess: async () => {
      await invalidate();
      navigate("/waitlist");
    },
    onError: (err) => setConflict(errorMessage(err)),
  });

  const confirm = () => {
    if (inFlight.current) return; // synchronous guard against double clicks
    inFlight.current = true;
    setConflict(null);
    book.mutate();
  };

  const s = slot.data;
  return (
    <section>
      <Link to="/" className="text-sm text-indigo-700 underline">← Back to availability</Link>
      <QueryState isLoading={slot.isLoading} error={slot.error} isEmpty={!s} emptyMessage="Slot not found."
        onRetry={() => void slot.refetch()}>
        {s && (
          <div className="card mt-4 max-w-xl">
            <h1 className="text-2xl font-bold">{s.resource_name}</h1>
            <p className="mt-1 text-slate-700">{formatRange(s.start_at, s.end_at)}</p>
            {s.resource_location && <p className="text-sm text-slate-600">{s.resource_location}</p>}
            <p className="mt-3 flex items-center gap-2">
              <StatusBadge status={s.booked_by_me ? "confirmed" : s.is_available ? "available" : "booked"} />
              {s.waitlist_count > 0 && <span className="text-sm text-slate-600">{s.waitlist_count} on the waitlist</span>}
            </p>

            {conflict && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{conflict}</p>}

            {s.booked_by_me && <p className="mt-4 text-sm">You hold this slot. <Link className="underline" to="/bookings">View my bookings</Link></p>}

            {s.is_available && !confirming && (
              <button type="button" className="btn btn-primary mt-4" onClick={() => setConfirming(true)}>Book this slot</button>
            )}
            {s.is_available && confirming && (
              <div className="mt-4 rounded border border-indigo-200 bg-indigo-50 p-3" aria-live="polite">
                <p className="text-sm">Confirm booking {s.resource_name}, {formatRange(s.start_at, s.end_at)}?</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={confirm} disabled={book.isPending}>
                    {book.isPending ? "Booking…" : "Confirm booking"}
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={book.isPending}>Cancel</button>
                </div>
              </div>
            )}
            {!s.is_available && !s.booked_by_me && s.resource_active && (
              <button type="button" className="btn mt-4" onClick={() => wait.mutate()} disabled={wait.isPending}>
                {wait.isPending ? "Joining…" : "Join the waitlist"}
              </button>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}

export { ApiError };
