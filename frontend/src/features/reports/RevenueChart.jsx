import { money } from "../../lib/format.js";
import { Empty } from "../../components/ui/Feedback.jsx";

export function RevenueChart({ series, metric = "Revenue" }) {
  const format =
    metric === "Revenue" ? money : (value) => String(value) + " orders";
  if (!series.length)
    return (
      <Empty
        title={
          metric === "Revenue"
            ? "No completed orders for this period"
            : "No orders for this period"
        }
        detail={
          metric === "Revenue"
            ? "Revenue appears after orders are completed."
            : "Orders appear here when placed."
        }
      />
    );
  const max = Math.max(1, ...series.map((row) => Number(row.revenue))),
    points = series.map(
      (row, index) =>
        `${45 + (index / Math.max(1, series.length - 1)) * 570},${210 - (Number(row.revenue) / max) * 170}`,
    );
  return (
    <svg
      className="migration-revenue-svg"
      viewBox="0 0 650 250"
      role="img"
      aria-label={`${metric} chart, ${series.length} days, maximum ${format(max)}`}
    >
      <defs>
        <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7D0A22" stopOpacity=".25" />
          <stop offset="100%" stopColor="#7D0A22" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((value) => (
        <g key={value}>
          <line
            x1="45"
            x2="615"
            y1={210 - value * 170}
            y2={210 - value * 170}
            stroke="#efe5dc"
          />
          <text x="0" y={214 - value * 170} fill="#8a6d6d" fontSize="11">
            {Math.round(max * value)}
          </text>
        </g>
      ))}
      {series.length > 1 && (
        <polygon
          points={`45,210 ${points.join(" ")} 615,210`}
          fill="url(#revenue-fill)"
        />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#7D0A22"
        strokeWidth="3"
      />
      {series.map((row, index) => (
        <circle
          key={row.date}
          cx={45 + (index / Math.max(1, series.length - 1)) * 570}
          cy={210 - (Number(row.revenue) / max) * 170}
          r="4"
          fill="#7D0A22"
        >
          <title>
            {row.date}: {format(row.revenue)}
          </title>
        </circle>
      ))}
      <text x="45" y="240" fill="#8a6d6d" fontSize="12">
        {series[0].date}
      </text>
      <text x="615" y="240" textAnchor="end" fill="#8a6d6d" fontSize="12">
        {series.at(-1).date}
      </text>
    </svg>
  );
}
