import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/permissions';
import { AppLayout } from '@/components/layout/AppLayout';
import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import SearchPage from '@/pages/shared/Search';
import BookDetails from '@/pages/shared/BookDetails';
import NotFound from '@/pages/shared/NotFound';
import AdminDashboard from '@/pages/admin/Dashboard';
import Books from '@/pages/admin/Books';
import Categories from '@/pages/admin/Categories';
import Members from '@/pages/admin/Members';
import MemberProfile from '@/pages/admin/MemberProfile';
import Circulation from '@/pages/admin/Circulation';
import Transactions from '@/pages/admin/Transactions';
import Reservations from '@/pages/admin/Reservations';
import Fines from '@/pages/admin/Fines';
import Damage from '@/pages/admin/Damage';
import Reports from '@/pages/admin/Reports';
import Settings from '@/pages/admin/Settings';
import MemberDashboard from '@/pages/member/Dashboard';
import MyBooks from '@/pages/member/MyBooks';
import MyReservations from '@/pages/member/Reservations';
import MyFines from '@/pages/member/Fines';
import Notifications from '@/pages/member/Notifications';
import Profile from '@/pages/member/Profile';

/** Route guard: signed-out users go to login, wrong-role users to their own home. */
function RequireRole({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

/** Keeps signed-in users out of the login/registration screens. */
function GuestOnly() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user.role)} replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<RequireRole />}>
        <Route element={<AppLayout />}>
          {/* Shared by both roles */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/books/:id" element={<BookDetails />} />

          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/books" element={<Books />} />
            <Route path="/admin/books/:id" element={<BookDetails />} />
            <Route path="/admin/categories" element={<Categories />} />
            <Route path="/admin/members" element={<Members />} />
            <Route path="/admin/members/:id" element={<MemberProfile />} />
            <Route path="/admin/circulation" element={<Circulation />} />
            <Route path="/admin/transactions" element={<Transactions />} />
            <Route path="/admin/reservations" element={<Reservations />} />
            <Route path="/admin/fines" element={<Fines />} />
            <Route path="/admin/damage" element={<Damage />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>

          <Route element={<RequireRole roles={['member']} />}>
            <Route path="/member" element={<Navigate to="/member/dashboard" replace />} />
            <Route path="/member/dashboard" element={<MemberDashboard />} />
            <Route path="/member/books" element={<MyBooks />} />
            <Route path="/member/reservations" element={<MyReservations />} />
            <Route path="/member/fines" element={<MyFines />} />
            <Route path="/member/notifications" element={<Notifications />} />
            <Route path="/member/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
