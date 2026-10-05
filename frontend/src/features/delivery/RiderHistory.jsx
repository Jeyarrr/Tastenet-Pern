import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";

export function RiderHistory({
  orders,
  completed,
  search,
  setSearch,
  view,
  error,
  success,
}) {
  const history = orders.filter(
    (order) =>
      ["Completed", "Cancelled"].includes(order.status) &&
      `${order.ticket_number} ${order.customer_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="history-wrapper">
      <div className="page-header-main">
        <div className="header-title">
          <h1>Delivery History</h1>
          <p>Review your completed deliveries</p>
        </div>
      </div>
      <Notice error={error} success={success} />
      <div className="stats-summary">
        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-label">Total Deliveries</div>
            <div className="summary-value">{completed.length}</div>
          </div>
          <div className="summary-icon">
            <Icon name="box" />
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <div className="summary-label">Total Amount Delivered</div>
            <div className="summary-value completed">
              {money(
                completed.reduce(
                  (sum, order) => sum + Number(order.total_amount),
                  0,
                ),
              )}
            </div>
          </div>
          <div className="summary-icon">
            <Icon name="circle-check" />
          </div>
        </div>
      </div>
      <div className="migration-filter-bar">
        <input
          placeholder="Search deliveries..."
          aria-label="Search delivery history"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="deliveries-container">
        <div className="section-header">
          <h2 className="section-title">Completed Deliveries</h2>
          <span className="results-count">
            Showing {history.length} deliveries
          </span>
        </div>
        <div className="deliveries-grid">
          {history.map((order) => (
            <article className="delivery-card" key={order.id}>
              <div className="delivery-header">
                <div className="delivery-info">
                  <span className="delivery-id">#{order.ticket_number}</span>
                  <div className="delivery-time">
                    <Icon name="calendar" />{" "}
                    {dateTime(order.completed_at || order.updated_at)}
                  </div>
                </div>
                <Badge value={order.status} />
              </div>
              <div className="delivery-content">
                <div className="location-info">
                  <div className="location-row">
                    <div className="location-icon">
                      <Icon name="flag-checkered" />
                    </div>
                    <div className="location-text">
                      <div className="location-label">DELIVERY ADDRESS</div>
                      <div className="location-address">
                        {order.delivery_address}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="delivery-metrics">
                  {[
                    ["Order #", order.order_number],
                    ["Priority", order.priority || "Normal"],
                    ["Total Amount", money(order.total_amount)],
                    ["Order Type", order.order_type],
                  ].map(([label, value]) => (
                    <div className="metric-row" key={label}>
                      <span className="metric-label">{label}</span>
                      <span
                        className={`metric-value ${label === "Total Amount" ? "highlight" : ""}`}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="delivery-actions">
                <button
                  className="action-btn btn-view"
                  onClick={() => view(order)}
                >
                  <Icon name="eye" /> View Details
                </button>
                <a
                  className="action-btn btn-reroute"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address + ", Dasmariñas, Cavite")}`}
                >
                  <Icon name="map-location-dot" /> Reroute
                </a>
              </div>
            </article>
          ))}
        </div>
        {!history.length && (
          <Empty
            title="No completed deliveries found"
            detail="Your completed deliveries will appear here."
          />
        )}
      </div>
    </div>
  );
}
