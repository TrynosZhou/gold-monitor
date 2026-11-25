import { PdfWriter, hex, textWidth, wrapText } from "./pdf-writer";

/** A table column. `w` is a relative width weight. */
export interface ReportColumn {
  header: string;
  w: number;
  align?: "l" | "r";
}

export interface ReportSection {
  heading: string;
  note?: string;
  columns: ReportColumn[];
  rows: string[][];
  /** Optional bold totals row shown under the table. */
  totals?: string[];
  emptyText?: string;
}

export interface ReportDefinition {
  /** Company name from Settings, shown in the banner and footer. */
  company?: string;
  /** Company motto from Settings, shown under the name on the first page. */
  motto?: string;
  title: string;
  subtitle: string;
  period: string;
  generatedBy: string;
  generatedAt: string;
  kpis: { label: string; value: string }[];
  sections: ReportSection[];
}

const NAVY = hex("#0f1f45");
const BLUE = hex("#1d4ed8");
const LIGHT = hex("#7fb0ff");
const PALE = hex("#eaf1ff");
const ZEBRA = hex("#f5f8fd");
const LINE = hex("#d9e2f1");
const INK = hex("#0f1b33");
const MUTED = hex("#6b778c");
const WHITE: [number, number, number] = [1, 1, 1];

const M = 40; // page margin
const FOOT = 40; // space reserved for footer

