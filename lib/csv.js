/**
 * Minimal RFC-4180-ish CSV parser. Handles:
 *   - quoted fields with embedded commas and newlines
 *   - "" (doubled quote) as an escape for " inside a quoted field
 *   - CRLF and LF line endings
 *   - trailing newline is tolerated
 *
 * Returns an array of rows, each row is an array of raw string cells.
 * The first row is NOT auto-detected as a header — callers do that themselves.
 *
 * Kept intentionally small (no dependencies). If the project ever adds a real
 * CSV dependency, replace this with `csv-parse/sync`.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"' && field.length === 0) {
      inQuotes = true;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\r') {
      // CRLF or bare CR — treat as row terminator
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (text[i + 1] === '\n') i++;
      continue;
    }

    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += c;
  }

  // Flush trailing field (only if there's actual pending content)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Trim empty trailing row from a final newline
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}
