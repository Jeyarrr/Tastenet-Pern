import { useEffect, useState } from "react";
import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";

export function OrdersTable({ orders, onView, tableClass = "custom-table" }) {
  const [page, setPage] = useState(1);
  const count = Math.max(1, Math.ceil(orders.length / 20)),
    current = Math.min(page, count);
  useEffect(() => setPage(1), [orders]);
  return (
    <div className="table-container">
      <div className="table-wrapper">
        <table className={tableClass}>
          <thead>
            <tr>
              {[
                "Ticket #",
                "Customer",
                "Order Type",
                "Items",
                "Amount",
                "Priority",
                "Status",
                "Date & Time",
                ...(onView ? ["Actions"] : []),
              ].map((value) => (
                <th key={value}>{value}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.slice((current - 1) * 20, current * 20).map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{order.ticket_number}</strong>
                </td>
                <td>{order.customer_name || "Walk-in"}</td>
                <td>{order.order_type}</td>
                <td>{order.item_count}</td>
                <td>{money(order.total_amount)}</td>
                <td>{order.priority || "Normal"}</td>
                <td>
                  <Badge value={order.status} />
                </td>
                <td>{dateTime(order.created_at)}</td>
                {onView && (
                  <td>
                    <button
                      className="migration-button"
                      onClick={() => onView(order)}
                    >
                      <Icon name="eye" /> View
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <Empty title="No orders found" />}
      </div>
      {count > 1 && (
        <nav className="table-pagination" aria-label="Order pages">
          <button
            className="migration-button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            Page {current} of {count}
          </span>
          <button
            className="migration-button"
            disabled={current === count}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
