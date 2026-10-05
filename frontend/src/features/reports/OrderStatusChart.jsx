export function OrderStatusChart({ orders }) {
  const total = orders.length,
    circumference = 2 * Math.PI * 68;
  let offset = 0;
  return (
    <svg
      viewBox="0 0 240 200"
      style={{ width: "100%", height: 200 }}
      role="img"
      aria-label={"Order status distribution, " + total + " orders"}
    >
      <circle
        cx="120"
        cy="100"
        r="68"
        fill="none"
        stroke="#f3ebe0"
        strokeWidth="30"
      />
      {["Open", "In Progress", "Completed", "Cancelled"].map(
        (status, index) => {
          const count = orders.filter(
              (order) => order.status === status,
            ).length,
            length = total ? (count / total) * circumference : 0,
            start = offset;
          offset += length;
          return (
            <circle
              key={status}
              cx="120"
              cy="100"
              r="68"
              fill="none"
              stroke={["#ffcc00", "#3b82f6", "#2d9d78", "#b91c1c"][index]}
              strokeWidth="30"
              strokeDasharray={
                String(length) + " " + String(circumference - length)
              }
              strokeDashoffset={-start}
              transform="rotate(-90 120 100)"
            >
              <title>
                {status}: {count}
              </title>
            </circle>
          );
        },
      )}
      <text
        x="120"
        y="98"
        textAnchor="middle"
        fontSize="24"
        fontWeight="700"
        fill="#6b0d1e"
      >
        {total}
      </text>
      <text x="120" y="120" textAnchor="middle" fontSize="12" fill="#8a6d6d">
        orders
      </text>
    </svg>
  );
}
