import { useEffect, useState } from "react";
import { api, dateTime, money } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, Notice, Badge, Icon, imagePath } from "../components.jsx";
import { FileUpload } from "./FileUpload.jsx";

export function OrderDetails({ order, onClose, onChanged, onReorder }) {
  const { user } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [pendingStatus, setPendingStatus] = useState(null);
  const refresh = async () =>
    setData(await api(`/api/orders/${order.id}/details`));
  useEffect(() => {
    const controller = new AbortController();
    api(`/api/orders/${order.id}/details`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [order.id]);
  const action = async (work, message) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
      await onChanged?.();
      setSuccess(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={order.ticket_number} onClose={onClose} wide>
      <Notice error={error} success={success} />
      {!data ? (
        <p>Loading order details…</p>
      ) : (
        <>
          <div className="migration-order-row">
            <Badge value={data.order.status} />
            <span>{dateTime(data.order.created_at)}</span>
          </div>
          <dl className="migration-detail-grid">
            <div>
              <dt>Order type</dt>
              <dd>{data.order.order_type}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{data.order.payment_method}</dd>
            </div>
            <div>
              <dt>Delivery address</dt>
              <dd>{data.order.delivery_address || "Not applicable"}</dd>
            </div>
            <div>
              <dt>Instructions</dt>
              <dd>{data.order.special_instructions || "None"}</dd>
            </div>
          </dl>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Instructions</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.food_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.special_instructions || "—"}</td>
                    <td>{money(item.sub_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.order.delivery_fee !== null && (
            <p>Delivery fee: {money(data.order.delivery_fee)}</p>
          )}
          <h3>Total: {money(data.order.total_amount)}</h3>
          {data.proofs.length > 0 && (
            <div className="proof-grid">
              {data.proofs.flatMap((proof) =>
                [
                  ["Delivery proof", proof.proof_of_delivery],
                  ["Payment proof", proof.proof_of_payment],
                ]
                  .filter(([, url]) => url)
                  .map(([label, url]) => (
                    <a
                      key={proof.id + label}
                      href={imagePath(url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={imagePath(url)} alt={label} />
                      <span>{label}</span>
                    </a>
                  )),
              )}
            </div>
          )}
          {user.role === "customer" &&
            !["Completed", "Cancelled"].includes(data.order.status) && (
              <FileUpload
                purpose="payment-proof"
                ticketId={order.id}
                label="Payment receipt"
                onUploaded={(url) =>
                  action(
                    () =>
                      api(`/api/orders/${order.id}/payment-proof`, {
                        method: "POST",
                        body: { url },
                      }),
                    "Payment proof submitted.",
                  )
                }
              />
            )}
          {user.role === "customer" &&
            data.order.status === "Completed" &&
            (data.rating ? (
              <p>
                <Icon name="star" /> Your rating: {data.rating.rating}/5 —{" "}
                {data.rating.comment}
              </p>
            ) : (
              <form
                className="migration-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(
                    () =>
                      api(`/api/orders/${order.id}/rating`, {
                        method: "POST",
                        body: { rating, comment },
                      }),
                    "Thank you for your rating.",
                  );
                }}
              >
                <fieldset className="rating-picker">
                  <legend>Rate your meal</legend>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                      />
                      <span>
                        <Icon name="star" /> {value}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label>
                  Comment (optional)
                  <textarea
                    value={comment}
                    maxLength={1000}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button className="migration-button primary" disabled={busy}>
                  Submit Rating
                </button>
              </form>
            ))}
          {user.role === "customer" && data.order.status === "In Progress" && (
            <button
              className="migration-button primary"
              disabled={busy}
              onClick={() => setPendingStatus("Completed")}
            >
              Confirm Receipt
            </button>
          )}
          {["admin", "superadmin"].includes(user.role) &&
            !["Completed", "Cancelled"].includes(data.order.status) && (
              <div className="migration-form-actions">
                <button
                  className="migration-button danger"
                  disabled={busy}
                  onClick={() => setPendingStatus("Cancelled")}
                >
                  Cancel Ticket
                </button>
                <button
                  className="migration-button primary"
                  disabled={busy}
                  onClick={() =>
                    setPendingStatus(
                      data.order.status === "Open"
                        ? "In Progress"
                        : "Completed",
                    )
                  }
                >
                  {data.order.status === "Open"
                    ? "Start Preparation"
                    : "Complete Ticket"}
                </button>
              </div>
            )}
          {pendingStatus && (
            <Modal
              title={
                user.role === "customer"
                  ? "Confirm Receipt"
                  : "Update Ticket Status"
              }
              onClose={() => setPendingStatus(null)}
            >
              <Notice error={error} />
              <p>
                {user.role === "customer"
                  ? "Confirm that you have received your order?"
                  : `Change this ticket to ${pendingStatus}?`}
              </p>
              <button
                className="migration-button primary"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await api(`/api/orders/${order.id}/status`, {
                      method: "PATCH",
                      body: { status: pendingStatus },
                    });
                    setPendingStatus(null);
                  }, "Order updated.")
                }
              >
                Confirm
              </button>
            </Modal>
          )}
          {onReorder && (
            <button
              className="migration-button gold"
              disabled={busy}
              onClick={() => onReorder(data.items)}
            >
              <Icon name="rotate-right" /> Order Again
            </button>
          )}
          {data.history.length > 0 && (
            <>
              <h3>Status History</h3>
              <ol className="order-timeline">
                {data.history.map((entry, index) => (
                  <li key={index}>
                    <Badge value={entry.new_status} />{" "}
                    {dateTime(entry.changed_date)}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
