import { RevenueChart } from "../reports/RevenueChart.jsx";
import { money } from "../../lib/format.js";
import { Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { OrdersTable } from "../orders/OrdersTable.jsx";

export function DashboardSection({
  user,
  summary,
  dashboard,
  error,
  success,
  setDialog,
  setForm,
  period,
  periodOrders,
  revenue,
  chartSeries,
  quota,
  quotaRevenue,
  quotaPct,
  periodControls,
  customDates,
}) {
  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-header">
        <div className="welcome">
          <h1>Welcome back, {user.fullName?.split(" ")[0] || "Admin"}!</h1>
          <p>Here's what's happening with your platform.</p>
        </div>
        {periodControls}
      </div>
      {customDates}
      <Notice error={error} success={success} />
      <div className="stat-grid">
        {[
          [
            "Total Orders",
            periodOrders.length,
            "shopping-bag",
            "#d97706",
            "#fff9e6",
          ],
          ["Total Revenue", money(revenue), "peso-sign", "#6b0d1e", "#f9ecee"],
          [
            "Active Users",
            summary?.activeUsers || 0,
            "users",
            "#2d9d78",
            "#edf7f4",
          ],
        ].map(([label, value, icon, color, background]) => (
          <div
            className="stat-card"
            key={label}
            style={{ "--accent-color": color }}
          >
            <div className="stat-top">
              <div className="stat-meta">
                <span className="stat-label">{label}</span>
                <span className="stat-value">{value}</span>
              </div>
              <div className="icon-box" style={{ background, color }}>
                <Icon name={icon} />
              </div>
            </div>
            <div className="stat-trend">
              <Icon name="calendar-days" />{" "}
              {label === "Active Users"
                ? "Across all roles"
                : period.toLowerCase()}
            </div>
          </div>
        ))}
        <button
          className="stat-card quota-card"
          style={{
            "--accent-color": "#7c3aed",
            border: 0,
            textAlign: "left",
          }}
          onClick={() => {
            setForm(
              Object.fromEntries(
                dashboard.quotas.map((item) => [item.id, item.target_amount]),
              ),
            );
            setDialog("quota");
          }}
        >
          <span className="quota-edit-hint">
            <Icon name="pen" /> Edit
          </span>
          <div className="stat-top">
            <div className="stat-meta">
              <span className="stat-label">
                Quota — {quota?.quota_type || "Monthly"}
              </span>
              <span className="quota-pct">{quotaPct.toFixed(0)}%</span>
            </div>
            <div
              className="icon-box"
              style={{ background: "#f3ebff", color: "#7c3aed" }}
            >
              <Icon name="bullseye" />
            </div>
          </div>
          <div className="quota-progress-wrap">
            <div className="quota-bar-bg">
              <div
                className="quota-bar-fill"
                style={{ width: `${Math.min(100, quotaPct)}%` }}
              />
            </div>
            <div className="quota-progress-row">
              <span>Target</span>
              <span className="qval">{money(quota?.target_amount)}</span>
            </div>
            <div className="quota-progress-row">
              <span>Sales within quota dates</span>
              <span className="qval">{money(quotaRevenue)}</span>
            </div>
          </div>
        </button>
      </div>
      <div className="main-grid">
        <div className="chart-box">
          <div className="box-title">Revenue Overview</div>
          <div className="chart-container">
            <RevenueChart series={chartSeries} />
          </div>
          <div className="chart-legend">
            Completed orders · {period.toLowerCase()}
          </div>
        </div>
        <div className="side-box">
          <div className="box-title">Top Selling Meals</div>
          {dashboard.topMeals.map((meal, index) => (
            <div className="meal-item" key={meal.food_name}>
              <div className={`meal-rank ${index >= 3 ? "gray" : ""}`}>
                {index + 1}
              </div>
              <div className="meal-info">
                <p className="meal-name">{meal.food_name}</p>
                <p className="meal-sales">
                  {meal.quantity} sold · {period.toLowerCase()}
                </p>
              </div>
              <div className="meal-price">{money(meal.revenue)}</div>
            </div>
          ))}
          {!dashboard.topMeals.length && <Empty title="No meal data" />}
        </div>
      </div>
      <div className="recent-orders-full">
        <div className="chart-box">
          <div className="box-title">Recent Orders</div>
          <OrdersTable orders={periodOrders.slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}
