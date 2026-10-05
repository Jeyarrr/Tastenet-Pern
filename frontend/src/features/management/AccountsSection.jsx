import { Avatar } from "../../components/ui/Avatar.jsx";
import { dateTime, money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";

export function AccountsSection({
  tab,
  users,
  orders,
  error,
  success,
  setDialog,
  search,
  setSearch,
  status,
  setStatus,
  openStaff,
  people,
}) {
  return (
    <div
      id={tab === "customers" ? "customer-wrapper" : "delivery-mgmt-wrapper"}
      className="migration-section"
    >
      <PageHeader
        title={
          tab === "customers" ? "Customer Management" : "Delivery Personnel"
        }
        subtitle={
          tab === "customers"
            ? "Monitor and manage all registered customers and their activities"
            : "Manage riders and track their delivery performance"
        }
      >
        {tab === "personnel" && (
          <button
            className="migration-button primary"
            onClick={() => openStaff("rider")}
          >
            <Icon name="plus" /> Add New Rider
          </button>
        )}
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="stats-grid">
        {tab === "customers" ? (
          <>
            <Stat
              label="Total Customers"
              value={users.filter((p) => p.role === "customer").length}
              note="All registered accounts"
              icon="users"
              tone="total"
            />
            <Stat
              label="Active Customers"
              value={
                users.filter((p) => p.role === "customer" && p.is_active).length
              }
              note="Currently active users"
              icon="user-check"
              tone="active"
            />
            <Stat
              label="Blocked"
              value={
                users.filter((p) => p.role === "customer" && !p.is_active)
                  .length
              }
              note="Suspended accounts"
              icon="ban"
              tone="blocked"
            />
            <Stat
              label="Total Revenue"
              value={money(
                users
                  .filter((p) => p.role === "customer")
                  .reduce((sum, p) => sum + Number(p.total_spent), 0),
              )}
              note="From completed customer orders"
              icon="peso-sign"
              tone="revenue"
            />
          </>
        ) : (
          <>
            <Stat
              label="Total Riders"
              value={users.filter((p) => p.role === "rider").length}
              note="Delivery personnel"
              icon="motorcycle"
            />
            <Stat
              label="Online Riders"
              value={
                users.filter(
                  (p) =>
                    p.role === "rider" &&
                    p.rider_status?.toLowerCase() === "online",
                ).length
              }
              note="Available for delivery"
              icon="circle-check"
            />
            <Stat
              label="Assigned Deliveries"
              value={
                orders.filter(
                  (o) =>
                    o.rider_id &&
                    !["Completed", "Cancelled"].includes(o.status),
                ).length
              }
              note="In the delivery queue"
              icon="box"
            />
            <Stat
              label="Completed Deliveries"
              value={
                orders.filter((o) => o.rider_id && o.status === "Completed")
                  .length
              }
              note="Successfully delivered"
              icon="check-double"
            />
          </>
        )}
      </div>
      <div className="filter-container">
        <div className="search-box">
          <Icon name="magnifying-glass" />
          <input
            placeholder="Search by name, ID, email, or phone..."
            aria-label="Search accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Account status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>
      <div className="table-container">
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                {[
                  tab === "customers" ? "Customer ID" : "Rider ID",
                  "Full Name",
                  "Contact Info",
                  tab === "customers" ? "Date Registered" : "Vehicle",
                  "Status",
                  tab === "customers" ? "Total Orders" : "Assigned",
                  tab === "customers" ? "Total Spent" : "Completed",
                  "Actions",
                ].map((value) => (
                  <th key={value}>{value}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td>
                    <span className="customer-id">
                      {tab === "customers" ? "CU" : "RD"}-{person.id}
                    </span>
                  </td>
                  <td>
                    <div className="account-identity">
                      <Avatar
                        src={person.profile_photo}
                        name={person.full_name}
                      />{" "}
                      <div className="customer-name">
                        <span className="customer-name__primary">
                          {person.full_name}
                        </span>
                        <span className="customer-name__secondary">
                          {person.username}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="customer-contact">
                      <span className="customer-contact__email">
                        {person.email}
                      </span>
                      <span className="customer-contact__phone">
                        {person.phone}
                      </span>
                    </div>
                  </td>
                  <td>
                    {tab === "customers"
                      ? dateTime(person.created_at)
                      : person.vehicle || "—"}
                  </td>
                  <td>
                    <Badge
                      value={
                        person.is_active
                          ? tab === "personnel"
                            ? person.rider_status
                            : "Active"
                          : "Inactive"
                      }
                    />
                  </td>
                  <td>
                    {tab === "customers"
                      ? person.total_orders
                      : orders.filter(
                          (order) =>
                            String(order.rider_id) === String(person.id) &&
                            !["Completed", "Cancelled"].includes(order.status),
                        ).length}
                  </td>
                  <td>
                    {tab === "customers"
                      ? money(person.total_spent)
                      : orders.filter(
                          (order) =>
                            String(order.rider_id) === String(person.id) &&
                            order.status === "Completed",
                        ).length}
                  </td>
                  <td>
                    <div className="action-icons">
                      <button
                        className="migration-button"
                        aria-label={`View ${person.full_name}`}
                        onClick={() => setDialog({ type: "person", person })}
                      >
                        <Icon name="eye" />
                      </button>
                      <button
                        className="migration-button danger"
                        aria-label={`${person.is_active ? "Block" : "Activate"} ${person.full_name}`}
                        onClick={() => setDialog({ type: "active", person })}
                      >
                        <Icon name={person.is_active ? "ban" : "check"} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!people.length && <Empty title="No accounts found" />}
        </div>
      </div>
    </div>
  );
}
