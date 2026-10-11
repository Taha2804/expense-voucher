import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, homeRouteForRole } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/login/LoginPage';
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyVouchersPage } from './pages/employee/MyVouchersPage';
import { CreateVoucherPage } from './pages/employee/CreateVoucherPage';
import { EditVoucherPage } from './pages/employee/EditVoucherPage';
import { DirectorDashboard } from './pages/director/DirectorDashboard';
import { PendingApprovalsPage } from './pages/director/PendingApprovalsPage';
import { DirectorAllVouchersPage } from './pages/director/AllVouchersPage';
import { AccountsDashboard } from './pages/accounts/AccountsDashboard';
import { AccountsAllVouchersPage } from './pages/accounts/AllVouchersPage';
import { VoucherDetailsPage } from './pages/shared/VoucherDetailsPage';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeRouteForRole(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route element={<AppLayout />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
              <Route path="/employee/vouchers" element={<MyVouchersPage />} />
              <Route path="/employee/vouchers/new" element={<CreateVoucherPage />} />
              <Route
                path="/employee/vouchers/:id"
                element={<VoucherDetailsPage listPath="/employee/vouchers" />}
              />
              <Route path="/employee/vouchers/:id/edit" element={<EditVoucherPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['DIRECTOR']} />}>
            <Route element={<AppLayout />}>
              <Route path="/director" element={<DirectorDashboard />} />
              <Route path="/director/pending" element={<PendingApprovalsPage />} />
              <Route path="/director/vouchers" element={<DirectorAllVouchersPage />} />
              <Route
                path="/director/vouchers/:id"
                element={<VoucherDetailsPage listPath="/director/vouchers" />}
              />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['ACCOUNTS']} />}>
            <Route element={<AppLayout />}>
              <Route path="/accounts" element={<AccountsDashboard />} />
              <Route path="/accounts/vouchers" element={<AccountsAllVouchersPage />} />
              <Route
                path="/accounts/vouchers/:id"
                element={<VoucherDetailsPage listPath="/accounts/vouchers" />}
              />
            </Route>
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
