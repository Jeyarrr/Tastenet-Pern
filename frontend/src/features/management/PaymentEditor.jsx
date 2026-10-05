import { useAction } from "./useManagementAction.js";
import { useState } from "react";
import { api } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { FileUpload } from "../../components/forms/FileUpload.jsx";

export function PaymentEditor({ method = {}, onClose, onSaved }) {
  const [form, setForm] = useState({
      name: method.name || "",
      isEnabled: method.isEnabled ?? true,
      instructions: method.instructions || "",
      accountDetails: method.accountDetails || "",
      displayOrder: method.displayOrder || 0,
      qrPhoto: method.qrPhoto || "",
    }),
    [remove, setRemove] = useState(false);
  const { busy, error, run } = useAction(onSaved);
  return (
    <Modal
      title={method.id ? "Edit Payment Method" : "Add Payment Method"}
      onClose={onClose}
    >
      <form
        className="migration-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(() =>
              api(
                `/api/manage/payment-methods${method.id ? "/" + method.id : ""}`,
                { method: method.id ? "PUT" : "POST", body: form },
              ),
            )
          )
            onClose();
        }}
      >
        <Notice error={error} />
        <label>
          Method name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Account details
          <textarea
            maxLength={2000}
            value={form.accountDetails}
            onChange={(e) =>
              setForm({ ...form, accountDetails: e.target.value })
            }
          />
        </label>
        <label>
          Instructions
          <textarea
            maxLength={2000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
        <FileUpload
          purpose="payment-qr"
          label="Payment QR image"
          value={form.qrPhoto}
          onUploaded={(qrPhoto) => setForm({ ...form, qrPhoto })}
        />
        {form.qrPhoto && (
          <button
            type="button"
            className="migration-button"
            onClick={() => setForm({ ...form, qrPhoto: "" })}
          >
            Remove QR image
          </button>
        )}
        <div className="migration-form-row">
          <label>
            Status
            <select
              value={String(form.isEnabled)}
              onChange={(e) =>
                setForm({ ...form, isEnabled: e.target.value === "true" })
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Display order
            <input
              type="number"
              min="0"
              max="1000"
              value={form.displayOrder}
              onChange={(e) =>
                setForm({ ...form, displayOrder: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="migration-form-actions">
          {method.id && (
            <button
              type="button"
              className="migration-button danger"
              disabled={busy}
              onClick={() => setRemove(true)}
            >
              Delete Method
            </button>
          )}
          <button className="migration-button primary" disabled={busy}>
            Save Changes
          </button>
        </div>
      </form>
      {remove && (
        <Modal title="Delete Payment Method" onClose={() => setRemove(false)}>
          <p>
            Delete {form.name}? Past orders retain their payment information.
          </p>
          <Notice error={error} />
          <button
            className="migration-button danger"
            disabled={busy}
            onClick={async () => {
              if (
                await run(() =>
                  api(`/api/manage/payment-methods/${method.id}`, {
                    method: "DELETE",
                  }),
                )
              )
                onClose();
            }}
          >
            Confirm Deletion
          </button>
        </Modal>
      )}
    </Modal>
  );
}
