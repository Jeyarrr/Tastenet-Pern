import { OrderHistorySection } from "./OrderHistorySection.jsx";
import { TicketingSection } from "./TicketingSection.jsx";
import { MenuSection } from "./MenuSection.jsx";
import { InventorySection } from "./InventorySection.jsx";
import { NewTicket } from "../orders/NewTicket.jsx";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { imagePath } from "../../lib/media.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { FileUpload } from "../../components/forms/FileUpload.jsx";
import { Recipes } from "../inventory/Recipes.jsx";
import { OrderDetails } from "../orders/OrderDetails.jsx";

const blankMenu = {
  foodName: "",
  foodType: "Silog",
  description: "",
  price: "",
  imagePath: "",
  status: "active",
};

const blankInventory = {
  itemCode: "",
  itemName: "",
  description: "",
  categoryId: null,
  currentStock: 0,
  minimumStock: 0,
  unitCost: 0,
  unitPrice: 0,
  unitOfMeasure: "pcs",
  isAvailable: true,
};

export function Operations({ tab }) {
  const [orders, setOrders] = useState([]),
    [menu, setMenu] = useState([]),
    [inventory, setInventory] = useState([]),
    [categories, setCategories] = useState([]),
    [riders, setRiders] = useState([]),
    [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("newest");
  const [orderType, setOrderType] = useState("all"),
    [priority, setPriority] = useState("all"),
    [dateFilter, setDateFilter] = useState("all");
  const [dialog, setDialog] = useState(null),
    [form, setForm] = useState({}),
    [editing, setEditing] = useState(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [o, m, i, c, r, recipes] = await Promise.all([
      api("/api/orders"),
      api("/api/staff/menu"),
      api("/api/staff/inventory"),
      api("/api/staff/inventory-categories"),
      api("/api/manage/riders"),
      api("/api/manage/recipes"),
    ]);
    setOrders(o.items);
    setMenu(m.items);
    setInventory(i.items);
    setCategories(c.items);
    setRiders(r.items);
    setRecipes(recipes.items);
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
  useEffect(() => {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setDialog(null);
    setError("");
    setSuccess("");
  }, [tab]);
  const action = async (work, message) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await refresh();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const close = () => setDialog(null);
  const removeRecord = (kind, item) =>
    setDialog({ type: "remove", kind, item });
  const editMenu = (item) => {
    setEditing(item?.id || null);
    setForm(
      item
        ? {
            foodName: item.food_name,
            foodType: item.food_type,
            description: item.description || "",
            price: item.price,
            imagePath: item.image_path || "",
            status: item.status === "active" ? "active" : "inactive",
          }
        : blankMenu,
    );
    setDialog("menu");
    setError("");
  };
  const editInventory = (item) => {
    setEditing(item?.id || null);
    setForm(
      item
        ? {
            itemCode: item.item_code,
            itemName: item.item_name,
            description: item.description || "",
            categoryId: item.category_id,
            currentStock: item.current_stock,
            minimumStock: item.minimum_stock,
            unitCost: item.unit_cost,
            unitPrice: item.unit_price,
            unitOfMeasure: item.unit_of_measure,
            isAvailable: item.is_available,
          }
        : blankInventory,
    );
    setDialog("inventory");
    setError("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (
      await action(
        () =>
          api(`/api/staff/${dialog}${editing ? `/${editing}` : ""}`, {
            method: editing ? "PATCH" : "POST",
            body: form,
          }),
        "Changes saved.",
      )
    )
      close();
  };
  const changeStatus = (id, value) =>
    action(
      () =>
        api(`/api/orders/${id}/status`, {
          method: "PATCH",
          body: { status: value },
        }),
      "Ticket updated.",
    );
  const viewTicket = (order) => setDialog({ type: "ticket", order });
  const stockStatus = (item) =>
    Number(item.current_stock) === 0
      ? "Out of Stock"
      : Number(item.current_stock) <= Number(item.minimum_stock)
        ? "Low Stock"
        : "In Stock";
  const low = inventory.filter(
    (item) => Number(item.current_stock) <= Number(item.minimum_stock),
  );
  const filteredInventory = inventory.filter(
    (item) =>
      `${item.item_name} ${item.description || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (category === "all" || String(item.category_id) === category) &&
      (status === "all" || stockStatus(item) === status),
  );
  const foodCategories = [...new Set(menu.map((item) => item.food_type))];
  const filteredMenu = menu
    .filter(
      (item) =>
        `${item.food_name} ${item.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (category === "all" || item.food_type === category) &&
        (status === "all" ||
          (status === "active"
            ? item.status === "active"
            : item.status !== "active")),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.food_name.localeCompare(b.food_name)
        : sort === "price-low"
          ? Number(a.price) - Number(b.price)
          : sort === "price-high"
            ? Number(b.price) - Number(a.price)
            : Number(b.id) - Number(a.id),
    );
  const inDateRange = (order) => {
    if (dateFilter === "all") return true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (dateFilter === "week")
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (dateFilter === "month") start.setDate(1);
    if (dateFilter === "year") start.setMonth(0, 1);
    return new Date(order.created_at) >= start;
  };
  const filteredOrders = orders.filter(
    (order) =>
      (status === "all" || order.status === status) &&
      `${order.ticket_number} ${order.customer_name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (tab !== "history" ||
        ((orderType === "all" ||
          order.order_type.replace(/[- ]/g, "").toLowerCase() ===
            orderType.replace(/[- ]/g, "").toLowerCase()) &&
          (priority === "all" || order.priority === priority) &&
          inDateRange(order))),
  );
  const field = (key, label, props = {}) => (
    <label>
      {label}
      <input
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </label>
  );
  if (tab === "recipes")
    return (
      <div className="original-recipes">
        <Recipes
          recipes={recipes}
          menu={menu}
          inventory={inventory}
          error={error}
          success={success}
          busy={busy}
          save={(menuId, ingredients) =>
            action(
              () =>
                api(`/api/manage/recipes/${menuId}`, {
                  method: "PUT",
                  body: { ingredients },
                }),
              "Recipe saved.",
            )
          }
        />
      </div>
    );
  const scope =
    tab === "inventory"
      ? "inventory"
      : tab === "menu"
        ? "menu"
        : tab === "history"
          ? "history"
          : "tickets";
  return (
    <div className={`original-${scope}`}>
      <div
        id="full-page-wrapper"
        className={
          tab === "tickets"
            ? "ticketing-container"
            : tab === "history"
              ? "order-history-container"
              : ""
        }
      >
        {tab === "inventory" ? (
          <InventorySection
            inventory={inventory}
            categories={categories}
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            status={status}
            setStatus={setStatus}
            setDialog={setDialog}
            setForm={setForm}
            error={error}
            success={success}
            loading={loading}
            busy={busy}
            action={action}
            removeRecord={removeRecord}
            editInventory={editInventory}
            stockStatus={stockStatus}
            low={low}
            filteredInventory={filteredInventory}
          />
        ) : tab === "menu" ? (
          <MenuSection
            menu={menu}
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            status={status}
            setStatus={setStatus}
            sort={sort}
            setSort={setSort}
            setDialog={setDialog}
            error={error}
            success={success}
            loading={loading}
            busy={busy}
            action={action}
            removeRecord={removeRecord}
            editMenu={editMenu}
            foodCategories={foodCategories}
            filteredMenu={filteredMenu}
          />
        ) : tab === "tickets" ? (
          <TicketingSection
            orders={orders}
            status={status}
            setStatus={setStatus}
            setDialog={setDialog}
            setForm={setForm}
            setEditing={setEditing}
            error={error}
            success={success}
            loading={loading}
            busy={busy}
            action={action}
            removeRecord={removeRecord}
            changeStatus={changeStatus}
            viewTicket={viewTicket}
            filteredOrders={filteredOrders}
          />
        ) : (
          <OrderHistorySection
            orders={orders}
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            orderType={orderType}
            setOrderType={setOrderType}
            priority={priority}
            setPriority={setPriority}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            error={error}
            success={success}
            viewTicket={viewTicket}
            filteredOrders={filteredOrders}
          />
        )}
        {loading && <p className="migration-loading">Loading data…</p>}
      </div>
      {["menu", "inventory"].includes(dialog) && (
        <Modal
          title={`${editing ? "Edit" : "Add"} ${dialog === "menu" ? "Food Item" : "Ingredient"}`}
          onClose={close}
        >
          <form className="migration-form" onSubmit={save}>
            <Notice error={error} />
            {dialog === "menu" ? (
              <>
                {field("foodName", "Food Name", { required: true })}
                <label>
                  Food Type
                  <select
                    value={form.foodType}
                    onChange={(e) =>
                      setForm({ ...form, foodType: e.target.value })
                    }
                  >
                    {[
                      ...new Set([
                        ...foodCategories,
                        "Silog",
                        "Sizzling Specials",
                        "Special Meals",
                        "Beverage",
                        "Addons",
                      ]),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                {field("price", "Price (₱)", {
                  type: "number",
                  min: 0,
                  step: "0.01",
                  required: true,
                })}
                <FileUpload
                  purpose="menu"
                  label="Food image"
                  value={form.imagePath}
                  onUploaded={(imagePath) =>
                    setForm((old) => ({ ...old, imagePath }))
                  }
                />
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Hidden</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <div className="migration-form-row">
                  {field("itemCode", "Item Code", {
                    placeholder: "Auto-generated if empty",
                  })}
                  {field("itemName", "Ingredient Name", { required: true })}
                </div>
                <label>
                  Category
                  <select
                    value={form.categoryId || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        categoryId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.category_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="migration-form-row">
                  {field("currentStock", "Quantity", {
                    type: "number",
                    min: 0,
                    step: ".001",
                    required: true,
                  })}
                  {field("minimumStock", "Minimum Stock", {
                    type: "number",
                    min: 0,
                    step: ".001",
                    required: true,
                  })}
                  {field("unitCost", "Unit Cost (₱)", {
                    type: "number",
                    min: 0,
                    step: ".01",
                    required: true,
                  })}
                  {field("unitPrice", "Unit Price (₱)", {
                    type: "number",
                    min: 0,
                    step: ".01",
                    required: true,
                  })}
                </div>
                {field("unitOfMeasure", "Unit of Measure", { required: true })}
                {field("description", "Description")}
              </>
            )}
            <div className="migration-form-actions">
              <button
                className="migration-button"
                type="button"
                onClick={close}
              >
                Cancel
              </button>
              <button className="migration-button primary" disabled={busy}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "restock" && (
        <Modal title="Bulk Restock" onClose={close}>
          <form
            className="migration-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const items = Object.entries(form)
                .filter(([, quantity]) => Number(quantity) > 0)
                .map(([id, quantity]) => ({
                  id: Number(id),
                  quantity: Number(quantity),
                }));
              if (
                await action(
                  () =>
                    api("/api/staff/restock", {
                      method: "POST",
                      body: { items },
                    }),
                  "Stock replenished.",
                )
              )
                close();
            }}
          >
            <Notice error={error} />
            {inventory.map((item) => (
              <label key={item.id}>
                {item.item_name} — {item.current_stock} {item.unit_of_measure}
                <input
                  type="number"
                  min="0"
                  step=".001"
                  value={form[item.id] || ""}
                  placeholder="Quantity to add"
                  onChange={(e) =>
                    setForm({ ...form, [item.id]: e.target.value })
                  }
                />
              </label>
            ))}
            <button className="migration-button primary" disabled={busy}>
              Restock Ingredients
            </button>
          </form>
        </Modal>
      )}
      {dialog === "assign" && (
        <Modal title="Assign Rider" onClose={close}>
          <form
            className="migration-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  () =>
                    api(`/api/orders/${editing}/assign`, {
                      method: "PATCH",
                      body: { riderId: Number(form.riderId) },
                    }),
                  "Rider assigned.",
                )
              )
                close();
            }}
          >
            <Notice error={error} />
            <label>
              Select Rider
              <select
                required
                value={form.riderId}
                onChange={(e) => setForm({ ...form, riderId: e.target.value })}
              >
                <option value="">Choose a rider</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.full_name} — {rider.rider_status}
                  </option>
                ))}
              </select>
            </label>
            <button className="migration-button primary" disabled={busy}>
              Assign Rider
            </button>
          </form>
        </Modal>
      )}
      {dialog?.type === "ticket" && (
        <OrderDetails
          order={dialog.order}
          onClose={close}
          onChanged={refresh}
        />
      )}
      {dialog?.type === "remove" && (
        <Modal title="Delete Record" onClose={close}>
          <Notice error={error} />
          <p>
            Remove{" "}
            {dialog.item.food_name ||
              dialog.item.item_name ||
              dialog.item.ticket_number}
            ? Historical records will be retained.
          </p>
          <button
            className="migration-button danger"
            disabled={busy}
            onClick={async () => {
              if (
                await action(
                  () =>
                    api(
                      dialog.kind === "orders"
                        ? "/api/orders/" + dialog.item.id
                        : "/api/staff/" + dialog.kind + "/" + dialog.item.id,
                      { method: "DELETE" },
                    ),
                  "Record removed.",
                )
              )
                close();
            }}
          >
            Confirm Delete
          </button>
        </Modal>
      )}
      {dialog?.type === "cancel" && (
        <Modal title="Cancel Ticket" onClose={close}>
          <p>Cancel ticket {dialog.order.ticket_number}?</p>
          <Notice error={error} />
          <button
            className="migration-button danger"
            disabled={busy}
            onClick={async () => {
              if (await changeStatus(dialog.order.id, "Cancelled")) close();
            }}
          >
            Confirm Cancellation
          </button>
        </Modal>
      )}
      {dialog?.type === "meal" && (
        <Modal title={dialog.item.food_name} onClose={close}>
          <img
            className="migration-meal-image"
            src={imagePath(dialog.item.image_path)}
            alt={dialog.item.food_name}
          />
          <p>{dialog.item.description}</p>
          <strong>{money(dialog.item.price)}</strong>
        </Modal>
      )}
      {dialog === "new-ticket" && (
        <NewTicket
          menu={menu.filter((item) => item.status === "active")}
          close={close}
          action={action}
          error={error}
          busy={busy}
        />
      )}
    </div>
  );
}
