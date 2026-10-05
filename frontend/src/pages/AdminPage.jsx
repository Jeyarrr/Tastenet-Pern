import { Operations } from "../features/operations/Operations.jsx";

import { useSearchParams } from "react-router-dom";

import { Shell } from "../components/layout/RoleShell.jsx";

export const adminTabs = [
  { id: "inventory", label: "Inventory", icon: "box" },
  { id: "recipes", label: "RecipeManager", icon: "utensils" },
  { id: "menu", label: "Menu", icon: "utensils", divider: true },
  { id: "tickets", label: "Ticketing", icon: "ticket", divider: true },
  { id: "history", label: "Order History", icon: "clock-rotate-left" },
];

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = adminTabs.some((item) => item.id === params.get("page"))
    ? params.get("page")
    : "inventory";
  return (
    <Shell tabs={adminTabs} active={tab} onTab={(page) => setParams({ page })}>
      <Operations tab={tab} />
    </Shell>
  );
}
