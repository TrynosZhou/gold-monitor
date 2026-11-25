import { Injectable, inject } from "@angular/core";
import { forkJoin, map, Observable, of, catchError } from "rxjs";
import { ApiService } from "./api.service";
import { AuthService } from "./auth.service";
import { SettingsService } from "./settings.service";
import { buildReportPdf, ReportDefinition } from "./report-pdf";
import { CrushingRun, Delivery, GoldReceipt, Payout, ROLE_LABEL, Summary } from "../models";

export type ReportId = "general" | "stone" | "produced" | "sold";

export interface ReportInfo {
  id: ReportId;
  title: string;
  description: string;
  icon: "list" | "stone" | "gold" | "cash";
}

export const REPORTS: ReportInfo[] = [
  {
    id: "general",
    title: "General Activity Report",
    description: "Overall position, reconciliation and a full chronological log of deliveries, crushing, gold receipts and sales.",
    icon: "list",
  },
  {
    id: "stone",
    title: "Stone Delivered to the Mill",
    description: "Wheelbarrows of stone delivered to the mill, by day, by stone fetcher and in detail.",
    icon: "stone",
  },
  {
    id: "produced",
    title: "Gold Produced",
    description: "Gold produced from each crushing run, with wheelbarrows crushed and yield per wheelbarrow.",
    icon: "gold",
  },
  {
    id: "sold",
    title: "Gold Sold",
    description: "Gold sold and cash paid to the owner, with the owner's confirmation status for each payout.",
    icon: "cash",
  },
];

export interface DateRange {
  from: string; // yyyy-mm-dd or ""
  to: string; // yyyy-mm-dd or ""
}

