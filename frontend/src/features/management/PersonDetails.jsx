import { useAction } from "./useManagementAction.js";
import { AccountStatusDialog } from "./AccountStatusDialog.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { dateTime, money } from "../../lib/format.js";
import { Badge, Notice } from "../../components/ui/Feedback.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { imagePath } from "../../lib/media.js";
import { OrderDetails } from "../orders/OrderDetails.jsx";

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
