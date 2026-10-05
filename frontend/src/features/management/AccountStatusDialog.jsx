import { useState } from "react";
import { api } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { PasswordInput } from "../../components/forms/PasswordInput.jsx";

export function AccountStatusDialog({
  person,
  onClose,
  onSaved,
  archive = false,
}) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const action = archive
    ? "Remove"
    : person.is_active
      ? "Deactivate"
      : "Activate";
  return (
    <Modal title={`${action} Account`} onClose={onClose}>
      <p>
        {action} the account for <strong>{person.full_name}</strong>?
      </p>
      <form
        className="migration-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setBusy(true);
          try {
            await api(
              `/api/manage/users/${person.id}${archive ? "" : "/active"}`,
              {
                method: archive ? "DELETE" : "PATCH",
                body: {
                  ...(archive ? {} : { isActive: !person.is_active }),
                  currentPassword: password,
                },
              },
            );
            await onSaved?.();
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Confirm your superadmin password
          <PasswordInput
            aria-label="Superadmin password"
            visibilityLabel="superadmin password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Notice error={error} />
        <div className="migration-form-actions">
          <button
            type="button"
            className="migration-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="migration-button primary"
            disabled={busy || !password}
          >
            {busy ? "Confirming…" : "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
