export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function parseFields(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      // Any character inside quotes (including newlines) is literal
      currentField += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
      } else if (ch === "\r") {
        // Handle \r\n or standalone \r
        currentRow.push(currentField.trim());
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < content.length && content[i] === "\n") i++;
      } else if (ch === "\n") {
        currentRow.push(currentField.trim());
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Flush last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

export function parseCSV(content: string): ParsedCSV {
  // 1. Strip UTF-8 BOM
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  content = content.trim();
  if (!content) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // 2. Auto-detect delimiter from the first line
  const firstLineEnd = content.search(/[\r\n]/);
  const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  // 3. Parse all rows using state machine
  const allRows = parseFields(content, delimiter);

  if (allRows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // 4. Extract headers from first row
  const headers = allRows[0];

  // 5. Data rows (filter out completely empty rows)
  const rows = allRows.slice(1).filter((row) => row.some((cell) => cell !== ""));

  return { headers, rows, totalRows: rows.length };
}
