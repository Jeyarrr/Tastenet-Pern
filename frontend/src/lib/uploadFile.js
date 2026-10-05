import { apiUrl } from "./api.js";

export async function uploadFile(file, { purpose, ticketId }) {
  if (file.size > 3 * 1024 * 1024)
    throw new Error("Choose a file smaller than 3 MB.");
  const query = new URLSearchParams({
    purpose,
    ...(ticketId ? { ticketId } : {}),
  });
  const response = await fetch(apiUrl(`/api/files?${query}`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Upload failed");
  return data.url;
}
