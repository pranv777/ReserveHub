import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth, useMe } from "../lib/auth/AuthContext";

/** UI gating only. Every API operation is independently authorised by the backend. */
export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { session, loading } = useAuth();
  const { me, isLoading } = useMe();

  if (loading || (session && requireAdmin && isLoading)) {
    return <p role="status" className="p-8 text-center">Loading…</p>;
  }
  if (!session) return <Navigate to="/signin" replace />;
  if (requireAdmin && me?.role !== "admin") {
    return (
      <div role="alert" className="card mx-auto mt-12 max-w-md text-center">
        <h1 className="text-lg font-semibold">Not authorised</h1>
        <p className="mt-2 text-slate-600">You need administrator access to view this page.</p>
        <Link className="btn mt-4" to="/availability">Back to availability</Link>
      </div>
    );
  }
  return <Outlet />;
}
