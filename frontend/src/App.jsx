import { ErrorBoundary } from "./components/ui/ErrorBoundary.jsx";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Outlet,
} from "react-router-dom";
import {
  AuthProvider,
  homeFor,
  useAuth,
} from "./features/auth/AuthProvider.jsx";
import { LoginPage } from "./features/auth/LoginPage.jsx";
import { RegisterPage } from "./features/auth/RegisterPage.jsx";
import { CustomerPage } from "./pages/CustomerPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { RiderPage } from "./pages/RiderPage.jsx";
import { SuperAdminPage } from "./pages/SuperAdminPage.jsx";
import { ForgotPasswordPage } from "./features/auth/ForgotPassword.jsx";

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="screen-loader">Preparing your TasteNet workspace…</div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!(Array.isArray(role) ? role.includes(user.role) : user.role === role))
    return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function Start() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="screen-loader">Preparing your TasteNet workspace…</div>
    );
  return user ? (
    <Navigate to={homeFor(user.role)} replace />
  ) : (
    <>
      <CustomerPage />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Start />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
            </Route>
            <Route
              path="/customer"
              element={
                <Protected role="customer">
                  <CustomerPage />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <Protected role={["admin", "superadmin"]}>
                  <AdminPage />
                </Protected>
              }
            />
            <Route
              path="/rider"
              element={
                <Protected role="rider">
                  <RiderPage />
                </Protected>
              }
            />
            <Route
              path="/superadmin"
              element={
                <Protected role="superadmin">
                  <SuperAdminPage />
                </Protected>
              }
            />
            <Route path="*" element={<Start />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
