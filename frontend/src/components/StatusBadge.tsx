const STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  available: "bg-green-100 text-green-800",
  promoted: "bg-green-100 text-green-800",
  waiting: "bg-amber-100 text-amber-800",
  booked: "bg-slate-200 text-slate-800",
  cancelled: "bg-slate-200 text-slate-700",
  expired: "bg-slate-200 text-slate-700",
  inactive: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? "bg-slate-100 text-slate-800"}`}>{status}</span>;
}