/** Keeps long names inside the banner. */
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 3)}...` : s);

export function buildReportPdf(def: ReportDefinition): Blob {
  const pdf = new PdfWriter();
  const W = pdf.pageW;
  const H = pdf.pageH;
  const contentW = W - 2 * M;
  let y = 0;
  const company = clip(def.company?.trim() || "Gold Monitor", 40);
  const motto = clip(def.motto?.trim() || "Mine  -  Mill  -  Vault", 90);

  const bottom = () => H - FOOT - 8;

  const continuationHeader = () => {
    pdf.rect(0, 0, W, 26, NAVY);
    pdf.text(company.toUpperCase(), M, 17, 8, { bold: true, color: LIGHT });
    pdf.text(def.title, W - M, 17, 8, { color: WHITE, align: "r" });
    y = 46;
  };

  const newPage = () => {
    pdf.addPage();
    continuationHeader();
  };

  const ensure = (h: number) => {
    if (y + h > bottom()) newPage();
  };

  // ---- First-page banner ----
  pdf.rect(0, 0, W, 92, NAVY);
  pdf.rect(0, 92, W, 3, BLUE);
  pdf.rect(M, 24, 22, 22, BLUE);
  pdf.rect(M + 5, 31, 12, 8, LIGHT);
  pdf.text(company.toUpperCase(), M + 32, 35, 11, { bold: true, color: LIGHT });
  pdf.text(motto, M + 32, 46, 7, { color: hex("#b9cdf5") });
  pdf.text(def.title, M, 76, 20, { bold: true, color: WHITE });
  y = 116;

  // ---- Meta ----
  pdf.text(def.subtitle, M, y, 9.5, { color: MUTED });
  y += 16;
  const meta: [string, string][] = [
    ["Period", def.period],
    ["Generated", def.generatedAt],
    ["Prepared for", def.generatedBy],
  ];
  for (const [k, v] of meta) {
    pdf.text(k, M, y, 9, { bold: true, color: INK });
    pdf.text(v, M + 78, y, 9, { color: INK });
    y += 13;
  }
  y += 8;

  // ---- KPI tiles ----
  if (def.kpis.length) {
    const perRow = Math.min(def.kpis.length, 4);
    const gap = 10;
    const tileW = (contentW - gap * (perRow - 1)) / perRow;
    const tileH = 50;
    def.kpis.forEach((k, i) => {
      const col = i % perRow;
      if (col === 0 && i > 0) y += tileH + gap;
      if (col === 0) ensure(tileH);
      const x = M + col * (tileW + gap);
      pdf.rect(x, y, tileW, tileH, PALE, LINE);
      pdf.rect(x, y, 3, tileH, BLUE);
      const labelLines = wrapText(k.label.toUpperCase(), tileW - 20, 6.5, true).slice(0, 2);
      labelLines.forEach((l, li) => pdf.text(l, x + 11, y + 14 + li * 8, 6.5, { bold: true, color: MUTED }));
      let size = 15;
      while (size > 8 && textWidth(k.value, size, true) > tileW - 20) size -= 1;
      pdf.text(k.value, x + 11, y + 42, size, { bold: true, color: NAVY });
    });
    y += tileH + 22;
  }

  // ---- Sections ----
  const PAD = 5;
  const FS = 8;
  const LH = 10.5;

  for (const sec of def.sections) {
    ensure(70);
    pdf.text(sec.heading, M, y, 12, { bold: true, color: NAVY });
    y += 5;
    pdf.line(M, y, M + 60, y, BLUE, 1.6);
    pdf.line(M + 60, y, W - M, y, LINE, 0.6);
    y += 12;
    if (sec.note) {
      const lines = wrapText(sec.note, contentW, 8, false);
      for (const l of lines) { pdf.text(l, M, y, 8, { color: MUTED }); y += 10; }
      y += 3;
    }

    const totalWeight = sec.columns.reduce((a, c) => a + c.w, 0);
    const colW = sec.columns.map((c) => (c.w / totalWeight) * contentW);
    const colX: number[] = [];
    colW.reduce((acc, w, i) => { colX[i] = M + acc; return acc + w; }, 0);

    const drawHeader = () => {
      const hLines = sec.columns.map((c, i) => wrapText(c.header.toUpperCase(), colW[i] - 2 * PAD, 6.5, true));
      const hh = Math.max(...hLines.map((l) => l.length)) * 8 + 10;
      pdf.rect(M, y, contentW, hh, BLUE);
      sec.columns.forEach((c, i) => {
        hLines[i].forEach((l, li) => {
          const tx = c.align === "r" ? colX[i] + colW[i] - PAD : colX[i] + PAD;
          pdf.text(l, tx, y + 11 + li * 8, 6.5, { bold: true, color: WHITE, align: c.align === "r" ? "r" : "l" });
        });
      });
      y += hh;
    };

    const rowHeight = (cells: string[], bold: boolean) => {
      const lines = cells.map((c, i) => wrapText(c, colW[i] - 2 * PAD, FS, bold));
      return { lines, h: Math.max(...lines.map((l) => l.length)) * LH + 7 };
    };

    const drawRow = (cells: string[], zebra: boolean, bold: boolean) => {
      const { lines, h } = rowHeight(cells, bold);
      if (y + h > bottom()) { newPage(); drawHeader(); }
      if (zebra) pdf.rect(M, y, contentW, h, ZEBRA);
      sec.columns.forEach((c, i) => {
        lines[i].forEach((l, li) => {
          const tx = c.align === "r" ? colX[i] + colW[i] - PAD : colX[i] + PAD;
          pdf.text(l, tx, y + 11 + li * LH - 1, FS, { bold, color: INK, align: c.align === "r" ? "r" : "l" });
        });
      });
      pdf.line(M, y + h, M + contentW, y + h, LINE, 0.4);
      y += h;
    };

    ensure(40);
    drawHeader();
    if (!sec.rows.length) {
      ensure(26);
      pdf.text(sec.emptyText ?? "No records for this period.", M + PAD, y + 16, 8.5, { color: MUTED });
      pdf.line(M, y + 24, M + contentW, y + 24, LINE, 0.4);
      y += 24;
    } else {
      sec.rows.forEach((r, i) => drawRow(r, i % 2 === 1, false));
    }
    if (sec.totals && sec.rows.length) {
      const { h } = rowHeight(sec.totals, true);
      if (y + h > bottom()) { newPage(); drawHeader(); }
      pdf.rect(M, y, contentW, h, PALE);
      pdf.line(M, y, M + contentW, y, BLUE, 1);
      drawRowNoBg(sec.totals);
    }
    y += 24;

    function drawRowNoBg(cells: string[]) {
      const { lines, h } = rowHeight(cells, true);
      sec.columns.forEach((c, i) => {
        lines[i].forEach((l, li) => {
          const tx = c.align === "r" ? colX[i] + colW[i] - PAD : colX[i] + PAD;
          pdf.text(l, tx, y + 11 + li * LH - 1, FS, { bold: true, color: NAVY, align: c.align === "r" ? "r" : "l" });
        });
      });
      y += h;
    }
  }

  // ---- Footers on every page ----
  const total = pdf.pageCount;
  for (let p = 0; p < total; p++) {
    pdf.onPage(p, () => {
      pdf.line(M, H - FOOT, W - M, H - FOOT, LINE, 0.6);
      pdf.text(`${company}  -  ${def.title}`, M, H - FOOT + 14, 7.5, { color: MUTED });
      pdf.text(`Page ${p + 1} of ${total}`, W - M, H - FOOT + 14, 7.5, { color: MUTED, align: "r" });
    });
  }

  return pdf.toBlob({ title: `${def.title} - ${company}`, author: def.generatedBy });
}
