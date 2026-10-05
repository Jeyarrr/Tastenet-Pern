import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { Modal } from "../../components/ui/Modal.jsx";

export function CustomerOrdersDialog({
  orders,
  error,
  success,
  busy,
  close,
  open,
  cancel,
}) {
  return (
    <Modal title="My Orders" onClose={close} wide>
      <Notice error={error} success={success} />
      {["Active Orders", "Order History"].map((heading, index) => (
        <div key={heading}>
          <h3 className="migration-subheading">{heading}</h3>
          {orders
            .filter((o) =>
              index === 0
                ? !["Completed", "Cancelled"].includes(o.status)
                : ["Completed", "Cancelled"].includes(o.status),
            )
            .map((order) => (
              <div className="order-card" key={order.id}>
                <div className="migration-order-row">
                  <div>
                    <strong>Order #: {order.ticket_number}</strong>
                    <br />
                    <small>{dateTime(order.created_at)}</small>
                    <p>Delivery to: {order.delivery_address}</p>
                    <strong>Total: {money(order.total_amount)}</strong>
                  </div>
                  <div>
                    <Badge value={order.status} />
                    <button
                      className="migration-button"
                      onClick={() => open({ kind: "order", order })}
                    >
                      <Icon name="eye" /> Details, Proofs &amp; Rating
                    </button>
                    {order.status === "Open" && (
                      <button
                        className="btn-cancel"
                        disabled={busy}
                        onClick={() => cancel(order.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ))}
      {!orders.length && (
        <Empty
          title="No orders yet"
          detail="Browse the menu to place your first order."
        />
      )}
    </Modal>
  );
}
