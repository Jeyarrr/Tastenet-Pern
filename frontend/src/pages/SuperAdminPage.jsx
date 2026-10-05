import { manilaDate as day } from "../lib/format.js";
import { SettingsSection } from "../features/management/SettingsSection.jsx";
import { AccountsSection } from "../features/management/AccountsSection.jsx";
import { ReportsSection } from "../features/reports/ReportsSection.jsx";
import { DashboardSection } from "../features/management/DashboardSection.jsx";

import { passwordPattern, passwordHelp } from "../lib/passwordPolicy.js";
import { AccountStatusDialog } from "../features/management/AccountStatusDialog.jsx";

import { PasswordInput } from "../components/forms/PasswordInput.jsx";
import { Recipes } from "../features/inventory/Recipes.jsx";
import { Transactions } from "../features/reports/Transactions.jsx";
import { downloadWorkbook } from "../lib/exportWorkbook.js";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateTime } from "../lib/format.js";

import { useAuth } from "../features/auth/AuthProvider.jsx";
import { Notice } from "../components/ui/Feedback.jsx";

import { Modal } from "../components/ui/Modal.jsx";

import { Shell } from "../components/layout/RoleShell.jsx";

import { PersonDetails } from "../features/management/PersonDetails.jsx";
import { PaymentEditor } from "../features/management/PaymentEditor.jsx";
import { QuotaEditor } from "../features/management/QuotaEditor.jsx";
import { Operations } from "../features/operations/Operations.jsx";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "house" },
  { id: "inventory", label: "Inventory", icon: "box", divider: true },
  { id: "recipes", label: "RecipeManager", icon: "box" },
  { id: "menu", label: "Menu", icon: "utensils" },
  { id: "tickets", label: "Ticketing", icon: "ticket" },
  {
    id: "transactions",
    label: "Transactions",
    icon: "dollar-sign",
    divider: true,
  },
  { id: "reports", label: "Reports", icon: "chart-column" },
  { id: "customers", label: "Customers", icon: "users", divider: true },
  { id: "personnel", label: "Delivery", icon: "motorcycle" },
  { id: "settings", label: "Settings", icon: "gear" },
];

const blankStaff = {
  fullName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  role: "rider",
};

