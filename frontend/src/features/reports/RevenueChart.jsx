import { useId, useState } from "react";
import { money } from "../../lib/format.js";
import { Empty } from "../../components/ui/Feedback.jsx";

export function RevenueChart({ series, metric = "Revenue" }) {
  const gradient = useId();
  const [selected, setSelected] = useState(null);
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
  const max = Math.max(1, ...series.map((row) => Number(row.revenue)));
  const x = (index) => 70 + (index / Math.max(1, series.length - 1)) * 545;
  const y = (value) => 210 - (Number(value) / max) * 170;
  const points = series.map((row, index) => x(index) + "," + y(row.revenue));
  const selectedRow = selected === null ? null : series[selected];
  const short = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (
    <div className="v2-revenue-chart">
      <svg
        className="migration-revenue-svg"
        viewBox="0 0 650 250"
        role="img"
        aria-label={
          metric + " chart, " + series.length + " days, maximum " + format(max)
        }
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-accent, #7d0a22)"
              stopOpacity=".28"
            />
            <stop
              offset="100%"
              stopColor="var(--color-accent, #7d0a22)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((value) => (
          <g key={value}>
            <line
              x1="70"
              x2="615"
              y1={210 - value * 170}
              y2={210 - value * 170}
              stroke="var(--color-border, #efe5dc)"
              strokeDasharray="3 5"
            />
            <text
              x="55"
              textAnchor="end"
              y={214 - value * 170}
              fill="var(--color-text-secondary, #8a6d6d)"
              fontSize="11"
            >
              {short.format(max * value)}
            </text>
          </g>
        ))}
        {series.length > 1 && (
          <polygon
            points={"70,210 " + points.join(" ") + " 615,210"}
            fill={"url(#" + gradient + ")"}
          />
        )}
        <polyline
          className="v2-chart-line"
          points={points.join(" ")}
          fill="none"
          stroke="var(--color-accent, #7d0a22)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {selectedRow && (
          <line
            x1={x(selected)}
            x2={x(selected)}
            y1="35"
            y2="210"
            stroke="var(--color-text-secondary, #8a6d6d)"
            strokeDasharray="4 5"
            opacity=".6"
          />
        )}
        {series.map((row, index) => (
          <circle
            key={row.date}
            cx={x(index)}
            cy={y(row.revenue)}
            r={selected === index ? 6 : 4}
            fill="var(--color-accent, #7d0a22)"
            stroke="var(--color-surface, #fff)"
            strokeWidth="2"
            tabIndex={0}
            aria-label={row.date + ": " + format(row.revenue)}
            onMouseEnter={() => setSelected(index)}
            onMouseLeave={() => setSelected(null)}
            onFocus={() => setSelected(index)}
            onBlur={() => setSelected(null)}
          >
            <title>
              {row.date}: {format(row.revenue)}
            </title>
          </circle>
        ))}
        <text
          x="70"
          y="240"
          fill="var(--color-text-secondary, #8a6d6d)"
          fontSize="11"
        >
          {series[0].date}
        </text>
        <text
          x="615"
          y="240"
          textAnchor="end"
          fill="var(--color-text-secondary, #8a6d6d)"
          fontSize="11"
        >
          {series.at(-1).date}
        </text>
      </svg>
      <div className="v2-chart-readout" aria-live="polite">
        {selectedRow ? (
          <>
            <span>{selectedRow.date}</span>
            <strong>{format(selectedRow.revenue)}</strong>
          </>
        ) : (
          <span>Hover or focus a point to explore {metric.toLowerCase()}.</span>
        )}
      </div>
    </div>
  );
}
