const base = import.meta.env.VITE_API_BASE || "";
export const apiUrl = (path) => `${base}${path}`;

export async function api(path, { body, ...options } = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error?.message || `Request failed (${response.status})`,
    );
  return data;
}
