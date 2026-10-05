import { api } from "../../lib/api.js";
import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";

export function TicketingSection({
  orders,
  status,
  setStatus,
  setDialog,
  setForm,
  setEditing,
  error,
  success,
  loading,
  busy,
  action,
  removeRecord,
  changeStatus,
  viewTicket,
  filteredOrders,
}) {
  return (
    <>
      <PageHeader
        className="page-header-main"
        title="Ticket Management"
        subtitle="Manage and track order tickets in real-time"
      >
        <button
          className="btn-primary-custom"
          onClick={() => {
            setForm({
              items: {},
              deliveryAddress: "",
              barangayName: "",
              paymentMethod: "",
              orderType: "Dine-In",
              priority: "Normal",
              instructions: "",
              requestKey: crypto.randomUUID(),
            });
            setDialog("new-ticket");
          }}
        >
          <Icon name="circle-plus" /> Create Ticket
        </button>
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="status-tabs-container">
        {["Open", "In Progress", "Completed", "Cancelled", "all"].map(
          (value) => (
            <button
              key={value}
              className={`status-tab ${status === value ? "active" : ""}`}
              onClick={() => setStatus(value)}
            >
              {value === "all" ? "All" : value}
              <span className="status-badge">
                {value === "all"
                  ? orders.length
                  : orders.filter((item) => item.status === value).length}
              </span>
            </button>
          ),
        )}
      </div>
      <div className="tickets-grid">
        {filteredOrders.map((order) => (
          <article className="ticket-card" key={order.id}>
            <div className="ticket-icon-bg">
              <Icon name="receipt" />
            </div>
            <div className="ticket-header">
              <div className="ticket-title">
                <Icon name="ticket" /> {order.ticket_number}
              </div>
              <div className="order-number">Order #: {order.order_number}</div>
              <div className="ticket-time">
                <Icon name="clock" /> {dateTime(order.created_at)}
              </div>
            </div>
            <div className="ticket-body">
              <div className="ticket-info">
                <span className="order-type">
                  <Icon
                    name={
                      order.order_type === "Delivery"
                        ? "motorcycle"
                        : "utensils"
                    }
                  />{" "}
                  {order.order_type}
                </span>
                <Badge value={order.status} />
              </div>
              {order.delivery_address && (
                <p className="delivery-address-tag">
                  <Icon name="location-dot" /> {order.delivery_address}
                </p>
              )}
              <div
                className={`rider-info-strip ${order.rider_id ? "assigned" : "unassigned"}`}
              >
                <Icon name="motorcycle" />{" "}
                {order.rider_name || "No rider assigned yet"}
              </div>
              <div className="ticket-items">
                <button
                  className="migration-button"
                  onClick={() => viewTicket(order)}
                >
                  <Icon name="utensils" /> View {order.item_count} order items
                </button>
              </div>
              <div className="ticket-footer">
                <div>
                  <Icon name="coins" /> Total: {money(order.total_amount)}
                </div>
                <div className="ticket-actions">
                  {!["Completed", "Cancelled"].includes(order.status) && (
                    <label className="ticket-priority-label">
                      Priority
                      <select
                        aria-label={"Priority for " + order.ticket_number}
                        value={order.priority || "Normal"}
                        disabled={busy}
                        onChange={(e) =>
                          action(
                            () =>
                              api("/api/orders/" + order.id + "/priority", {
                                method: "PATCH",
                                body: { priority: e.target.value },
                              }),
                            "Priority updated.",
                          )
                        }
                      >
                        <option>Normal</option>
                        <option>Rush</option>
                      </select>
                    </label>
                  )}
                  {["Completed", "Cancelled"].includes(order.status) && (
                    <button
                      className="action-btn btn-delete"
                      onClick={() => removeRecord("orders", order)}
                    >
                      <Icon name="trash" /> Delete
                    </button>
                  )}
                  {order.status === "Open" && (
                    <>
                      <button
                        className="action-btn btn-start"
                        disabled={busy}
                        onClick={() => changeStatus(order.id, "In Progress")}
                      >
                        <Icon name="play" /> Start
                      </button>
                      <button
                        className="action-btn btn-cancel-ticket"
                        disabled={busy}
                        onClick={() => setDialog({ type: "cancel", order })}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {order.status === "In Progress" && (
                    <>
                      <button
                        className="action-btn btn-rider"
                        hidden={order.order_type !== "Delivery"}
                        onClick={() => {
                          setEditing(order.id);
                          setForm({ riderId: order.rider_id || "" });
                          setDialog("assign");
                        }}
                      >
                        <Icon name="motorcycle" /> Assign Rider
                      </button>
                      <button
                        className="action-btn btn-done"
                        disabled={busy}
                        onClick={() => changeStatus(order.id, "Completed")}
                      >
                        <Icon name="check-double" /> Complete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filteredOrders.length && !loading && (
        <Empty
          title="No tickets found"
          detail="Orders will appear here when customers check out."
        />
      )}
    </>
  );
}
