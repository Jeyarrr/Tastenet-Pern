import { useAction } from "./useManagementAction.js";
import { useState } from "react";
import { api } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";

export function QuotaEditor({ quotas, onClose, onSaved }) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  const initial = (type) => {
    const q = quotas.find((q) => q.quota_type === type);
    return {
      type,
      targetAmount: q?.target_amount || 0,
      startDate: q?.start_date?.slice(0, 10) || today,
      endDate: q?.end_date?.slice(0, 10) || today,
    };
  };
  const [form, setForm] = useState(() => initial("Monthly"));
  const { busy, error, run } = useAction(onSaved);
  return (
    <Modal title="Set Quota Targets" onClose={onClose}>
      <form
        className="migration-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(() =>
              api("/api/manage/quotas", { method: "POST", body: form }),
            )
          )
            onClose();
        }}
      >
        <Notice error={error} />
        <label>
          Quota period
          <select
            value={form.type}
            onChange={(e) => setForm(initial(e.target.value))}
          >
            {["Daily", "Weekly", "Monthly"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Target amount
          <input
            type="number"
            min="0"
            max="999999999"
            step=".01"
            required
            value={form.targetAmount}
            onChange={(e) =>
              setForm({ ...form, targetAmount: Number(e.target.value) })
            }
          />
        </label>
        <div className="migration-form-row">
          <label>
            Start date
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              required
              min={form.startDate}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </label>
        </div>
        <button className="migration-button primary" disabled={busy}>
          Save Targets
        </button>
      </form>
    </Modal>
  );
}
