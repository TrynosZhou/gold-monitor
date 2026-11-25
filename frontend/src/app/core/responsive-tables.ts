/**
 * Copies each column heading onto its cells as `data-label`. On phones the
 * stylesheet turns every table row into a card and shows that label beside the value.
 * Runs on every DOM change, so tables rendered later are covered too.
 */
export function labelTables(root: ParentNode = document): void {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const headings = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, i) => {
        if (cell.tagName !== "TD") return;
        const label = headings[i] ?? "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
      });
    });
  });
}
