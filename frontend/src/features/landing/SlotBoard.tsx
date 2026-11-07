import { useEffect, useState } from "react";

const STEP_MS = 2200;
const CAPTIONS = [
  "Asha has booked the 14:00 slot.",
  "Ben joins the waitlist.",
  "Chen joins the waitlist behind Ben.",
  "Asha cancels. Ben gets the slot in the same step.",
];

function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [reduced, setReduced] = useState(() => (supported ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [supported]);
  return reduced;
}

/** Decorative illustration of a cancellation promoting the first person on the waitlist. */
export function SlotBoard() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 5), STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // Ticks 0-4: the last two ticks hold the final state before the loop restarts.
  const step = reduced ? 3 : Math.min(tick, 3);
  const promoted = step >= 3;
  const holder = promoted ? "Ben" : "Asha";
  const queue = step === 0 ? [] : step === 1 ? ["Ben"] : step === 2 ? ["Ben", "Chen"] : ["Chen"];

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <div aria-hidden="true" className="relative">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-indigo-900/10">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-lg font-bold text-[#14213D]">Studio B</p>
            <p className="text-sm text-slate-500">Thu, 14:00–15:00</p>
          </div>

          <div
            className={`mt-4 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors duration-500 motion-reduce:transition-none ${
              promoted ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div>
              <p className="text-xs text-slate-500">Booked by</p>
              <p key={holder} className="rh-pop font-display text-xl font-bold text-[#14213D]">{holder}</p>
            </div>
            <span className={`badge ${promoted ? "bg-emerald-100 text-emerald-900" : "bg-indigo-100 text-indigo-900"}`}>
              {promoted ? "Booked from waitlist" : "Booked"}
            </span>
          </div>

          <p className="mt-5 text-xs font-medium text-slate-500">Waitlist, first come first served</p>
          <ul className="mt-2 min-h-[5.5rem] space-y-2">
            {queue.length === 0 && <li className="text-sm text-slate-400">Nobody waiting</li>}
            {queue.map((name, i) => (
              <li key={name} className="rh-pop flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{name}</span>
                <span className="badge bg-amber-100 text-amber-900">Position {i + 1}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 min-h-10 text-sm text-slate-600">{CAPTIONS[step]}</p>
        </div>

        {promoted && (
          <div className="rh-pop absolute -bottom-6 right-3 flex max-w-[16rem] items-start gap-2 rounded-lg bg-[#14213D] px-3 py-2 text-xs text-white shadow-lg">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span>Notification: you moved off the waitlist and booked Studio B.</span>
          </div>
        )}
      </div>
      <p className="sr-only">
        Example: when Asha cancels her booking, Ben, who is first on the waitlist, is given the slot straight away.
      </p>
      <p className="mt-8 text-center text-xs text-slate-500">Illustration with example names.</p>
    </div>
  );
}
