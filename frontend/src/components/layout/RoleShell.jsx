import { Icon } from "../ui/Icon.jsx";
import { useAuth } from "../../features/auth/AuthProvider.jsx";

export function Shell({ tabs, active, onTab, children }) {
  const { user, logout } = useAuth();
  const role =
    user.role === "superadmin"
      ? "Super Admin"
      : user.role === "rider"
        ? "Rider"
        : "Admin";
  const scope =
    user.role === "superadmin"
      ? "original-super-shell"
      : user.role === "rider"
        ? "original-rider-shell"
        : "original-shell";
  return (
    <div className={scope}>
      <aside className="sidebar" id="masterSidebar">
        <div className="sidebar-header">
          <div className="logo-wrapper">
            <img src="/original-assets/LOGO.png" alt="TasteNet Logo" />
            <span className="logo-text">Caballeros Tastenet</span>
          </div>
        </div>
        <nav className="menu" aria-label={`${role} navigation`}>
          {tabs.map((tab) => (
            <div key={tab.id}>
              {tab.divider && <div className="menu-divider" />}
              <button
                type="button"
                className={`menu-item ${active === tab.id ? "active" : ""}`}
                title={tab.label}
                onClick={() => onTab(tab.id)}
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
              </button>
            </div>
          ))}
          <div className="menu-divider" />
          <button
            type="button"
            className="menu-item"
            title="Logout"
            onClick={logout}
          >
            <Icon name="right-from-bracket" />
            <span>Logout</span>
          </button>
        </nav>
        <div className="master-footer">
          <div className="user-info">
            <div className="user-avatar">
              <Icon name={user.role === "rider" ? "motorcycle" : "user"} />
            </div>
            <div className="user-details">
              <div className="user-name">{user.fullName}</div>
              <div className="user-role">{role}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="content" key={active}>
        {children}
      </main>
    </div>
  );
}
