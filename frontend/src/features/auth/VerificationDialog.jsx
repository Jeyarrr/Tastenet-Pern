import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";

export function VerificationDialog({ email, onClose, onResend, onVerified }) {
  const navigate = useNavigate(),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Verify your email" onClose={onClose}>
      <p>
        Enter the six-digit code sent to {email}. The code expires after 10
        minutes.
      </p>
      <form
        className="migration-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await api("/api/auth/register/verify", {
              method: "POST",
              body: { email, code },
            });
            if (onVerified) onVerified();
            else navigate("/login", { state: { created: true } });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Notice error={error} success={success} />
        <label>
          Verification code
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </label>
        <button className="migration-button primary" disabled={busy}>
          Verify Email
        </button>
        <button
          type="button"
          className="migration-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setSuccess("");
            try {
              await onResend();
              setSuccess("A new code was sent.");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Resend Code
        </button>
      </form>
    </Modal>
  );
}
