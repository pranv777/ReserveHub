import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { myNotifications } from "../lib/api/endpoints";
import { useAuth, useMe } from "../lib/auth/AuthContext";
import { localTimeZone } from "../lib/format";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-indigo-100 text-indigo-900" : "text-slate-700 hover:bg-slate-100"}`;

export function Layout() {
  const { signOut } = useAuth();
  const { me } = useMe();
  const navigate = useNavigate();
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => myNotifications({ unread_only: true, page_size: 1 }),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-bold text-indigo-800">ReserveHub</span>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            <NavLink to="/availability" end className={link}>Availability</NavLink>
            <NavLink to="/bookings" className={link}>My bookings</NavLink>
            <NavLink to="/waitlist" className={link}>Waitlist</NavLink>
            <NavLink to="/notifications" className={link}>
              Notifications{unread.data && unread.data.total > 0 ? ` (${unread.data.total})` : ""}
            </NavLink>
            {me?.role === "admin" && (
              <>
                <NavLink to="/admin/resources" className={link}>Manage resources</NavLink>
                <NavLink to="/admin/activity" className={link}>Bookings &amp; audit</NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{me?.email}</span>
            <button
              type="button"
              className="btn"
              onClick={() => void signOut().then(() => navigate("/signin"))}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500">
        All times are shown in your local time zone ({localTimeZone()}) and stored in UTC.
      </footer>
    </div>
  );
}
