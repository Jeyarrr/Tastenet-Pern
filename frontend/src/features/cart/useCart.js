import { useEffect, useState } from "react";
function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([id, item]) =>
            /^\d+$/.test(id) &&
            item &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 50,
        )
        .slice(0, 30),
    );
  } catch {
    return {};
  }
}
export function useCart(userId) {
  const key = `tastenet.cart.${userId || "guest"}`;
  const load = () => {
    const saved = read(key);
    if (!userId) return {};
    const guest = read("tastenet.cart.guest");
    const merged = { ...saved };
    for (const [id, line] of Object.entries(guest))
      merged[id] = {
        ...line,
        quantity: Math.min(50, line.quantity + (saved[id]?.quantity || 0)),
      };
    return Object.fromEntries(Object.entries(merged).slice(0, 30));
  };
  const [state, setState] = useState(() => ({ key, items: load() }));
  useEffect(() => {
    if (state.key !== key) setState({ key, items: load() });
  }, [key, state.key]);
  useEffect(() => {
    if (state.key === key)
      try {
        localStorage.setItem(key, JSON.stringify(state.items));
        if (userId) localStorage.removeItem("tastenet.cart.guest");
      } catch {
        /* Browsing remains available when storage is disabled. */
      }
  }, [key, state, userId]);
  const setCart = (update) =>
    setState((previous) => {
      const old = previous.key === key ? previous.items : read(key);
      return {
        key,
        items: typeof update === "function" ? update(old) : update,
      };
    });
  return [state.key === key ? state.items : read(key), setCart];
}
