import { type FC, useState, useCallback, useRef, useEffect } from "react";
import type { ImportSchema } from "../types/schemas";

type Props = {
  schema: ImportSchema;
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvContent: string, fileName: string) => void;
};

const SAMPLE_DATA: Record<string, string[][]> = {
  employees: [
    ["Alice Johnson", "alice@acme.com", "Engineering", "95000", "2023-01-15"],
    ["Bob Smith", "bob-at-acme", "Marketing", "78000", "2022-06-01"],
    ["Carol Williams", "carol@acme.com", "Engineering", "102000", "2021-03-20"],
    ["David Brown", "david@acme.com", "", "85000", "2023-09-10"],
    ["Eve Davis", "eve@acme.com", "HR", "72000", "2024-01-05"],
    ["Frank Lee", "frank@acme.com", "Sales", "91000", "2023-11-20"],
    ["Alice Johnson", "alice@acme.com", "Engineering", "95000", "2023-01-15"],
    ["Grace Kim", "grace@acme.com", "Design", "88000", "2024-02-01"],
  ],
  products: [
    ["Wireless Mouse", "WM-1001", "Electronics", "29.99", "150"],
    ["Mechanical Keyboard", "KB-2050", "Electronics", "89.95", "75"],
    ["USB-C Hub", "HB-3010", "Accessories", "free", "200"],
    ["Standing Desk", "SD-4001", "", "549.99", "12"],
    ["Monitor 27\"", "MN-6010", "Monitors", "349.00", "30"],
    ["Wireless Mouse", "WM-1001", "Electronics", "29.99", "150"],
    ["Webcam HD", "WC-7001", "Electronics", "79.99", "90"],
    ["Desk Lamp", "DL-8001", "Furniture", "45.00", "55"],
  ],
  transactions: [
    ["2024-01-15", "Office Supplies", "127.50", "Operations", "Credit Card"],
    ["not-a-date", "Client Dinner", "284.00", "Sales", "Corporate Card"],
    ["2024-02-01", "Software License", "599.99", "Engineering", "Invoice"],
    ["2024-02-10", "", "412.00", "Travel", "Credit Card"],
    ["2024-02-14", "Team Lunch", "95.75", "HR", "Petty Cash"],
    ["2024-01-15", "Office Supplies", "127.50", "Operations", "Credit Card"],
    ["2024-03-01", "Cloud Hosting", "89.99", "Engineering", "Wire Transfer"],
    ["2024-03-10", "Conference Fee", "1250.00", "Marketing", "Credit Card"],
  ],
};

