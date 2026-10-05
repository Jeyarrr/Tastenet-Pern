import { RevenueChart } from "./RevenueChart.jsx";
import { OrderStatusChart } from "./OrderStatusChart.jsx";
import { money } from "../../lib/format.js";
import { Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { Stat } from "../../components/ui/Stat.jsx";

export function ReportsSection({
  dashboard,
  users,
  menu,
  error,
  success,
  chartMetric,
  setChartMetric,
  period,
  setPeriod,
  inPeriod,
  periodOrders,
  completed,
  revenue,
  chartSeries,
  orderSeries,
  timeCounts,
  exportOrders,
  customDates,
  day,
}) {
  return (
    <div className="reports-container">
      <div className="reports-header">
        <div className="header-info">
          <h2>Analytics &amp; Reports</h2>
          <p>Monitor business performance and customer activity</p>
        </div>
        <div className="header-actions">
          <div className="simple-date-filter">
            <Icon name="calendar-days" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Report period"
            >
              {[
                "Daily",
                "Weekly",
                "Monthly",
                "Yearly",
                "Custom",
                "All time",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <button className="btn btn--primary" onClick={exportOrders}>
            <Icon name="download" /> Export Report
          </button>
        </div>
      </div>
      {customDates}
      <Notice error={error} success={success} />
      <div className="kpi-row">
        <Stat
          label="Total Orders"
          value={periodOrders.length}
          note="Selected period"
          icon="shopping-bag"
          tone="orders"
        />
        <Stat
          label="Total Revenue"
          value={money(revenue)}
          note="Completed orders"
          icon="peso-sign"
          tone="revenue"
        />
        <Stat
          label="Avg Order Value"
          value={money(completed.length ? revenue / completed.length : 0)}
          note="Completed orders"
          icon="chart-line"
          tone="average"
        />
        <Stat
          label="New Customers"
          value={
            users.filter(
              (p) => p.role === "customer" && inPeriod(day(p.created_at)),
            ).length
          }
          note="Selected period"
          icon="user-plus"
          tone="customers"
        />
      </div>
      <div className="dashboard-grid">
        <div className="chart-box">
          <div
            className="migration-order-row"
            style={{ marginBottom: 20, flexWrap: "wrap" }}
          >
            <h3 className="chart-title" style={{ margin: 0 }}>
              Revenue &amp; Orders Trend
            </h3>
            <div className="btn-group">
              {["Revenue", "Orders"].map((value) => (
                <button
                  key={value}
                  className={
                    "btn-chart btn-chart-" +
                    (chartMetric === value ? "active" : "inactive")
                  }
                  onClick={() => setChartMetric(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart
            series={chartMetric === "Revenue" ? chartSeries : orderSeries}
            metric={chartMetric}
          />
        </div>
        <div className="chart-box">
          <h3 className="chart-title">Order Status Distribution</h3>
          <OrderStatusChart orders={periodOrders} />
          {["Open", "In Progress", "Completed", "Cancelled"].map(
            (value, index) => {
              const count = periodOrders.filter(
                (o) => o.status === value,
              ).length;
              return (
                <div className="status-item" key={value}>
                  <span>
                    <Icon
                      name="circle"
                      style={{
                        color: ["#ffcc00", "#3b82f6", "#2d9d78", "#b91c1c"][
                          index
                        ],
                      }}
                    />
                    {value}
                  </span>
                  <b>
                    {count} (
                    {periodOrders.length
                      ? Math.round((count / periodOrders.length) * 100)
                      : 0}
                    %)
                  </b>
                </div>
              );
            },
          )}
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="chart-box">
          <h3 className="chart-title">Orders by Time of Day</h3>
          <div className="migration-bar-chart">
            {["12am–6am", "6am–12pm", "12pm–6pm", "6pm–12am"].map(
              (label, index) => {
                const counts = timeCounts;
                return (
                  <div
                    className="migration-bar"
                    key={label}
                    style={{
                      height: counts[index]
                        ? String(
                            (counts[index] / Math.max(...counts, 1)) * 100,
                          ) + "%"
                        : "0",
                      minHeight: counts[index] ? 2 : 0,
                    }}
                    title={label + ": " + counts[index] + " orders"}
                  >
                    <span>
                      {label}
                      <br />
                      {counts[index]} orders
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
        <div className="chart-box">
          <h3 className="chart-title">Top Selling Meals — Selected Period</h3>
          {dashboard.topMeals.map((meal, index) => (
            <div className="restaurant-item" key={meal.food_name}>
              <div className="rank-circle">{index + 1}</div>
              <div className="res-info">
                <b>{meal.food_name}</b>
                <div className="res-bar-container">
                  <div
                    className="res-bar-fill"
                    style={{
                      width:
                        String(
                          (Number(meal.quantity) /
                            Math.max(
                              ...dashboard.topMeals.map((item) =>
                                Number(item.quantity),
                              ),
                              1,
                            )) *
                            100,
                        ) + "%",
                    }}
                  />
                </div>
              </div>
              <div className="res-value">{money(meal.revenue)}</div>
            </div>
          ))}
          {!dashboard.topMeals.length && <Empty title="No meal data" />}
        </div>
      </div>
      <div className="menu-table-box">
        <div className="table-header">
          <h3 className="table-title">Popular Menu Items — Selected Period</h3>
        </div>
        <table className="menu-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Menu Item</th>
              <th>Category</th>
              <th>Quantity Sold</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.topMeals.map((meal, index) => (
              <tr key={meal.food_name}>
                <td>
                  <div className="rank-badge">{index + 1}</div>
                </td>
                <td>
                  <b>{meal.food_name}</b>
                </td>
                <td>
                  <span className="cat-badge">
                    {menu.find((item) => item.food_name === meal.food_name)
                      ?.food_type || "—"}
                  </span>
                </td>
                <td>{meal.quantity}</td>
                <td>{money(meal.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
