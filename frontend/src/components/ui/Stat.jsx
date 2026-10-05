import { Icon } from "./Icon.jsx";

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