interface Dataset {
  summary: Summary | null;
  deliveries: Delivery[] | null;
  runs: CrushingRun[] | null;
  receipts: GoldReceipt[] | null;
  payouts: Payout[] | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (v: number) => String(v).padStart(2, "0");
const num = (v: unknown) => Number(v ?? 0) || 0;

const fmtDate = (iso: string | Date) => {
  const d = new Date(iso);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtDateTime = (iso: string | Date) => {
  const d = new Date(iso);
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const g = (v: unknown) => num(v).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const int = (v: unknown) => num(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
const statusLabel = (s: Payout["status"]) =>
  s === "CONFIRMED" ? "Confirmed" : s === "DISPUTED" ? "Disputed" : "Awaiting owner";

@Injectable({ providedIn: "root" })
export class ReportService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private settings = inject(SettingsService);

  /** Formats an amount in the given currency (defaults to the one set in Settings). */
  private money = (v: unknown, cur: string = this.settings.currency()) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(num(v));
    } catch {
      const s = num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${cur} ${s}`;
    }
  };

  /** Build the PDF for a report (fetches fresh data every time). */
  generate(id: ReportId, range: DateRange): Observable<{ blob: Blob; filename: string }> {
    return this.load().pipe(
      map((data) => {
        const def = this.define(id, data, range);
        const stamp = new Date();
        const filename = `gold-monitor-${this.slug(id)}-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.pdf`;
        return { blob: buildReportPdf(def), filename };
      }),
    );
  }

  private slug(id: ReportId) {
    return { general: "general-activity", stone: "stone-delivered", produced: "gold-produced", sold: "gold-sold" }[id];
  }

  private load(): Observable<Dataset> {
    const safe = <T>(path: string) => this.api.get<T>(path).pipe(catchError(() => of(null as T | null)));
    return forkJoin({
      summary: safe<Summary>("/summary"),
      deliveries: safe<Delivery[]>("/deliveries"),
      runs: safe<CrushingRun[]>("/crushing"),
      receipts: safe<GoldReceipt[]>("/gold-receipts"),
      payouts: safe<Payout[]>("/payouts"),
    });
  }

  // ---------------------------------------------------------------- helpers
  private inRange<T>(rows: T[], pick: (r: T) => string, range: DateRange): T[] {
    const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : -Infinity;
    const to = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : Infinity;
    return rows
      .filter((r) => {
        const t = new Date(pick(r)).getTime();
        return t >= from && t <= to;
      })
      .sort((a, b) => new Date(pick(b)).getTime() - new Date(pick(a)).getTime());
  }

  private periodLabel(range: DateRange) {
    if (range.from && range.to) return `${fmtDate(`${range.from}T00:00:00`)} to ${fmtDate(`${range.to}T00:00:00`)}`;
    if (range.from) return `From ${fmtDate(`${range.from}T00:00:00`)}`;
    if (range.to) return `Up to ${fmtDate(`${range.to}T00:00:00`)}`;
    return "All records to date";
  }

  private group<T>(rows: T[], key: (r: T) => string) {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  }

  private need<T>(data: T | null, what: string): T {
    if (data === null) {
      throw new Error(`The ${what} data could not be loaded. Your account may not have access to it yet.`);
    }
    return data;
  }

  private base(title: string, subtitle: string, range: DateRange) {
    const u = this.auth.user();
    return {
      title,
      subtitle,
      period: this.periodLabel(range),
      generatedAt: fmtDateTime(new Date()),
      generatedBy: u ? `${u.name} (${ROLE_LABEL[u.role]})` : "Gold Monitor user",
      company: this.settings.companyName(),
      motto: this.settings.motto() || undefined,
    };
  }

  // ---------------------------------------------------------------- reports
  private define(id: ReportId, d: Dataset, range: DateRange): ReportDefinition {
    switch (id) {
      case "stone": return this.stone(d, range);
      case "produced": return this.produced(d, range);
      case "sold": return this.sold(d, range);
      default: return this.general(d, range);
    }
  }

  private stone(d: Dataset, range: DateRange): ReportDefinition {
    const rows = this.inRange(this.need(d.deliveries, "stone deliveries"), (r) => r.deliveredAt, range);
    const total = rows.reduce((a, r) => a + num(r.wheelbarrowCount), 0);
    const byDay = [...this.group(rows, (r) => dayKey(r.deliveredAt)).entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const byFetcher = [...this.group(rows, (r) => r.fetcher?.fullName ?? "Unknown").entries()]
      .map(([name, rs]) => ({ name, n: rs.length, wb: rs.reduce((a, r) => a + num(r.wheelbarrowCount), 0) }))
      .sort((a, b) => b.wb - a.wb);

    return {
      ...this.base("Stone Delivered to the Mill", "Quantities of stone, in wheelbarrows, delivered to the mill.", range),
      kpis: [
        { label: "Wheelbarrows delivered", value: int(total) },
        { label: "Deliveries made", value: int(rows.length) },
        { label: "Average per delivery", value: rows.length ? (total / rows.length).toFixed(1) : "0" },
        { label: "Waiting to be crushed (now)", value: d.summary ? int(d.summary.wheelbarrowsAvailable) : "n/a" },
      ],
      sections: [
        {
          heading: "Deliveries by day",
          columns: [
            { header: "Date", w: 3 },
            { header: "Deliveries", w: 2, align: "r" },
            { header: "Wheelbarrows", w: 2, align: "r" },
          ],
          rows: byDay.map(([k, rs]) => [fmtDate(`${k}T00:00:00`), int(rs.length), int(rs.reduce((a, r) => a + num(r.wheelbarrowCount), 0))]),
          totals: ["Total", int(rows.length), int(total)],
        },
        {
          heading: "Deliveries by stone fetcher",
          columns: [
            { header: "Stone fetcher", w: 3 },
            { header: "Deliveries", w: 2, align: "r" },
            { header: "Wheelbarrows", w: 2, align: "r" },
          ],
          rows: byFetcher.map((f) => [f.name, int(f.n), int(f.wb)]),
          totals: ["Total", int(rows.length), int(total)],
        },
        {
          heading: "Delivery detail",
          columns: [
            { header: "Date & time", w: 2.4 },
            { header: "Stone fetcher", w: 2.2 },
            { header: "Pit location", w: 2 },
            { header: "Wheelbarrows", w: 1.5, align: "r" },
            { header: "Notes", w: 2.6 },
          ],
          rows: rows.map((r) => [fmtDateTime(r.deliveredAt), r.fetcher?.fullName ?? "-", r.pitLocation || "-", int(r.wheelbarrowCount), r.notes || "-"]),
          totals: ["Total", "", "", int(total), ""],
        },
      ],
    };
  }

  private produced(d: Dataset, range: DateRange): ReportDefinition {
    const rows = this.inRange(this.need(d.runs, "crushing"), (r) => r.crushedAt, range);
    const gold = rows.reduce((a, r) => a + num(r.goldGrams), 0);
    const wb = rows.reduce((a, r) => a + num(r.wheelbarrowsCrushed), 0);
    const yieldPer = (grams: number, w: number) => (w > 0 ? g(grams / w) : "-");
    const byDay = [...this.group(rows, (r) => dayKey(r.crushedAt)).entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const byMiller = [...this.group(rows, (r) => r.miller?.fullName ?? "Unknown").entries()]
      .map(([name, rs]) => ({
        name, n: rs.length,
        wb: rs.reduce((a, r) => a + num(r.wheelbarrowsCrushed), 0),
        gold: rs.reduce((a, r) => a + num(r.goldGrams), 0),
      }))
      .sort((a, b) => b.gold - a.gold);

    return {
      ...this.base("Gold Produced", "Gold produced by the mill from each crushing run.", range),
      kpis: [
        { label: "Gold produced (g)", value: g(gold) },
        { label: "Wheelbarrows crushed", value: int(wb) },
        { label: "Crushing runs", value: int(rows.length) },
        { label: "Average yield (g / wheelbarrow)", value: yieldPer(gold, wb) },
      ],
      sections: [
        {
          heading: "Production by day",
          columns: [
            { header: "Date", w: 2.5 },
            { header: "Runs", w: 1.2, align: "r" },
            { header: "Wheelbarrows crushed", w: 2, align: "r" },
            { header: "Gold produced (g)", w: 2, align: "r" },
            { header: "Yield g / wb", w: 1.6, align: "r" },
          ],
          rows: byDay.map(([k, rs]) => {
            const w = rs.reduce((a, r) => a + num(r.wheelbarrowsCrushed), 0);
            const gg = rs.reduce((a, r) => a + num(r.goldGrams), 0);
            return [fmtDate(`${k}T00:00:00`), int(rs.length), int(w), g(gg), yieldPer(gg, w)];
          }),
          totals: ["Total", int(rows.length), int(wb), g(gold), yieldPer(gold, wb)],
        },
        {
          heading: "Production by miller",
          columns: [
            { header: "Miller", w: 2.5 },
            { header: "Runs", w: 1.2, align: "r" },
            { header: "Wheelbarrows crushed", w: 2, align: "r" },
            { header: "Gold produced (g)", w: 2, align: "r" },
            { header: "Yield g / wb", w: 1.6, align: "r" },
          ],
          rows: byMiller.map((m) => [m.name, int(m.n), int(m.wb), g(m.gold), yieldPer(m.gold, m.wb)]),
          totals: ["Total", int(rows.length), int(wb), g(gold), yieldPer(gold, wb)],
        },
        {
          heading: "Crushing run detail",
          columns: [
            { header: "Date & time", w: 2.2 },
            { header: "Miller", w: 2 },
            { header: "Wheelbarrows crushed", w: 1.8, align: "r" },
            { header: "Gold (g)", w: 1.5, align: "r" },
            { header: "Notes", w: 2.5 },
          ],
          rows: rows.map((r) => [fmtDateTime(r.crushedAt), r.miller?.fullName ?? "-", int(r.wheelbarrowsCrushed), g(r.goldGrams), r.notes || "-"]),
          totals: ["Total", "", int(wb), g(gold), ""],
        },
      ],
    };
  }

  private sold(d: Dataset, range: DateRange): ReportDefinition {
    const rows = this.inRange(this.need(d.payouts, "payouts"), (r) => r.paidAt, range);
    const sold = rows.reduce((a, r) => a + num(r.gramsSold), 0);
    const cash = rows.reduce((a, r) => a + num(r.totalCash), 0);
    const confirmed = rows.filter((r) => r.status === "CONFIRMED").reduce((a, r) => a + num(r.gramsConfirmed), 0);
    const avg = sold > 0 ? cash / sold : 0;
    const statuses: Payout["status"][] = ["CONFIRMED", "PENDING", "DISPUTED"];
    const byDay = [...this.group(rows, (r) => dayKey(r.paidAt)).entries()].sort((a, b) => b[0].localeCompare(a[0]));

    return {
      ...this.base("Gold Sold", "Gold sold by the manager and the cash paid to the owner.", range),
      kpis: [
        { label: "Gold sold (g)", value: g(sold) },
        { label: "Cash paid to owner", value: this.money(cash) },
        { label: "Average price per gram", value: this.money(avg) },
        { label: "Confirmed by owner (g)", value: g(confirmed) },
      ],
      sections: [
        {
          heading: "Sales by day",
          columns: [
            { header: "Date", w: 2.5 },
            { header: "Payouts", w: 1.2, align: "r" },
            { header: "Gold sold (g)", w: 2, align: "r" },
            { header: "Cash paid", w: 2, align: "r" },
          ],
          rows: byDay.map(([k, rs]) => [
            fmtDate(`${k}T00:00:00`), int(rs.length),
            g(rs.reduce((a, r) => a + num(r.gramsSold), 0)),
            this.money(rs.reduce((a, r) => a + num(r.totalCash), 0)),
          ]),
          totals: ["Total", int(rows.length), g(sold), this.money(cash)],
        },
        {
          heading: "Owner confirmation status",
          columns: [
            { header: "Status", w: 2.5 },
            { header: "Payouts", w: 1.2, align: "r" },
            { header: "Gold sold (g)", w: 2, align: "r" },
            { header: "Cash paid", w: 2, align: "r" },
          ],
          rows: statuses.map((s) => {
            const rs = rows.filter((r) => r.status === s);
            return [statusLabel(s), int(rs.length), g(rs.reduce((a, r) => a + num(r.gramsSold), 0)), this.money(rs.reduce((a, r) => a + num(r.totalCash), 0))];
          }),
          totals: ["Total", int(rows.length), g(sold), this.money(cash)],
        },
        {
          heading: "Sales detail",
          columns: [
            { header: "Date & time", w: 2.0 },
            { header: "Manager", w: 1.6 },
            { header: "Owner", w: 1.4 },
            { header: "Gold sold (g)", w: 1.4, align: "r" },
            { header: "Price / g", w: 1.1, align: "r" },
            { header: "Cash", w: 1.4, align: "r" },
            { header: "Status", w: 2.3 },
          ],
          rows: rows.map((r) => [
            fmtDateTime(r.paidAt), r.manager?.fullName ?? "-", r.owner?.fullName ?? "-",
            g(r.gramsSold), this.money(r.pricePerGram, r.currency), this.money(r.totalCash, r.currency),
            statusLabel(r.status) + (r.status === "CONFIRMED" ? ` (${g(r.gramsConfirmed)} g)` : ""),
          ]),
          totals: ["Total", "", "", g(sold), "", this.money(cash), ""],
        },
      ],
    };
  }

  private general(d: Dataset, range: DateRange): ReportDefinition {
    const s = this.need(d.summary, "summary");
    const dl = d.deliveries ? this.inRange(d.deliveries, (r) => r.deliveredAt, range) : null;
    const rn = d.runs ? this.inRange(d.runs, (r) => r.crushedAt, range) : null;
    const rc = d.receipts ? this.inRange(d.receipts, (r) => r.receivedAt, range) : null;
    const po = d.payouts ? this.inRange(d.payouts, (r) => r.paidAt, range) : null;
    const sum = <T>(rows: T[] | null, f: (r: T) => number) => (rows ? rows.reduce((a, r) => a + f(r), 0) : null);
    const na = "n/a";
    const nv = (v: number | null, fmt: (x: number) => string) => (v === null ? na : fmt(v));

    const wbIn = sum(dl, (r) => num(r.wheelbarrowCount));
    const wbCrushed = sum(rn, (r) => num(r.wheelbarrowsCrushed));
    const goldProd = sum(rn, (r) => num(r.goldGrams));
    const goldRecv = sum(rc, (r) => num(r.grams));
    const goldSold = sum(po, (r) => num(r.gramsSold));
    const cash = sum(po, (r) => num(r.totalCash));

    const rec = s.reconciliation;
    const var3 = (v: number | null | undefined) => (v === null || v === undefined ? "-" : Math.abs(v) <= 0.001 ? "Matches" : `${v > 0 ? "+" : ""}${g(v)} g`);

    type Log = { at: string; kind: string; by: string; detail: string; qty: string };
    const log: Log[] = [
      ...(dl ?? []).map((r) => ({ at: r.deliveredAt, kind: "Stone delivered", by: r.fetcher?.fullName ?? "-", detail: r.pitLocation || "-", qty: `${int(r.wheelbarrowCount)} wb` })),
      ...(rn ?? []).map((r) => ({ at: r.crushedAt, kind: "Crushing run", by: r.miller?.fullName ?? "-", detail: `${int(r.wheelbarrowsCrushed)} wb crushed`, qty: `${g(r.goldGrams)} g` })),
      ...(rc ?? []).map((r) => ({ at: r.receivedAt, kind: "Gold received", by: r.manager?.fullName ?? "-", detail: "Received from miller", qty: `${g(r.grams)} g` })),
      ...(po ?? []).map((r) => ({ at: r.paidAt, kind: "Gold sold", by: r.manager?.fullName ?? "-", detail: `${this.money(r.totalCash, r.currency)} to ${r.owner?.fullName ?? "owner"} - ${statusLabel(r.status)}`, qty: `${g(r.gramsSold)} g` })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      ...this.base("General Activity Report", "Overall position of the operation and everything recorded from stone delivery to cash paid out.", range),
      kpis: [
        { label: "Wheelbarrows delivered", value: nv(wbIn, int) },
        { label: "Wheelbarrows crushed", value: nv(wbCrushed, int) },
        { label: "Gold produced (g)", value: nv(goldProd, g) },
        { label: "Gold sold (g)", value: nv(goldSold, g) },
      ],
      sections: [
        {
          heading: "Activity in the selected period",
          columns: [
            { header: "Activity", w: 3 },
            { header: "Records", w: 1.2, align: "r" },
            { header: "Quantity", w: 2.4, align: "r" },
          ],
          rows: [
            ["Stone delivered to the mill", nv(dl && dl.length, int), nv(wbIn, (v) => `${int(v)} wheelbarrows`)],
            ["Stone crushed", nv(rn && rn.length, int), nv(wbCrushed, (v) => `${int(v)} wheelbarrows`)],
            ["Gold produced", nv(rn && rn.length, int), nv(goldProd, (v) => `${g(v)} g`)],
            ["Gold received by manager", nv(rc && rc.length, int), nv(goldRecv, (v) => `${g(v)} g`)],
            ["Gold sold", nv(po && po.length, int), nv(goldSold, (v) => `${g(v)} g`)],
            ["Cash paid to owner", nv(po && po.length, int), nv(cash, (v) => this.money(v))],
          ],
        },
        {
          heading: "Overall position (to date)",
          note: "Cumulative figures since records began; not affected by the period filter.",
          columns: [
            { header: "Measure", w: 3 },
            { header: "Value", w: 2.4, align: "r" },
          ],
          rows: [
            ["Stone waiting to be crushed", `${int(s.wheelbarrowsAvailable)} wheelbarrows`],
            ["Gold produced by the mill", `${g(s.goldProduced)} g`],
            ["Gold received by the manager", `${g(s.goldReceived)} g`],
            ["Gold awaiting receipt at the mill", `${g(s.goldAwaitingReceipt)} g`],
            ["Gold in the vault", `${g(s.goldInVault)} g`],
            ["Gold sold", `${g(s.goldSold)} g`],
            ["Gold confirmed by the owner", `${g(s.goldConfirmedByOwner)} g`],
            ["Gold pending owner confirmation", `${g(s.goldPendingOwnerConfirmation)} g`],
            ["Total cash paid to owner", this.money(s.cashPaid)],
          ],
        },
        {
          heading: "Reconciliation",
          note: rec?.isFullyMatched
            ? "Balanced: produced = received = sold = confirmed."
            : "Not balanced yet - see the variances below.",
          columns: [
            { header: "Stage", w: 3 },
            { header: "Grams", w: 2, align: "r" },
            { header: "Variance vs previous", w: 2.4, align: "r" },
          ],
          rows: [
            ["1. Produced by miller", g(s.goldProduced), "Starting stage"],
            ["2. Received by manager", g(s.goldReceived), var3(rec?.producedVsReceived)],
            ["3. Sold / sent to owner", g(s.goldSold), var3(rec?.receivedVsSold)],
            ["4. Confirmed by owner", g(s.goldConfirmedByOwner), var3(rec?.soldVsConfirmed)],
          ],
        },
        {
          heading: "Activity log",
          note: d.deliveries && d.runs && d.receipts && d.payouts
            ? "Newest first."
            : "Newest first. Some record types are not available to your account and are left out.",
          columns: [
            { header: "Date & time", w: 2.1 },
            { header: "Activity", w: 1.7 },
            { header: "Recorded by", w: 1.8 },
            { header: "Details", w: 3 },
            { header: "Quantity", w: 1.4, align: "r" },
          ],
          rows: log.map((l) => [fmtDateTime(l.at), l.kind, l.by, l.detail, l.qty]),
        },
      ],
    };
  }
}
