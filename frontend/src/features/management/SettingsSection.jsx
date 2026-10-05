import { Badge, Notice } from "../../components/ui/Feedback.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";

export function SettingsSection({
  user,
  users,
  methods,
  error,
  success,
  setDialog,
  setForm,
  openStaff,
}) {
  return (
    <div id="settings-wrapper" className="migration-section">
      <PageHeader
        title="Platform Settings"
        subtitle="Manage payment methods and staff accounts"
      >
        <button
          className="migration-button primary"
          onClick={() => openStaff("admin")}
        >
          <Icon name="user-plus" /> Add Admin
        </button>
      </PageHeader>
      <Notice error={error} success={success} />
      <div className="settings-layout">
        <div className="settings-card active">
          <h3>
            <Icon name="credit-card" /> Payment Methods
          </h3>
          <button
            className="migration-button primary"
            onClick={() => {
              setForm({});
              setDialog("payment");
            }}
          >
            Add Payment Method
          </button>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Method Name</th>
                  <th>Account Details</th>
                  <th>Instructions</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method.id}>
                    <td>{method.method_name}</td>
                    <td>{method.account_details || "—"}</td>
                    <td>{method.instructions || "—"}</td>
                    <td>
                      <Badge
                        value={
                          method.is_enabled && method.status === "Active"
                            ? "Active"
                            : "Inactive"
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="migration-button"
                        onClick={() => {
                          setForm({
                            id: method.id,
                            qrPhoto: method.qr_photo || "",
                            displayOrder: method.display_order || 0,
                            name: method.method_name,
                            isEnabled:
                              method.is_enabled && method.status === "Active",
                            instructions: method.instructions || "",
                            accountDetails: method.account_details || "",
                          });
                          setDialog("payment");
                        }}
                      >
                        <Icon name="pen-to-square" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="migration-card">
        <h3>Staff Accounts</h3>
        <div className="migration-table-wrap">
          <table className="migration-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((person) =>
                  ["admin", "superadmin"].includes(person.role),
                )
                .map((person) => (
                  <tr key={person.id}>
                    <td>{person.full_name}</td>
                    <td>
                      <Badge value={person.role} />
                    </td>
                    <td>
                      <Badge value={person.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td>
                      <button
                        className="migration-button"
                        disabled={String(person.id) === String(user.id)}
                        onClick={() => setDialog({ type: "active", person })}
                      >
                        {person.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
