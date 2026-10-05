import { passwordHelp, passwordPattern } from "../../lib/passwordPolicy.js";
import { PasswordInput } from "../../components/forms/PasswordInput.jsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  return (
    <ForgotPasswordDialog
      onClose={() => navigate("/login", { replace: true })}
    />
  );
}

export function ForgotPasswordDialog({ onClose }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const send = async () => {
    await api("/api/auth/password/request-otp", {
      method: "POST",
      body: { email },
    });
    setSent(true);
    setSuccess(
      "If an active account exists, a verification code has been sent.",
    );
  };
  const act = async (work) => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Forgot Password?" variant="auth-login" onClose={onClose}>
      <div className="original-login">
        <div className="original-form">
          <div className="login-card recovery-card">
            <div className="logo">
              <img src="/original-assets/LOGO.png" alt="Caballeros TasteNet" />
            </div>
            <span className="auth-eyebrow">LET'S GET YOU BACK IN</span>
            <h2>Forgot Password?</h2>
            <p className="auth-intro">
              Recover your TasteNet account using your email.
            </p>
            <Notice error={error} success={success} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  if (!sent) return send();
                  if (password !== confirm)
                    throw new Error("Passwords do not match");
                  await api("/api/auth/password/reset", {
                    method: "POST",
                    body: { email, code, password },
                  });
                  setSent(false);
                  setCode("");
                  setPassword("");
                  setConfirm("");
                  setSuccess(
                    "Password reset successfully. Sign in with your new password.",
                  );
                });
              }}
            >
              <div className="input-box">
                <input
                  aria-label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  readOnly={sent}
                  required
                />
              </div>
              {sent && (
                <>
                  <div className="input-box">
                    <input
                      aria-label="Verification code"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="Six-digit code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                    />
                  </div>
                  <div className="input-box">
                    <PasswordInput
                      aria-label="New password"
                      visibilityLabel="new password"
                      placeholder="New password (12+ characters)"
                      autoComplete="new-password"
                      minLength={12}
                      pattern={passwordPattern}
                      title={passwordHelp}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-box">
                    <PasswordInput
                      aria-label="Confirm password"
                      visibilityLabel="confirm password"
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <button className="btn-login" disabled={busy}>
                {busy ? "PLEASE WAIT…" : sent ? "RESET PASSWORD" : "SEND CODE"}
              </button>
              {sent && (
                <div className="extra-text">
                  <button
                    className="text-link create-account"
                    type="button"
                    disabled={busy}
                    onClick={() => act(send)}
                  >
                    Resend Code
                  </button>
                </div>
              )}
            </form>
            <div className="extra-text">
              <button
                type="button"
                className="text-link create-account"
                onClick={onClose}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
