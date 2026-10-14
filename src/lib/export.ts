// Report export helpers. A table is described once as headers + rows of plain
// strings and can then be written to CSV or PDF.

export interface ExportTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Save any value as a formatted JSON file. */
export function downloadJson(filename: string, value: unknown): void {
  download(filename, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(table: ExportTable): void {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','));
  // BOM so Excel reads ₹ and other non-ASCII characters correctly.
  download(`${slug(table.title)}.csv`, new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

export async function exportPdf(table: ExportTable): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new JsPDF({ orientation: table.headers.length > 6 ? 'landscape' : 'portrait' });
  // The built-in PDF fonts have no rupee glyph.
  const clean = (v: string | number) => String(v).replace(/₹/g, 'Rs ');

  doc.setFontSize(15);
  doc.text(`ShelfSync — ${table.title}`.replace('—', '-'), 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(clean(table.subtitle ?? ''), 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [table.headers],
    body: table.rows.map((row) => row.map(clean)),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [35, 53, 99] },
    alternateRowStyles: { fillColor: [246, 247, 249] },
  });
  doc.save(`${slug(table.title)}.pdf`);
}

/** Minimal CSV parser: handles quoted fields, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
