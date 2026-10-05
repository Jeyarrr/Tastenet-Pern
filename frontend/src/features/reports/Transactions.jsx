import { manilaDate as day } from "../../lib/format.js";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";
import { downloadWorkbook } from "../../lib/exportWorkbook.js";

const statusOf = (row) =>
  ["Purchase", "Sale"].includes(row.transaction_type)
    ? "Completed"
    : "Adjustment";
export function Transactions({ items }) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [date, setDate] = useState(""),
    [selected, setSelected] = useState([]),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search, type, status, date]);
  const filtered = items.filter(
    (t) =>
      `${t.id} ${t.item_name} ${t.transaction_type}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (type === "all" || t.transaction_type === type) &&
      (status === "all" || statusOf(t) === status) &&
      (!date || day(t.transaction_date) === date),
  );
  const last = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, last);
  const rows = filtered.slice((current - 1) * 20, current * 20);
  const exportRows = (rows) =>
    downloadWorkbook("TasteNet-transactions.xml", {
      Transactions: [
        [
          "ID",
          "Item",
          "Type",
          "Status",
          "Date",
          "Quantity",
          "Previous stock",
          "New stock",
          "Value",
          "Performed by",
          "Notes",
        ],
        ...rows.map((t) => [
          t.id,
          t.item_name,
          t.transaction_type,
          statusOf(t),
          dateTime(t.transaction_date),
          Number(t.quantity),
          Number(t.previous_stock),
          Number(t.new_stock),
          Number(t.total_value || 0),
          t.performed_by_name,
          t.notes,
        ]),
      ],
    });
  return (
    <div id="transactions-wrapper" className="migration-section">
      <PageHeader
        title="Transactions Management"
        subtitle="Track inventory movements and stock activity"
      >
        <button
          className="migration-button primary"
          onClick={() => exportRows(filtered)}
        >
          Export All Results
        </button>
        <button
          className="migration-button"
          disabled={!selected.length}
          onClick={() =>
            exportRows(filtered.filter((t) => selected.includes(t.id)))
          }
        >
          Export Selected ({selected.length})
        </button>
      </PageHeader>
      <Notice error={error} />
      <div className="stats-grid">
        <Stat
          label="Total Transactions"
          value={filtered.length}
          icon="exchange-alt"
          note="Filtered records"
        />
        <Stat
          label="Sales"
          value={filtered.filter((t) => t.transaction_type === "Sale").length}
          icon="arrow-up"
          note="Stock consumed"
        />
        <Stat
          label="Purchases"
          value={
            filtered.filter((t) => t.transaction_type === "Purchase").length
          }
          icon="arrow-down"
          note="Stock received"
        />
        <Stat
          label="Total Value"
          value={money(
            filtered.reduce((sum, t) => sum + Number(t.total_value || 0), 0),
          )}
          icon="peso-sign"
          note="Based on inventory prices"
        />
      </div>
      <div className="migration-filter-bar">
        <input
          aria-label="Search transactions"
          placeholder="Search transaction ID or item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Transaction type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All Types</option>
          {[...new Set(items.map((t) => t.transaction_type))]
            .sort()
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
        <select
          aria-label="Transaction status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option>Completed</option>
          <option>Adjustment</option>
        </select>
        <input
          type="date"
          aria-label="Transaction date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          className="migration-button"
          onClick={() => {
            setSearch("");
            setType("all");
            setStatus("all");
            setDate("");
          }}
        >
          Reset Filters
        </button>
      </div>
      <div className="table-container table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select displayed transactions"
                  checked={
                    rows.length > 0 &&
                    rows.every((t) => selected.includes(t.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...new Set([...selected, ...rows.map((t) => t.id)])]
                        : selected.filter(
                            (id) => !rows.some((t) => t.id === id),
                          ),
                    )
                  }
                />
              </th>
              {[
                "Transaction ID",
                "Item Name",
                "Type",
                "Date & Time",
                "Quantity",
                "Value",
                "Status",
                "Details",
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select transaction ${t.id}`}
                    checked={selected.includes(t.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, t.id]
                          : selected.filter((id) => id !== t.id),
                      )
                    }
                  />
                </td>
                <td>TX-{t.id}</td>
                <td>{t.item_name}</td>
                <td>{t.transaction_type}</td>
                <td>{dateTime(t.transaction_date)}</td>
                <td>
                  {t.quantity} {t.unit_of_measure}
                </td>
                <td>{money(t.total_value)}</td>
                <td>
                  <Badge value={statusOf(t)} />
                </td>
                <td>
                  <button
                    className="migration-button"
                    onClick={async () => {
                      setError("");
                      try {
                        setDetail(
                          await api(`/api/manage/transactions/${t.id}`),
                        );
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No transactions found" />}
      </div>
      {last > 1 && (
        <nav className="table-pagination" aria-label="Transactions pages">
          <button
            className="migration-button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            Page {current} of {last}
          </span>
          <button
            className="migration-button"
            disabled={current === last}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {detail && (
        <Modal
          title={`Transaction TX-${detail.transaction.id}`}
          onClose={() => setDetail(null)}
        >
          <dl className="migration-detail-grid">
            {[
              ["Item", detail.transaction.item_name],
              ["Type", detail.transaction.transaction_type],
              ["Previous stock", detail.transaction.previous_stock],
              ["New stock", detail.transaction.new_stock],
              ["Performed by", detail.transaction.performed_by_name],
              ["Date", dateTime(detail.transaction.transaction_date)],
              ["Notes", detail.transaction.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <h3>Audit History</h3>
          {detail.audit.length ? (
            detail.audit.map((a, i) => (
              <p key={i}>
                {a.change_type}: {a.old_value} → {a.new_value} ·{" "}
                {dateTime(a.change_date)}
              </p>
            ))
          ) : (
            <p>No subsequent changes recorded.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