export function SuperAdminPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((item) => item.id === params.get("page"))
    ? params.get("page")
    : "dashboard";
  const [summary, setSummary] = useState(null),
    [dashboard, setDashboard] = useState({
      quotas: [],
      topMeals: [],
      revenue: [],
    });
  const [users, setUsers] = useState([]),
    [orders, setOrders] = useState([]),
    [transactions, setTransactions] = useState([]),
    [methods, setMethods] = useState([]),
    [recipes, setRecipes] = useState([]),
    [menu, setMenu] = useState([]),
    [inventory, setInventory] = useState([]);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState(null),
    [form, setForm] = useState({});
  const [chartMetric, setChartMetric] = useState("Revenue");
  const [period, setPeriod] = useState("Monthly"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const refresh = async () => {
    const [s, d, u, o, t, p, r, m, i] = await Promise.all([
      api("/api/manage/overview"),
      api(
        `/api/manage/dashboard?${new URLSearchParams({ ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) })}`,
      ),
      api("/api/manage/users"),
      api("/api/orders"),
      api("/api/manage/transactions"),
      api("/api/manage/settings"),
      api("/api/manage/recipes"),
      api("/api/staff/menu"),
      api("/api/staff/inventory"),
    ]);
    setSummary(s);
    setDashboard(d);
    setUsers(u.items);
    setOrders(o.items);
    setTransactions(t.items);
    setMethods(p.paymentMethods);
    setRecipes(r.items);
    setMenu(m.items);
    setInventory(i.items);
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
    setStatus("all");
    setDialog(null);
    setError("");
    setSuccess("");
  }, [tab]);
  const act = async (work, message) => {
    setError("");
    setSuccess("");
    setBusy(true);
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
  const now = new Date(),
    today = day(now),
    cutoff = new Date(now);
  cutoff.setDate(
    cutoff.getDate() -
      (period === "Daily"
        ? 0
        : period === "Weekly"
          ? 6
          : period === "Yearly"
            ? 364
            : 29),
  );
  const start =
      period === "Custom" ? from : period === "All time" ? "" : day(cutoff),
    end = period === "Custom" ? to : today;
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      ...(start ? { from: start } : {}),
      ...(end ? { to: end } : {}),
    });
    api(`/api/manage/dashboard?${query}`, { signal: controller.signal })
      .then(setDashboard)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [start, end]);
  const inPeriod = (value) =>
    (!start || value >= start) && (!end || value <= end);
  const periodOrders = orders.filter((order) =>
      inPeriod(day(order.created_at)),
    ),
    completed = periodOrders.filter((order) => order.status === "Completed");
  const revenue = completed.reduce(
    (sum, order) => sum + Number(order.total_amount),
    0,
  );
  const chartSeries = dashboard.revenue.filter((row) => inPeriod(row.date));
  const orderSeries = Object.entries(
    periodOrders.reduce((counts, order) => {
      const date = day(order.created_at);
      counts[date] = (counts[date] || 0) + 1;
      return counts;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
  const timeCounts = [0, 1, 2, 3].map(
    (bucket) =>
      periodOrders.filter(
        (order) =>
          Math.floor(
            Number(
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Manila",
                hour: "2-digit",
                hourCycle: "h23",
              }).format(new Date(order.created_at)),
            ) / 6,
          ) === bucket,
      ).length,
  );
  const quota =
    dashboard.quotas.find(
      (item) => item.quota_type.toLowerCase() === period.toLowerCase(),
    ) ||
    dashboard.quotas.find(
      (item) => item.quota_type.toLowerCase() === "monthly",
    );
  const quotaRevenue = orders
    .filter(
      (o) =>
        o.status === "Completed" &&
        (!quota?.start_date ||
          day(o.created_at) >= quota.start_date.slice(0, 10)) &&
        (!quota?.end_date || day(o.created_at) <= quota.end_date.slice(0, 10)),
    )
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const quotaPct =
    Number(quota?.target_amount) > 0
      ? (quotaRevenue / Number(quota.target_amount)) * 100
      : 0;
  const createStaff = async (event) => {
    event.preventDefault();
    if (
      await act(
        () => api("/api/manage/users", { method: "POST", body: form }),
        "Team member created.",
      )
    )
      close();
  };
  const openStaff = (role) => {
    setForm({ ...blankStaff, role });
    setDialog("staff");
  };
  const people = users.filter(
    (person) =>
      (tab === "personnel"
        ? person.role === "rider"
        : person.role === "customer") &&
      `${person.full_name} ${person.username} ${person.email} ${person.phone || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" || person.is_active === (status === "active")),
  );
  const exportOrders = () =>
    downloadWorkbook("TasteNet-report.xml", {
      Summary: [
        ["Period", period],
        ["From", start || "All time"],
        ["To", end],
        ["Total orders", periodOrders.length],
        ["Completed orders", completed.length],
        ["Revenue", revenue],
        [
          "Average order value",
          completed.length ? revenue / completed.length : 0,
        ],
      ],
      Orders: [
        ["Ticket", "Customer", "Type", "Total", "Status", "Date"],
        ...periodOrders.map((o) => [
          o.ticket_number,
          o.customer_name,
          o.order_type,
          Number(o.total_amount),
          o.status,
          dateTime(o.created_at),
        ]),
      ],
      Meals: [
        ["Meal", "Quantity sold", "Revenue"],
        ...dashboard.topMeals.map((m) => [
          m.food_name,
          Number(m.quantity),
          Number(m.revenue),
        ]),
      ],
      Revenue: [
        ["Date", "Revenue"],
        ...chartSeries.map((r) => [r.date, Number(r.revenue)]),
      ],
      "Time of day": [
        ["Hours", "Orders"],
        ...timeCounts.map((count, i) => [
          ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"][i],
          count,
        ]),
      ],
    });
  const periodControls = (
    <div className="chart-controls">
      {["Daily", "Weekly", "Monthly", "Yearly", "Custom", "All time"].map(
        (value) => (
          <button
            key={value}
            className={`chart-btn ${period === value ? "active" : ""}`}
            onClick={() => setPeriod(value)}
          >
            {value}
          </button>
        ),
      )}
    </div>
  );
  const customDates = period === "Custom" && (
    <div className="migration-filter-bar">
      <label>
        From{" "}
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        To{" "}
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
    </div>
  );
  return (
    <Shell tabs={tabs} active={tab} onTab={(page) => setParams({ page })}>
      {["inventory", "menu", "tickets"].includes(tab) ? (
        <Operations tab={tab} />
      ) : (
        <div className={`original-${tab}`}>
          {tab === "dashboard" ? (
            <DashboardSection
              user={user}
              summary={summary}
              dashboard={dashboard}
              error={error}
              success={success}
              setDialog={setDialog}
              setForm={setForm}
              period={period}
              periodOrders={periodOrders}
              revenue={revenue}
              chartSeries={chartSeries}
              quota={quota}
              quotaRevenue={quotaRevenue}
              quotaPct={quotaPct}
              periodControls={periodControls}
              customDates={customDates}
            />
          ) : ["customers", "personnel"].includes(tab) ? (
            <AccountsSection
              tab={tab}
              users={users}
              orders={orders}
              error={error}
              success={success}
              setDialog={setDialog}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              openStaff={openStaff}
              people={people}
            />
          ) : tab === "recipes" ? (
            <Recipes
              recipes={recipes}
              menu={menu}
              inventory={inventory}
              save={(menuId, ingredients) =>
                act(
                  () =>
                    api(`/api/manage/recipes/${menuId}`, {
                      method: "PUT",
                      body: { ingredients },
                    }),
                  "Recipe saved.",
                )
              }
              error={error}
              success={success}
              busy={busy}
            />
          ) : tab === "reports" ? (
            <ReportsSection
              dashboard={dashboard}
              users={users}
              menu={menu}
              error={error}
              success={success}
              chartMetric={chartMetric}
              setChartMetric={setChartMetric}
              period={period}
              setPeriod={setPeriod}
              inPeriod={inPeriod}
              periodOrders={periodOrders}
              completed={completed}
              revenue={revenue}
              chartSeries={chartSeries}
              orderSeries={orderSeries}
              timeCounts={timeCounts}
              exportOrders={exportOrders}
              customDates={customDates}
              day={day}
            />
          ) : tab === "transactions" ? (
            <Transactions items={transactions} />
          ) : (
            <SettingsSection
              user={user}
              users={users}
              methods={methods}
              error={error}
              success={success}
              setDialog={setDialog}
              setForm={setForm}
              openStaff={openStaff}
            />
          )}
          {loading && (
            <p className="migration-loading">Loading platform data…</p>
          )}
          {dialog === "staff" && (
            <Modal
              title={form.role === "rider" ? "Add New Rider" : "Add Admin"}
              onClose={close}
            >
              <form className="migration-form" onSubmit={createStaff}>
                <Notice error={error} />
                {[
                  ["fullName", "Full Name"],
                  ["username", "Username"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["password", "Temporary Password"],
                ].map(([key, label]) => {
                  const Field = key === "password" ? PasswordInput : "input";
                  return (
                    <label key={key}>
                      {label}
                      <Field
                        aria-label={label}
                        required={key !== "phone"}
                        {...(key === "password"
                          ? {
                              visibilityLabel: "temporary password",
                              pattern: passwordPattern,
                              title: passwordHelp,
                              autoComplete: "new-password",
                            }
                          : { type: key === "email" ? "email" : "text" })}
                        minLength={
                          key === "password"
                            ? 12
                            : key === "username"
                              ? 3
                              : undefined
                        }
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  );
                })}
                <button className="migration-button primary" disabled={busy}>
                  Create Account
                </button>
              </form>
            </Modal>
          )}
          {dialog === "quota" && (
            <QuotaEditor
              quotas={dashboard.quotas}
              onClose={close}
              onSaved={refresh}
            />
          )}
          {dialog === "payment" && (
            <PaymentEditor method={form} onClose={close} onSaved={refresh} />
          )}
          {dialog?.type === "active" && (
            <AccountStatusDialog
              person={dialog.person}
              onClose={close}
              onSaved={refresh}
            />
          )}
          {dialog?.type === "person" && (
            <PersonDetails
              person={dialog.person}
              onClose={close}
              onSaved={refresh}
            />
          )}
        </div>
      )}
    </Shell>
  );
}
