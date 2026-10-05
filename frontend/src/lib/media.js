import { apiUrl } from "./api.js";

export const imagePath = (value) =>
  value?.startsWith("/api/files/")
    ? apiUrl(value)
    : value
      ? `/${value.replace(/^~?\/+/, "").replace(/^images\//i, "original-assets/")}`
      : "/original-assets/LOGO.png";
