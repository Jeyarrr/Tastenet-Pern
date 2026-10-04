import { AccountProfile } from "../features/AccountProfile.jsx";
import { passwordPattern, passwordHelp } from "../features/AccountFields.jsx";
import { DeliveryNavigation } from "../features/DeliveryNavigation.jsx";
import { PasswordInput } from "../features/PasswordInput.jsx";
import { useAuth } from "../auth.jsx";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, dateTime, money } from "../api.js";
import { Badge, Empty, Icon, Notice, Shell } from "../components.jsx";

import { DeliveryConfirmation } from "../features/DeliveryConfirmation.jsx";
import { OrderDetails } from "../features/OrderDetails.jsx";
import "../original/rider.css";
import "../features/role-refinements.css";
import "../original/rider-history.css";
import "../original/rider-profile.css";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "house" },
  {
    id: "history",
    label: "Delivery History",
    icon: "motorcycle",
    divider: true,
  },
  { id: "profile", label: "Profile", icon: "user", divider: true },
];
const localDay = (date) =>
  new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
function RiderHistory({
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
export function RiderPage() {
  const { refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const [securityOpen, setSecurityOpen] = useState(false);
  const tab = tabs.some((item) => item.id === params.get("page"))
    ? params.get("page")
    : "dashboard";
  const [orders, setOrders] = useState([]),
    [profile, setProfile] = useState(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState(""),
    [passwords, setPasswords] = useState({
      currentPassword: "",
      newPassword: "",
    });
  const refresh = async () => {
    const [o, p] = await Promise.all([
      api("/api/orders"),
      api("/api/auth/profile"),
    ]);
    setOrders(o.items);
    setProfile(p.profile);
  };
  useEffect(() => {
    let live = true;
    refresh()
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const act = async (work, message) => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await work();
      await refresh();
      await refreshUser();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const online = profile?.rider_status?.toLowerCase() === "online";
  const active = orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.status),
  );
  const completed = orders.filter((order) => order.status === "Completed");
  const today = localDay(new Date());
  const completedToday = completed.filter(
    (order) => localDay(order.completed_at || order.updated_at) === today,
  );
  const availability = () =>
    act(
      () =>
        api("/api/auth/availability", {
          method: "PATCH",
          body: { status: online ? "offline" : "online" },
        }),
      online ? "You are now offline." : "You are now online.",
    );
  const view = (order) => setDialog(order);
  const complete = (order, proofUrl) =>
    act(
      () =>
        api(`/api/orders/${order.id}/status`, {
          method: "PATCH",
          body: { status: "Completed", proofUrl },
        }),
      "Delivery completed.",
    );
  return (
    <Shell
      tabs={tabs}
      active={tab}
      onTab={(page) => {
        setParams({ page });
        setError("");
        setSuccess("");
      }}
    >
      <div
        className={`original-${tab === "dashboard" ? "rider" : tab === "history" ? "rider-history" : "rider-profile"}`}
      >
        {tab === "dashboard" ? (
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
                <span
                  className={`status-indicator ${online ? "online" : "offline"}`}
                >
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
              <div
                className="active-delivery-section"
                style={{ display: "block" }}
              >
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
                            <div className="location-label">
                              Pickup Location
                            </div>
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
                            <div className="location-label">
                              Drop-off Location
                            </div>
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
                          <span className="detail-value">
                            {order.payment_method}
                          </span>
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
                        onClick={() =>
                          setDialog({ ...order, navigation: true })
                        }
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
                  <Icon name="power-off" />{" "}
                  {online ? "Go Offline" : "Go Online"}
                </button>
              </div>
            )}
          </div>
        ) : tab === "history" ? (
          <RiderHistory
            orders={orders}
            completed={completed}
            search={search}
            setSearch={setSearch}
            view={view}
            error={error}
            success={success}
          />
        ) : (
          <div className="profile-wrapper">
            <div className="page-header">
              <div className="header-title">
                <h1>Profile &amp; Account Settings</h1>
                <p>Manage your personal information and account security</p>
              </div>
            </div>
            <Notice error={error} success={success} />
            {profile && (
              <>
                <AccountProfile
                  profile={profile}
                  onSaved={async () => {
                    await refresh();
                  }}
                />
                <div className="content-section">
                  <h3 className="section-title">
                    <Icon name="shield-halved" /> Account Security
                  </h3>
                  <button
                    className="migration-button"
                    onClick={() => setSecurityOpen(!securityOpen)}
                  >
                    {securityOpen
                      ? "Close Password Settings"
                      : "Change Password"}
                  </button>
                  {securityOpen && (
                    <form
                      className="migration-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await act(
                            () =>
                              api("/api/auth/password", {
                                method: "PATCH",
                                body: passwords,
                              }),
                            "Password changed.",
                          )
                        )
                          setPasswords({
                            currentPassword: "",
                            newPassword: "",
                          });
                      }}
                    >
                      <div className="migration-form-row">
                        <label>
                          Current Password
                          <PasswordInput
                            visibilityLabel="current password"
                            aria-label="Current Password"
                            autoComplete="current-password"
                            required
                            value={passwords.currentPassword}
                            onChange={(e) =>
                              setPasswords({
                                ...passwords,
                                currentPassword: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          New Password
                          <PasswordInput
                            visibilityLabel="new password"
                            aria-label="New Password"
                            autoComplete="new-password"
                            minLength={12}
                            pattern={passwordPattern}
                            title={passwordHelp}
                            required
                            value={passwords.newPassword}
                            onChange={(e) =>
                              setPasswords({
                                ...passwords,
                                newPassword: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="migration-button primary"
                        disabled={busy}
                      >
                        Change Password
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {loading && <p className="migration-loading">Loading rider data…</p>}
        {dialog?.navigation ? (
          <DeliveryNavigation order={dialog} onClose={() => setDialog(null)} />
        ) : dialog?.confirm ? (
          <DeliveryConfirmation
            order={dialog}
            onClose={() => setDialog(null)}
            onComplete={complete}
            busy={busy}
            error={error}
          />
        ) : (
          dialog && (
            <OrderDetails order={dialog} onClose={() => setDialog(null)} />
          )
        )}
      </div>
    </Shell>
  );
}
