export const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const manilaDate = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
