import { Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AdminActivityPage } from "../features/admin/AdminActivityPage";
import { AdminResourcesPage } from "../features/admin/AdminResourcesPage";
import { SignInPage } from "../features/auth/SignInPage";
import { SlotDetailPage } from "../features/availability/SlotDetailPage";
import { MyBookingsPage } from "../features/bookings/MyBookingsPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { DiscoveryPage } from "../features/resources/DiscoveryPage";
import { WaitlistPage } from "../features/waitlist/WaitlistPage";
import { HomeRoute } from "../features/landing/LandingPage";
import { DocsPage } from "../features/docs/DocsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/availability" element={<DiscoveryPage />} />
          <Route path="/slots/:slotId" element={<SlotDetailPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin/resources" element={<AdminResourcesPage />} />
            <Route path="/admin/activity" element={<AdminActivityPage />} />
          </Route>
          <Route path="*" element={<p className="card">Page not found.</p>} />
        </Route>
      </Route>
    </Routes>
  );
}
