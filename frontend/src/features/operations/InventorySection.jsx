import { api } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { Badge, Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";

export function InventorySection({
  inventory,
  categories,
  search,
  setSearch,
  category,
  setCategory,
  status,
  setStatus,
  setDialog,
  setForm,
  error,
  success,
  loading,
  busy,
  action,
  removeRecord,
  editInventory,
  stockStatus,
  low,
  filteredInventory,
}) {
  return (
    <>
      <PageHeader
        title="Inventory Management"
        subtitle="Manage ingredient stock"
      >
        <button
          className="btn btn--secondary"
          onClick={() => editInventory(null)}
        >
          <Icon name="plus" /> Add New Ingredient
        </button>
        <button
          className="btn btn--primary"
          onClick={() => {
            setForm({});
            setDialog("restock");
          }}
        >
          <Icon name="boxes-stacked" /> Bulk Restock
        </button>
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="stats-grid">
        <Stat
          label="Total Ingredients"
          value={inventory.length}
          note="All categories"
          icon="apple-whole"
        />
        <Stat
          label="Low Stock Alerts"
          value={low.length}
          note="Needs restocking"
          icon="triangle-exclamation"
          tone="low"
        />
        <Stat
          label="Out of Stock"
          value={
            inventory.filter((item) => Number(item.current_stock) === 0).length
          }
          note="Currently unavailable"
          icon="circle-xmark"
          tone="out"
        />
        <Stat
          label="Inventory Value"
          value={money(
            inventory.reduce(
              (sum, item) =>
                sum + Number(item.current_stock) * Number(item.unit_price),
              0,
            ),
          )}
          note="Total stock value"
          icon="peso-sign"
          tone="value"
        />
      </div>
      <div className="filter-container">
        <div className="search-wrapper">
          <Icon name="magnifying-glass" />
          <input
            aria-label="Search ingredients"
            placeholder="Search by ingredient name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-dropdown"
          aria-label="Category filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category_name}
            </option>
          ))}
        </select>
        <select
          className="filter-dropdown"
          aria-label="Stock status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All Stock Status</option>
          {["In Stock", "Low Stock", "Out of Stock"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <div className="table-wrapper">
        <div className="table-inner-wrapper">
          <table className="full-table">
            <thead>
              <tr>
                {[
                  "Ingredient Name",
                  "Category",
                  "Stock Status",
                  "Quantity",
                  "Unit Price",
                  "Total Price",
                  "Available",
                  "Actions",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="item-name">{item.item_name}</span>
                    <span className="item-category">{item.description}</span>
                  </td>
                  <td>
                    <span className="item-category">{item.category_name}</span>
                  </td>
                  <td>
                    <Badge value={stockStatus(item)} />
                  </td>
                  <td>
                    <span className="quantity-value">
                      {item.current_stock} {item.unit_of_measure}
                    </span>
                  </td>
                  <td>
                    <span className="unit-price">{money(item.unit_price)}</span>
                  </td>
                  <td>
                    <span className="total-price">
                      {money(
                        Number(item.current_stock) * Number(item.unit_price),
                      )}
                    </span>
                  </td>
                  <td>
                    <label className="switch">
                      <input
                        type="checkbox"
                        aria-label={`${item.item_name} availability`}
                        checked={item.is_available}
                        disabled={busy}
                        onChange={() =>
                          action(
                            () =>
                              api(`/api/staff/inventory/${item.id}`, {
                                method: "PATCH",
                                body: { isAvailable: !item.is_available },
                              }),
                            "Availability updated.",
                          )
                        }
                      />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <div className="action-icons">
                      <button
                        className="action-icon edit"
                        aria-label={`Edit ${item.item_name}`}
                        onClick={() => editInventory(item)}
                      >
                        <Icon name="pen-to-square" />
                      </button>
                      <button
                        className="action-icon delete"
                        aria-label={`Delete ${item.item_name}`}
                        onClick={() => removeRecord("inventory", item)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredInventory.length && !loading && (
            <Empty title="No ingredients found" />
          )}
        </div>
      </div>
    </>
  );
}
