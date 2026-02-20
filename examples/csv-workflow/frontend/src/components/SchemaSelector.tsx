import { type FC, type JSX } from "react";
import { SCHEMAS, SCHEMA_KEYS } from "../types/schemas";
import type { ImportSchema } from "../types/schemas";

type Props = {
  selectedSchema: string | null;
  onSelect: (schemaKey: string) => void;
};

const ICONS: Record<ImportSchema["icon"], JSX.Element> = {
  users: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  package: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  receipt: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  ),
};

const SchemaSelector: FC<Props> = ({ selectedSchema, onSelect }) => {
  return (
    <div className="schema-selector">
      <div className="schema-cards-grid">
        {SCHEMA_KEYS.map((key) => {
          const schema = SCHEMAS[key];
          const isSelected = selectedSchema === key;

          return (
            <button
              key={key}
              className={`schema-card ${isSelected ? "schema-card-selected" : ""}`}
              onClick={() => onSelect(key)}
            >
              <div className="schema-card-icon">
                {ICONS[schema.icon]}
              </div>
              <div className="schema-card-info">
                <div className="schema-card-name">{schema.displayName}</div>
                <div className="schema-card-description">{schema.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SchemaSelector;
