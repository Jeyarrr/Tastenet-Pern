import { manilaDate as localDay } from "../lib/format.js";
import { RiderDashboard } from "../features/delivery/RiderDashboard.jsx";
import { RiderHistory } from "../features/delivery/RiderHistory.jsx";
import { AccountProfile } from "../features/accounts/AccountProfile.jsx";
import { passwordPattern, passwordHelp } from "../lib/passwordPolicy.js";
import { DeliveryNavigation } from "../features/delivery/DeliveryNavigation.jsx";
import { PasswordInput } from "../components/forms/PasswordInput.jsx";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

import { Notice } from "../components/ui/Feedback.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { Shell } from "../components/layout/RoleShell.jsx";

import { DeliveryConfirmation } from "../features/delivery/DeliveryConfirmation.jsx";
import { OrderDetails } from "../features/orders/OrderDetails.jsx";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "house" },
  {
    id: "history",
    label: "Delivery History",
    icon: "motorcycle",
    divider: true,
  },
  { id: "profile", label: "Profile", icon: "user", divider: true },
];

export function RiderPage() {
  const { refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const [securityOpen, setSecurityOpen] = useState(false);
  const tab = tabs.some((item) => item.id === params.get("page"))
    ? params.get("page")
    : "dashboard";
  const [orders, setOrders] = useState([]),
    [profile, setProfile] = useState(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState(""),
    [passwords, setPasswords] = useState({
      currentPassword: "",
      newPassword: "",
    });
  const refresh = async () => {
    const [o, p] = await Promise.all([
      api("/api/orders"),
      api("/api/auth/profile"),
    ]);
    setOrders(o.items);
    setProfile(p.profile);
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
  const act = async (work, message) => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await work();
      await refresh();
      await refreshUser();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const online = profile?.rider_status?.toLowerCase() === "online";
  const active = orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.status),
  );
  const completed = orders.filter((order) => order.status === "Completed");
  const today = localDay(new Date());
  const completedToday = completed.filter(
    (order) => localDay(order.completed_at || order.updated_at) === today,
  );
  const availability = () =>
    act(
      () =>
        api("/api/auth/availability", {
          method: "PATCH",
          body: { status: online ? "offline" : "online" },
        }),
      online ? "You are now offline." : "You are now online.",
    );
  const view = (order) => setDialog(order);
  const complete = (order, proofUrl) =>
    act(
      () =>
        api(`/api/orders/${order.id}/status`, {
          method: "PATCH",
          body: { status: "Completed", proofUrl },
        }),
      "Delivery completed.",
    );
  return (
    <Shell
      tabs={tabs}
      active={tab}
      onTab={(page) => {
        setParams({ page });
        setError("");
        setSuccess("");
      }}
    >
      <div
        className={`original-${tab === "dashboard" ? "rider" : tab === "history" ? "rider-history" : "rider-profile"}`}
      >
        {tab === "dashboard" ? (
          <RiderDashboard
            orders={orders}
            profile={profile}
            error={error}
            success={success}
            busy={busy}
            setDialog={setDialog}
            online={online}
            active={active}
            completedToday={completedToday}
            availability={availability}
            view={view}
          />
        ) : tab === "history" ? (
          <RiderHistory
            orders={orders}
            completed={completed}
            search={search}
            setSearch={setSearch}
            view={view}
            error={error}
            success={success}
          />
        ) : (
          <div className="profile-wrapper">
            <div className="page-header">
              <div className="header-title">
                <h1>Profile &amp; Account Settings</h1>
                <p>Manage your personal information and account security</p>
              </div>
            </div>
            <Notice error={error} success={success} />
            {profile && (
              <>
                <AccountProfile
                  profile={profile}
                  onSaved={async () => {
                    await refresh();
                  }}
                />
                <div className="content-section">
                  <h3 className="section-title">
                    <Icon name="shield-halved" /> Account Security
                  </h3>
                  <button
                    className="migration-button"
                    onClick={() => setSecurityOpen(!securityOpen)}
                  >
                    {securityOpen
                      ? "Close Password Settings"
                      : "Change Password"}
                  </button>
                  {securityOpen && (
                    <form
                      className="migration-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await act(
                            () =>
                              api("/api/auth/password", {
                                method: "PATCH",
                                body: passwords,
                              }),
                            "Password changed.",
                          )
                        )
                          setPasswords({
                            currentPassword: "",
                            newPassword: "",
                          });
                      }}
                    >
                      <div className="migration-form-row">
                        <label>
                          Current Password
                          <PasswordInput
                            visibilityLabel="current password"
                            aria-label="Current Password"
                            autoComplete="current-password"
                            required
                            value={passwords.currentPassword}
                            onChange={(e) =>
                              setPasswords({
                                ...passwords,
                                currentPassword: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          New Password
                          <PasswordInput
                            visibilityLabel="new password"
                            aria-label="New Password"
                            autoComplete="new-password"
                            minLength={12}
                            pattern={passwordPattern}
                            title={passwordHelp}
                            required
                            value={passwords.newPassword}
                            onChange={(e) =>
                              setPasswords({
                                ...passwords,
                                newPassword: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="migration-button primary"
                        disabled={busy}
                      >
                        Change Password
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {loading && <p className="migration-loading">Loading rider data…</p>}
        {dialog?.navigation ? (
          <DeliveryNavigation order={dialog} onClose={() => setDialog(null)} />
        ) : dialog?.confirm ? (
          <DeliveryConfirmation
            order={dialog}
            onClose={() => setDialog(null)}
            onComplete={complete}
            busy={busy}
            error={error}
          />
        ) : (
          dialog && (
            <OrderDetails order={dialog} onClose={() => setDialog(null)} />
          )
        )}
      </div>
    </Shell>
  );
}
