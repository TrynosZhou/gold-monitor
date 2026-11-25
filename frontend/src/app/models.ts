export type Role = "FETCHER" | "MILLER" | "MANAGER" | "OWNER" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

export interface Summary {
  wheelbarrowsAvailable: number;
  goldProduced: number;
  goldReceived: number;
  goldSold: number;
  goldConfirmedByOwner: number;
  goldAwaitingReceipt: number;
  goldInVault: number;
  goldPendingOwnerConfirmation: number;
  cashPaid: number;
  reconciliation: {
    producedVsReceived: number;
    receivedVsSold: number;
    soldVsConfirmed: number;
    isFullyMatched: boolean;
  };
}

export interface Delivery {
  id: string;
  wheelbarrowCount: number;
  pitLocation: string | null;
  notes: string | null;
  deliveredAt: string;
  fetcher: { fullName: string };
}

export interface CrushingRun {
  id: string;
  wheelbarrowsCrushed: number;
  goldGrams: number;
  notes: string | null;
  crushedAt: string;
  miller: { fullName: string };
}

export interface GoldReceipt {
  id: string;
  grams: number;
  notes: string | null;
  receivedAt: string;
  manager: { fullName: string };
}

export interface Payout {
  id: string;
  gramsSold: number;
  gramsConfirmed: number | null;
  pricePerGram: number;
  totalCash: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "DISPUTED";
  disputeNote: string | null;
  paidAt: string;
  acknowledgedAt: string | null;
  manager: { fullName: string };
  owner: { id: string; fullName: string };
}

/** Company branding. Visible to everyone, including the login screen. */
export interface Branding {
  companyName: string;
  motto: string | null;
  logoDataUrl: string | null;
  currency: string;
}

/** Full settings, including gold selling prices (logged-in users only). */
export interface AppSettings extends Branding {
  goldPricePerGram: number;
  goldPricePerKg: number;
  updatedAt?: string;
}

export const HOME_ROUTE: Record<Role, string> = {
  FETCHER: "/fetcher/overview",
  MILLER: "/miller/overview",
  MANAGER: "/manager/overview",
  OWNER: "/owner/overview",
  ADMIN: "/admin/overview",
};

export const ROLE_LABEL: Record<Role, string> = {
  FETCHER: "Stone Fetcher",
  MILLER: "Miller",
  MANAGER: "Manager",
  OWNER: "Owner",
  ADMIN: "Administrator",
};
