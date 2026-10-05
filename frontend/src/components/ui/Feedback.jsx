import { Icon } from "./Icon.jsx";

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
