import { type FC } from "react";

export type SampleSchema = {
  key: string;
  displayName: string;
  headers: string[];
  rows: string[][];
};

type Props = {
  schemas: SampleSchema[];
};

function downloadCsv(schema: SampleSchema) {
  const header = schema.headers.join(",");
  const body = schema.rows
    .map((row) =>
      row
        .map((cell) =>
          cell.includes(",") || cell.includes('"')
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        )
        .join(",")
    )
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${schema.key}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ICONS: Record<string, JSX.Element> = {
  employees: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  products: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  transactions: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  ),
};

const SampleCsvDownloads: FC<Props> = ({ schemas }) => {
  return (
    <div className="sample-csv-downloads">
      <p className="sample-csv-label">Download a sample CSV to get started:</p>
      <div className="sample-csv-buttons">
        {schemas.map((schema) => (
          <button
            key={schema.key}
            className="sample-csv-btn"
            onClick={() => downloadCsv(schema)}
          >
            {ICONS[schema.key] ?? null}
            <span className="sample-csv-btn-text">
              <span className="sample-csv-btn-name">{schema.displayName}</span>
              <span className="sample-csv-btn-cols">{schema.headers.join(", ")}</span>
            </span>
            <svg className="sample-csv-btn-dl" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SampleCsvDownloads;
