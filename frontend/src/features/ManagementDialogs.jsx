import { AccountStatusDialog } from "./AccountStatusDialog.jsx";
import { Avatar } from "./Avatar.jsx";
import { useEffect, useState } from "react";
import { api, dateTime, money } from "../api.js";
import { Badge, Modal, Notice, imagePath } from "../components.jsx";
import { FileUpload } from "./FileUpload.jsx";
import { OrderDetails } from "./OrderDetails.jsx";

function useAction(onSaved) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const run = async (work) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await onSaved?.();
      setSuccess("Changes saved.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, success, run };
}
export function PersonDetails({ person, onClose, onSaved }) {
  const [data, setData] = useState(null),
    [form, setForm] = useState(null),
    [remove, setRemove] = useState(false),
    [order, setOrder] = useState(null),
    [notes, setNotes] = useState({}),
    [loadError, setLoadError] = useState("");
  const { busy, error, success, run } = useAction(onSaved);
  const refresh = async () => {
    const result = await api(`/api/manage/users/${person.id}/details`);
    setData(result);
    return result;
  };
  useEffect(() => {
    let active = true;
    (async () => {
      const result = await api(`/api/manage/users/${person.id}/details`);
      if (!active) return;
      setData(result);
      const u = result.user;
      setForm({
        fullName: u.full_name,
        email: u.email,
        phone: u.phone || "",
        address: u.address || "",
        vehicle: u.vehicle || "",
        vehicleModel: u.vehicle_model || "",
        licensePlate: u.license_plate || "",
      });
    })().catch((e) => {
      if (active) setLoadError(e.message);
    });
    return () => {
      active = false;
    };
  }, [person.id]);
  return (
    <Modal title={person.full_name} onClose={onClose} wide>
      <Notice error={error || loadError} success={success} />
      {!form ? (
        <p>Loading account…</p>
      ) : (
        <>
          <div className="account-detail-identity">
            <Avatar
              large
              src={data.user.profile_photo}
              name={data.user.full_name}
            />
            <div>
              <h3>{data.user.full_name}</h3>
              <p>{data.user.email}</p>
            </div>
          </div>
          <form
            className="migration-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() =>
                api(`/api/manage/users/${person.id}`, {
                  method: "PATCH",
                  body: form,
                }),
              );
            }}
          >
            <div className="migration-form-row">
              {[
                ["fullName", "Full name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["address", "Address"],
                ...(person.role === "rider"
                  ? [
                      ["vehicle", "Vehicle"],
                      ["vehicleModel", "Vehicle model"],
                      ["licensePlate", "License plate"],
                    ]
                  : []),
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required={["fullName", "email"].includes(key)}
                    type={key === "email" ? "email" : "text"}
                    maxLength={key === "address" ? 1000 : 200}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <button className="migration-button primary" disabled={busy}>
              Save Account
            </button>
          </form>
          {person.role === "rider" && (
            <section>
              <h3>Rider Documents</h3>
              <div className="document-grid">
                {data.documents.map((doc) => (
                  <div className="document-card" key={doc.column}>
                    <h4>{doc.column.replaceAll("_", " ")}</h4>
                    <Badge value={doc.status} />
                    {doc.url ? (
                      <>
                        <p>
                          <a
                            href={imagePath(doc.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open document
                          </a>
                        </p>
                        <label className="migration-form">
                          Review notes
                          <textarea
                            aria-label={`Review notes for ${doc.column}`}
                            value={notes[doc.column] ?? doc.review_notes ?? ""}
                            maxLength={1000}
                            onChange={(e) =>
                              setNotes({
                                ...notes,
                                [doc.column]: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="migration-form-actions">
                          {["approved", "rejected"].map((status) => (
                            <button
                              key={status}
                              className={`migration-button ${status === "approved" ? "primary" : "danger"}`}
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    `/api/manage/users/${person.id}/documents/${doc.column}`,
                                    {
                                      method: "PATCH",
                                      body: {
                                        status,
                                        notes:
                                          notes[doc.column] ??
                                          doc.review_notes ??
                                          "",
                                      },
                                    },
                                  );
                                  await refresh();
                                })
                              }
                            >
                              {status === "approved" ? "Approve" : "Reject"}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="muted">No document uploaded.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <h3>Order History</h3>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="migration-button"
                        onClick={() => setOrder(item)}
                      >
                        {item.ticket_number}
                      </button>
                    </td>
                    <td>{dateTime(item.created_at)}</td>
                    <td>
                      <Badge value={item.status} />
                    </td>
                    <td>{money(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.orders.length && <p>No orders recorded.</p>}
          </div>
          <div className="migration-form-actions">
            <button
              className="migration-button danger"
              disabled={busy}
              onClick={() => setRemove(true)}
            >
              Remove Account
            </button>
          </div>
          {remove && (
            <AccountStatusDialog
              archive
              person={person}
              onClose={() => setRemove(false)}
              onSaved={async () => {
                await onSaved?.();
                onClose();
              }}
            />
          )}
          {order && (
            <OrderDetails order={order} onClose={() => setOrder(null)} />
          )}
        </>
      )}
    </Modal>
  );
}
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