const CsvEditorModal: FC<Props> = ({ schema, isOpen, onClose, onImport }) => {
  const columns = schema.columns;
  const emptyRow = () => columns.map(() => "");

  const getSampleRows = () => {
    const sample = SAMPLE_DATA[schema.key];
    if (sample) return sample.map((row) => [...row]);
    return Array.from({ length: 3 }, emptyRow);
  };

  const [rows, setRows] = useState<string[][]>(getSampleRows);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShouldAnimate(true));
    } else {
      setShouldAnimate(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRows(getSampleRows());
    }
  }, [isOpen, schema.key]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    setRows((prev) => {
      const updated = prev.map((r) => [...r]);
      updated[rowIdx][colIdx] = value;
      return updated;
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow()]);
  }, [columns.length]);

  const deleteRow = useCallback((rowIdx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== rowIdx);
    });
  }, []);

  const clearAll = useCallback(() => {
    setRows(Array.from({ length: 3 }, emptyRow));
  }, [columns.length]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent, startRow: number, startCol: number) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length <= 1 && !text.includes("\t")) return;

      e.preventDefault();

      const pastedRows = lines.map((line) =>
        line.includes("\t") ? line.split("\t") : line.split(",")
      );

      setRows((prev) => {
        const updated = prev.map((r) => [...r]);

        while (updated.length < startRow + pastedRows.length) {
          updated.push(columns.map(() => ""));
        }

        for (let r = 0; r < pastedRows.length; r++) {
          for (let c = 0; c < pastedRows[r].length; c++) {
            const targetCol = startCol + c;
            if (targetCol < columns.length) {
              updated[startRow + r][targetCol] = pastedRows[r][c].trim();
            }
          }
        }

        return updated;
      });
    },
    [columns.length]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;

        if (nextCol >= 0 && nextCol < columns.length) {
          const input = tableRef.current?.querySelector(
            `[data-row="${rowIdx}"][data-col="${nextCol}"]`
          ) as HTMLInputElement;
          input?.focus();
        } else if (!e.shiftKey && nextCol >= columns.length && rowIdx < rows.length - 1) {
          const input = tableRef.current?.querySelector(
            `[data-row="${rowIdx + 1}"][data-col="0"]`
          ) as HTMLInputElement;
          input?.focus();
        } else if (e.shiftKey && nextCol < 0 && rowIdx > 0) {
          const input = tableRef.current?.querySelector(
            `[data-row="${rowIdx - 1}"][data-col="${columns.length - 1}"]`
          ) as HTMLInputElement;
          input?.focus();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (rowIdx < rows.length - 1) {
          const input = tableRef.current?.querySelector(
            `[data-row="${rowIdx + 1}"][data-col="${colIdx}"]`
          ) as HTMLInputElement;
          input?.focus();
        } else {
          addRow();
          setTimeout(() => {
            const input = tableRef.current?.querySelector(
              `[data-row="${rowIdx + 1}"][data-col="${colIdx}"]`
            ) as HTMLInputElement;
            input?.focus();
          }, 0);
        }
      }
    },
    [columns.length, rows.length, addRow]
  );

  const handleImport = () => {
    const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
    if (nonEmptyRows.length === 0) return;

    const headers = columns.map((c) => c.label).join(",");
    const csvRows = nonEmptyRows.map((row) =>
      row
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    );
    const csvContent = [headers, ...csvRows].join("\n");
    const fileName = `${schema.key}.csv`;

    onImport(csvContent, fileName);
  };

  const nonEmptyCount = rows.filter((row) => row.some((cell) => cell.trim() !== "")).length;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="csv-editor-backdrop"
        onClick={onClose}
        style={{ opacity: shouldAnimate ? 1 : 0 }}
      />

      <div className="csv-editor-positioner">
        <div
          className="csv-editor-modal"
          style={{
            transform: shouldAnimate ? "scale(1) translateY(0)" : "scale(0.97) translateY(8px)",
            opacity: shouldAnimate ? 1 : 0,
          }}
        >
          <div className="csv-editor-header">
            <div className="csv-editor-header-left">
              <h2>{schema.displayName}</h2>
              <span className="csv-editor-row-count">
                {nonEmptyCount} row{nonEmptyCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button className="csv-editor-close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="csv-editor-table-wrap" ref={tableRef}>
            <table className="csv-editor-table">
              <thead>
                <tr>
                  <th className="csv-editor-row-num">#</th>
                  {columns.map((col) => (
                    <th key={col.name}>
                      {col.label}
                      <span className="csv-editor-col-type">{col.type}</span>
                    </th>
                  ))}
                  <th className="csv-editor-actions-col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="csv-editor-row-num">{rowIdx + 1}</td>
                    {row.map((cell, colIdx) => (
                      <td key={colIdx}>
                        <input
                          type="text"
                          className="csv-editor-cell"
                          value={cell}
                          data-row={rowIdx}
                          data-col={colIdx}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                          placeholder={columns[colIdx].label}
                        />
                      </td>
                    ))}
                    <td className="csv-editor-actions-col">
                      {rows.length > 1 && (
                        <button
                          className="csv-editor-delete-row"
                          onClick={() => deleteRow(rowIdx)}
                          title="Delete row"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="csv-editor-footer">
            <div className="csv-editor-footer-left">
              <button className="csv-editor-add-row" onClick={addRow}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Row
              </button>
              <button className="csv-editor-clear" onClick={clearAll}>
                Clear All
              </button>
            </div>
            <div className="csv-editor-footer-right">
              <button className="csv-editor-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="csv-editor-import"
                onClick={handleImport}
                disabled={nonEmptyCount === 0}
              >
                Import {nonEmptyCount > 0 ? `${nonEmptyCount} Row${nonEmptyCount !== 1 ? "s" : ""}` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CsvEditorModal;
