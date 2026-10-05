import { OrdersTable } from "../orders/OrdersTable.jsx";
import { downloadCsv } from "../../lib/downloadCsv.js";
import { money } from "../../lib/format.js";
import { Icon } from "../../components/ui/Icon.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";

export function OrderHistorySection({
  orders,
  search,
  setSearch,
  status,
  setStatus,
  orderType,
  setOrderType,
  priority,
  setPriority,
  dateFilter,
  setDateFilter,
  error,
  success,
  viewTicket,
  filteredOrders,
}) {
  return (
    <>
      <PageHeader
        className="page-header-main"
        headingTag="h1"
        title="Order History"
        subtitle="View and manage all customer orders"
      >
        <button
          className="admin-btn"
          onClick={() =>
            downloadCsv("TasteNet-order-history.csv", [
              ["Ticket", "Customer", "Type", "Total", "Status", "Date"],
              ...filteredOrders.map((order) => [
                order.ticket_number,
                order.customer_name,
                order.order_type,
                order.total_amount,
                order.status,
                order.created_at,
              ]),
            ])
          }
        >
          <Icon name="download" /> Export Report
        </button>
        <button
          className="admin-btn reset-btn"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setOrderType("all");
            setPriority("all");
            setDateFilter("all");
          }}
        >
          <Icon name="rotate-left" /> Reset Filters
        </button>
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="stat-grid">
        <Stat
          label="Total Orders"
          value={orders.length}
          note="All customer orders"
          icon="shopping-bag"
          tone="total"
        />
        <Stat
          label="Completed"
          value={orders.filter((order) => order.status === "Completed").length}
          note="Successfully delivered"
          icon="circle-check"
          tone="completed"
        />
        <Stat
          label="In Progress"
          value={
            orders.filter((order) => order.status === "In Progress").length
          }
          note="Currently processing"
          icon="spinner"
          tone="progress"
        />
        <Stat
          label="Total Revenue"
          value={money(
            orders
              .filter((order) => order.status === "Completed")
              .reduce((sum, order) => sum + Number(order.total_amount), 0),
          )}
          note="From completed orders"
          icon="peso-sign"
          tone="revenue"
        />
      </div>
      <div className="filter-section">
        <div className="filter-row">
          <div className="search-box">
            <div className="search-box__icon">
              <Icon name="magnifying-glass" />
            </div>
            <input
              className="search-box__input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order # or customer..."
              aria-label="Search order history"
            />
          </div>
          <select
            className="filter-dropdown"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="History status"
          >
            <option value="all">All Status</option>
            {["Open", "In Progress", "Completed", "Cancelled"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            className="filter-dropdown"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            aria-label="Order type"
          >
            <option value="all">All Types</option>
            <option>Delivery</option>
            <option>Dine-In</option>
            <option>Take-Out</option>
          </select>
          <select
            className="filter-dropdown"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Order priority"
          >
            <option value="all">All Priority</option>
            <option>Normal</option>
            <option>Rush</option>
          </select>
          <select
            className="filter-dropdown"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Order date"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>
      <div className="orders-container">
        <OrdersTable
          orders={filteredOrders}
          onView={viewTicket}
          tableClass="orders-table"
        />
      </div>
    </>
  );
}
