import { api } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { Empty, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { imagePath } from "../../lib/media.js";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";

export function MenuSection({
  menu,
  search,
  setSearch,
  category,
  setCategory,
  status,
  setStatus,
  sort,
  setSort,
  setDialog,
  error,
  success,
  loading,
  busy,
  action,
  removeRecord,
  editMenu,
  foodCategories,
  filteredMenu,
}) {
  return (
    <>
      <PageHeader
        title="Menu Management"
        subtitle="Organize and manage your food menu items"
      >
        <button className="btn btn--secondary" onClick={() => editMenu(null)}>
          <Icon name="plus" /> Add Menu
        </button>
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="stats-grid">
        <Stat
          label="Total Items"
          value={menu.length}
          note="All menu items"
          icon="utensils"
          tone="total"
        />
        <Stat
          label="Active Items"
          value={menu.filter((item) => item.status === "active").length}
          note="Visible to customers"
          icon="eye"
          tone="active"
        />
        <Stat
          label="Hidden Items"
          value={menu.filter((item) => item.status !== "active").length}
          note="Not visible to customers"
          icon="eye-slash"
          tone="hidden"
        />
        <Stat
          label="Categories"
          value={foodCategories.length}
          note="Food categories"
          icon="tags"
        />
      </div>
      <div className="category-tabs">
        {["all", ...foodCategories].map((value) => (
          <button
            className={`category-tab ${category === value ? "active" : ""}`}
            key={value}
            onClick={() => setCategory(value)}
          >
            <Icon name={value === "all" ? "table-cells-large" : "utensils"} />{" "}
            {value === "all" ? "All Categories" : value}
          </button>
        ))}
      </div>
      <div className="filter-container">
        <div className="search-wrapper">
          <Icon name="magnifying-glass" />
          <input
            placeholder="Search by food name or description..."
            aria-label="Search menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-dropdown"
          aria-label="Menu status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          className="filter-dropdown"
          aria-label="Sort menu"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Sort by: Newest</option>
          <option value="name">Sort by: Name (A–Z)</option>
          <option value="price-high">Sort by: Price (High–Low)</option>
          <option value="price-low">Sort by: Price (Low–High)</option>
        </select>
      </div>
      <div className="menus-grid">
        {foodCategories
          .filter((value) =>
            filteredMenu.some((item) => item.food_type === value),
          )
          .map((value) => (
            <section className="category-section" key={value}>
              <div className="category-section-header">
                <div className="category-section-icon">
                  <Icon name="utensils" />
                </div>
                <h2 className="category-section-title">{value}</h2>
                <span className="category-section-count">
                  {
                    filteredMenu.filter((item) => item.food_type === value)
                      .length
                  }{" "}
                  items
                </span>
              </div>
              <div className="category-section-grid">
                {filteredMenu
                  .filter((item) => item.food_type === value)
                  .map((item) => (
                    <article className="menu-card" key={item.id}>
                      <div
                        className="menu-header"
                        style={{
                          backgroundImage: `url("${imagePath(item.image_path)}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          position: "relative",
                        }}
                      >
                        <div className="migration-menu-cover">
                          <Icon
                            name="utensils"
                            className="fa-solid fa-utensils menu-icon"
                          />
                          <h3 className="menu-title">{item.food_name}</h3>
                        </div>
                      </div>
                      <div className="menu-body">
                        <div className="menu-meta">
                          <span className="menu-code">MENU-{item.id}</span>
                          <button
                            className="status-toggle-btn"
                            disabled={busy}
                            style={{
                              background:
                                item.status === "active"
                                  ? "var(--success-green)"
                                  : "var(--warning-orange)",
                            }}
                            onClick={() =>
                              action(
                                () =>
                                  api(`/api/staff/menu/${item.id}`, {
                                    method: "PATCH",
                                    body: {
                                      status:
                                        item.status === "active"
                                          ? "inactive"
                                          : "active",
                                    },
                                  }),
                                "Menu visibility updated.",
                              )
                            }
                          >
                            {item.status === "active" ? "ACTIVE" : "HIDDEN"}
                          </button>
                        </div>
                        <p className="menu-description">
                          {item.description || item.food_type}
                        </p>
                        <div className="menu-footer">
                          <div className="item-count">
                            <Icon name="tag" />
                            <span>{money(item.price)}</span>
                          </div>
                          <div className="menu-actions">
                            <button
                              className="action-icon view"
                              aria-label={`View ${item.food_name}`}
                              onClick={() => setDialog({ type: "meal", item })}
                            >
                              <Icon name="eye" />
                            </button>
                            <button
                              className="action-icon edit"
                              aria-label={`Edit ${item.food_name}`}
                              onClick={() => editMenu(item)}
                            >
                              <Icon name="pen-to-square" />
                            </button>
                            <button
                              className="action-icon delete"
                              aria-label={`Delete ${item.food_name}`}
                              onClick={() => removeRecord("menu", item)}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
      </div>
      {!filteredMenu.length && !loading && (
        <Empty title="No menu items found" />
      )}
    </>
  );
}
