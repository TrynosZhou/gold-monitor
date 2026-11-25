import { Role } from "../models";

export type NavIcon = "home" | "stone" | "mill" | "vault" | "cash" | "report" | "list" | "scale" | "lock" | "gear";

/** A page the user can open (route: /<role>/<id>). */
export interface NavItem {
  id: string;
  label: string;
}

/** A top-level menu. It is either a single page (`id`) or a group of sub menus (`children`). */
export interface NavGroup {
  key: string;
  label: string;
  icon: NavIcon;
  id?: string;
  children?: NavItem[];
}

export const ROLE_BASE: Record<Role, string> = {
  FETCHER: "/fetcher",
  MILLER: "/miller",
  MANAGER: "/manager",
  OWNER: "/owner",
  ADMIN: "/admin",
};

const REPORT_MENU: NavItem[] = [
  { id: "reports", label: "All reports" },
  { id: "report-general", label: "General activity" },
  { id: "report-stone", label: "Stone delivered to mill" },
  { id: "report-produced", label: "Gold produced" },
  { id: "report-sold", label: "Gold sold" },
];

const PASSWORD: NavGroup = { key: "password", label: "Change password", icon: "lock", id: "password" };

export const NAV: Record<Role, NavGroup[]> = {
  FETCHER: [
    { key: "dash", label: "Dashboard", icon: "home", id: "overview" },
    {
      key: "stone", label: "Stone deliveries", icon: "stone",
      children: [
        { id: "record", label: "Record a delivery" },
        { id: "history", label: "My deliveries" },
      ],
    },
   PASSWORD,
  ],
  MILLER: [
    { key: "dash", label: "Dashboard", icon: "home", id: "overview" },
    {
      key: "crush", label: "Crushing", icon: "mill",
      children: [
        { id: "record", label: "Record a crushing run" },
        { id: "history", label: "Crushing history" },
      ],
    },
   PASSWORD,
  ],
  MANAGER: [
    { key: "dash", label: "Dashboard", icon: "home", id: "overview" },
    {
      key: "gold", label: "Gold from the mill", icon: "vault",
      children: [{ id: "receive", label: "Record gold received" }],
    },
    {
      key: "sales", label: "Sales & payouts", icon: "cash",
      children: [
        { id: "sell", label: "Sell gold & pay owner" },
        { id: "payouts", label: "Payout history" },
      ],
    },
    { key: "recon", label: "Reconciliation", icon: "scale", id: "reconciliation" },
   PASSWORD,
  ],
  OWNER: [
    { key: "dash", label: "Dashboard", icon: "home", id: "overview" },
    {
      key: "payouts", label: "Cash payouts", icon: "cash",
      children: [{ id: "payouts", label: "Confirm payouts" }],
    },
    { key: "reports", label: "Reports", icon: "report", children: REPORT_MENU },
   PASSWORD,
  ],
  ADMIN: [
    { key: "dash", label: "Dashboard", icon: "home", id: "overview" },
    {
      key: "records", label: "Records", icon: "list",
      children: [
        { id: "deliveries", label: "Stone deliveries" },
        { id: "crushing", label: "Crushing runs" },
        { id: "receipts", label: "Gold receipts" },
        { id: "payouts", label: "Cash payouts" },
      ],
    },
    { key: "recon", label: "Reconciliation", icon: "scale", id: "reconciliation" },
    { key: "reports", label: "Reports", icon: "report", children: REPORT_MENU },
    { key: "settings", label: "Settings", icon: "gear", id: "settings" },
   PASSWORD,
  ],
};

/** Every page id a role may open. */
export function sectionIds(role: Role): string[] {
  return NAV[role].flatMap((g) => (g.id ? [g.id] : (g.children ?? []).map((c) => c.id)));
}

export function sectionLabel(role: Role, id: string): string {
  for (const g of NAV[role]) {
    if (g.id === id) return g.label;
    const c = g.children?.find((x) => x.id === id);
    if (c) return c.label;
  }
  return "";
}
