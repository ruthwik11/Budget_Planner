/**
 * CSV helpers.
 * - Export neutralises spreadsheet formula injection (cells starting with = + - @ tab CR).
 * - Import is a small RFC-4180 parser (quoted fields, escaped quotes, CRLF).
 */
export function escapeCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

export function parseCSV(text: string, maxRows = 20_000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      if (rows.length > maxRows) throw new Error(`CSV exceeds ${maxRows} rows`);
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
