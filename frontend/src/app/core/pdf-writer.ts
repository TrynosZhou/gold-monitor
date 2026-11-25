/**
 * Minimal, dependency-free PDF writer (A4, built-in Helvetica fonts).
 * Only printable ASCII is supported; other characters are transliterated.
 * Coordinates are in points, origin at the TOP-LEFT of the page.
 */

const W_REG = [278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 278, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 278, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

/** Make text safe for the standard PDF fonts. */
export function clean(s: string): string {
  return String(s ?? "")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u00B7\u2022]/g, "-")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
}

export function textWidth(s: string, size: number, bold = false): number {
  const table = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of clean(s)) w += table[ch.charCodeAt(0) - 32] ?? 556;
  return (w * size) / 1000;
}

/** Word-wrap text to a maximum width; over-long words are hard-broken. */
export function wrapText(s: string, maxW: number, size: number, bold = false): string[] {
  const words = clean(s).split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const push = () => { if (cur) lines.push(cur); cur = ""; };
  for (let word of words) {
    while (textWidth(word, size, bold) > maxW) {
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxW) cut--;
      push();
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const test = cur ? cur + " " + word : word;
    if (textWidth(test, size, bold) <= maxW) cur = test;
    else { push(); cur = word; }
  }
  push();
  return lines.length ? lines : [""];
}

const esc = (s: string) => clean(s).replace(/([\\()])/g, "\\$1");
const n = (v: number) => (Math.round(v * 100) / 100).toString();

export class PdfWriter {
  readonly pageW = 595.28;
  readonly pageH = 841.89;
  private pages: string[][] = [];
  private cur: string[] = [];

  constructor() { this.addPage(); }

  get pageCount() { return this.pages.length; }

  addPage() {
    this.cur = [];
    this.pages.push(this.cur);
  }

  /** Draw on a specific, already-created page (used for footers). */
  onPage(index: number, fn: () => void) {
    const keep = this.cur;
    this.cur = this.pages[index];
    fn();
    this.cur = keep;
  }

  rect(x: number, y: number, w: number, h: number, fill?: RGB, stroke?: RGB, lineW = 0.6) {
    const ops: string[] = [];
    if (fill) ops.push(`${fill.map(n).join(" ")} rg`);
    if (stroke) ops.push(`${stroke.map(n).join(" ")} RG ${n(lineW)} w`);
    ops.push(`${n(x)} ${n(this.pageH - y - h)} ${n(w)} ${n(h)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    this.cur.push(ops.join(" "));
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, lineW = 0.6) {
    this.cur.push(`${color.map(n).join(" ")} RG ${n(lineW)} w ${n(x1)} ${n(this.pageH - y1)} m ${n(x2)} ${n(this.pageH - y2)} l S`);
  }

  /** (x, y) is the text baseline. align: l = x is left edge, r = x is right edge, c = x is centre. */
  text(str: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: RGB; align?: "l" | "r" | "c" } = {}) {
    const { bold = false, color = [0, 0, 0], align = "l" } = opts;
    const w = textWidth(str, size, bold);
    const px = align === "r" ? x - w : align === "c" ? x - w / 2 : x;
    this.cur.push(
      `BT ${color.map(n).join(" ")} rg /${bold ? "F2" : "F1"} ${n(size)} Tf ${n(px)} ${n(this.pageH - y)} Td (${esc(str)}) Tj ET`,
    );
  }

  /** Serialise to a PDF file. */
  toBlob(info: { title: string; author?: string }): Blob {
    const objs: string[] = [];
    const add = (body: string) => { objs.push(body); return objs.length; };

    const catalog = add("");
    const pagesObj = add("");
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const infoObj = add(`<< /Title (${esc(info.title)}) /Author (${esc(info.author ?? "Gold Monitor")}) /Producer (Gold Monitor) >>`);

    const kids: number[] = [];
    for (const ops of this.pages) {
      const content = ops.join("\n");
      const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const p = add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n(this.pageW)} ${n(this.pageH)}] ` +
          `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`,
      );
      kids.push(p);
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>`;

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    // All content is ASCII, so one character == one byte.
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: "application/pdf" });
  }
}
