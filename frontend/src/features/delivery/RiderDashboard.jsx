import { money } from "../../lib/format.js";
import { Badge, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";

export function RiderDashboard({
  orders,
  profile,
  error,
  success,
  busy,
  setDialog,
  online,
  active,
  completedToday,
  availability,
  view,
}) {
  return (
    <div className="dashboard-wrapper">
      <div className="page-header">
        <div className="header-title">
          <h1>Delivery Dashboard</h1>
          <p>Manage your deliveries and track performance</p>
        </div>
        <div className={`online-status ${online ? "online" : "offline"}`}>
          <span className="status-dot" />
          <span>{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>
      <Notice error={error} success={success} />
      <div className="status-card">
        <div className="status-info">
          <strong>Availability Status</strong>
          <small>Currently {online ? "online" : "offline"}</small>
        </div>
        <div className="toggle-container">
          <span className={`status-indicator ${online ? "online" : "offline"}`}>
            {online ? "ONLINE" : "OFFLINE"}
          </span>
          <button
            className={`toggle-switch ${online ? "active" : ""}`}
            role="switch"
            aria-checked={online}
            aria-label="Delivery availability"
            disabled={busy || !profile}
            onClick={availability}
          >
            <span className="toggle-knob">
              <Icon name={online ? "check" : "xmark"} />
            </span>
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          ["Total Deliveries", orders.length, "box"],
          ["Completed Today", completedToday.length, "circle-check"],
          ["Pending", active.length, "clock"],
        ].map(([label, value, icon]) => (
          <div className="stat-card" key={label}>
            <div>
              <div className="stat-card__content">
                <div>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{value}</div>
                </div>
                <div className="icon-circle">
                  <Icon name={icon} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {active.length ? (
        <div className="active-delivery-section" style={{ display: "block" }}>
          <div className="section-title">
            <span>Active Delivery</span>
          </div>
          {active.map((order) => (
            <div className="active-delivery-card" key={order.id}>
              <div className="active-delivery-header">
                <span className="active-delivery-id">
                  #{order.ticket_number}
                </span>
                <Badge value={order.status} />
              </div>
              <div className="active-delivery-content">
                <div className="location-section">
                  <div className="location-row">
                    <div className="location-icon">
                      <Icon name="location-dot" />
                    </div>
                    <div className="location-info">
                      <div className="location-label">Pickup Location</div>
                      <div className="location-value">
                        Caballeros — Blk 84, Lot 10 Bautista St, Zone 9
                      </div>
                    </div>
                  </div>
                  <div className="location-row">
                    <div className="location-icon">
                      <Icon name="flag-checkered" />
                    </div>
                    <div className="location-info">
                      <div className="location-label">Drop-off Location</div>
                      <div className="location-value">
                        {order.delivery_address}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="delivery-details-section">
                  <div className="detail-row">
                    <span className="detail-label">Order Total</span>
                    <span className="detail-value highlight">
                      {money(order.total_amount)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Payment</span>
                    <span className="detail-value">{order.payment_method}</span>
                  </div>
                </div>
              </div>
              <div className="customer-contact-section">
                <div className="contact-icon">
                  <Icon name="phone" />
                </div>
                <div className="contact-info">
                  <div className="contact-label">
                    Customer Contact — {order.customer_name}
                  </div>
                  <div className="contact-number">
                    {order.customer_phone || "No phone on file"}
                  </div>
                </div>
              </div>
              <button
                className="order-items-toggle"
                onClick={() => view(order)}
              >
                <Icon name="utensils" /> Order Items ({order.item_count}){" "}
                <Icon name="chevron-down" />
              </button>
              <div className="action-buttons">
                <button
                  className="action-btn btn-navigate"
                  onClick={() => setDialog({ ...order, navigation: true })}
                >
                  <Icon name="directions" /> Navigate
                </button>
                <button
                  className="action-btn btn-delivered"
                  disabled={busy || order.status !== "In Progress"}
                  onClick={() => setDialog({ ...order, confirm: true })}
                >
                  <Icon name="circle-check" /> Mark as Delivered
                </button>
                {order.customer_phone && (
                  <a
                    className="action-btn btn-call"
                    href={`tel:${order.customer_phone.replace(/[^+\d]/g, "")}`}
                  >
                    <Icon name="phone" /> Call Customer
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`hero-section ${online ? "online" : "offline"}`}>
          <div className="icon-lg">
            <Icon name={online ? "motorcycle" : "clock"} />
          </div>
          <h2>{online ? "You’re Online!" : "Ready to Start?"}</h2>
          <p>
            {online
              ? "Your assigned deliveries will appear here."
              : "Turn on your availability to start receiving delivery requests and earning rewards."}
          </p>
          <button
            className="btn btn--primary"
            disabled={busy || !profile}
            onClick={availability}
          >
            <Icon name="power-off" /> {online ? "Go Offline" : "Go Online"}
          </button>
        </div>
      )}
    </div>
  );
}
