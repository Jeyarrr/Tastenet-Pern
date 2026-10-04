import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./auth.jsx";

export const imagePath = (value) =>
  value?.startsWith("/api/files/")
    ? `${import.meta.env.VITE_API_BASE || ""}${value}`
    : value
      ? `/${value.replace(/^~?\/+/, "").replace(/^images\//i, "original-assets/")}`
      : "/original-assets/LOGO.png";
export function Icon({ name, ...props }) {
  return <i className={`fa-solid fa-${name}`} aria-hidden="true" {...props} />;
}
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
export function PageHeader({
  title,
  subtitle,
  children,
  className = "page-header",
  headingTag: Heading = "h2",
}) {
  return (
    <div className={className}>
      <div className="header-title">
        <Heading>{title}</Heading>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon = "chart-line",
  tone = "items",
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div
          className={`stat-icon icon-${tone} stat-card__icon stat-card__icon--${tone}`}
        >
          <Icon name={icon} />
        </div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__trend stat-card__subtitle">
        <span className="trend-text">{note}</span>
      </div>
    </div>
  );
}
export function Badge({ value }) {
  return (
    <span
      className={`status-pill badge-${String(value || "")
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      {value || "—"}
    </span>
  );
}
export function Empty({
  title = "No results found",
  detail = "Try adjusting your search or filters.",
}) {
  return (
    <div className="no-results migration-empty">
      <Icon name="search" />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Notice({ error, success }) {
  return error || success ? (
    <div
      className={`migration-notice ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {error || success}
    </div>
  ) : null;
}
const modalStack = [];
let previousBodyOverflow = "";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  bodyClass = "",
  variant = "",
}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      dialog = ref.current;
    if (!modalStack.length) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.getElementById("root").inert = true;
    }
    if (modalStack.length) modalStack.at(-1).inert = true;
    modalStack.push(dialog);
    dialog?.focus();
    const key = (event) => {
      if (modalStack.at(-1) !== dialog) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll("button, input, select, textarea, a[href]"),
      ].filter((el) => !el.disabled && el.offsetParent !== null);
      const first = focusable[0],
        last = focusable.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      modalStack.splice(modalStack.indexOf(dialog), 1);
      if (!modalStack.length) {
        document.body.style.overflow = previousBodyOverflow;
        document.getElementById("root").inert = false;
      }
      if (modalStack.length) modalStack.at(-1).inert = false;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`migration-modal-overlay ${variant ? `modal-${variant}` : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`migration-modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h3>{title}</h3>
          <button
            className="migration-close"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className={`migration-modal-body ${bodyClass}`}>{children}</div>
      </section>
    </div>,
    document.getElementById("overlays"),
  );
}
