import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "./AuthProvider.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { PasswordInput } from "../../components/forms/PasswordInput.jsx";
import { ForgotPasswordDialog } from "./ForgotPassword.jsx";
import { useAuthCapabilities } from "./useAuthCapabilities.js";

export function LoginPage() {
  const { user, login } = useAuth(),
    capabilities = useAuthCapabilities(),
    navigate = useNavigate(),
    location = useLocation();
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [rememberMe, setRememberMe] = useState(false),
    [recovering, setRecovering] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  if (recovering)
    return <ForgotPasswordDialog onClose={() => setRecovering(false)} />;
  return (
    <Modal title="Sign In" variant="auth-login" onClose={() => navigate("/")}>
      <div className="original-login">
        <form
          className="original-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              const account = await login(identifier, password, rememberMe);
              navigate(homeFor(account.role), { replace: true });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="login-card">
            <div className="logo">
              <img src="/original-assets/LOGO.png" alt="Caballeros TasteNet" />
            </div>
            <span className="auth-eyebrow">WELCOME BACK TO CABALLEROS</span>
            <h2>Sign In</h2>
            <p className="auth-intro">
              Good food and your TasteNet account, all in one place.
            </p>
            <div className="input-box">
              <input
                aria-label="Username or email"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or email"
                required
              />
            </div>
            <div className="input-box password-box">
              <PasswordInput
                aria-label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>
            <Notice
              error={
                error ||
                (location.search.includes("error=google")
                  ? "Google sign-in could not be completed. Please try again."
                  : "")
              }
            />
            <div className="remember-forgot">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="forgot-password text-link"
                disabled={busy}
                onClick={() => setRecovering(true)}
              >
                Forgot Password?
              </button>
            </div>
            <button className="btn-login" disabled={busy}>
              {busy ? "SIGNING IN…" : "LOGIN"}
            </button>
            <p className="auth-role-note">
              Your account automatically opens your customer, rider, admin, or
              store owner portal.
            </p>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div className="social-login">
              <button
                type="button"
                className="google-btn"
                onClick={() =>
                  capabilities.google
                    ? window.location.assign("/api/auth/google")
                    : setError(
                        "Google sign-in will be available once the administrator finishes setup.",
                      )
                }
              >
                <img src="/google.svg" alt="" />
                <span>Google</span>
              </button>
            </div>
            <div className="extra-text">
              New to Caballeros?{" "}
              <Link className="create-account" to="/register">
                Create your account
              </Link>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
