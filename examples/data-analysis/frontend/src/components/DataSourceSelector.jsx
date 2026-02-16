import { useRef } from 'react';
import './DataSourceSelector.css';

function DataSourceSelector({ onDataLoaded, onUseMockData, error, setError }) {
  const fileInputRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV needs header + data rows');

    const headers = lines[0].split(',').map(h => h.trim());
    const required = ['rating', 'content', 'date', 'guestName'];
    for (const field of required) {
      if (!headers.includes(field)) throw new Error(`Missing: ${field}`);
    }

    const reviews = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const review = {};
      headers.forEach((h, idx) => {
        review[h] = h === 'rating' ? parseInt(values[idx], 10) : values[idx];
      });
      reviews.push(review);
    }
    return reviews;
  };

  const parseCSVLine = (line) => {
    const values = [];
    let current = '', inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else current += char;
    }
    values.push(current.trim());
    return values;
  };

  const parseJSON = (text) => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array');
    const required = ['rating', 'content', 'date', 'guestName'];
    data.forEach((r, i) => {
      for (const f of required) if (!(f in r)) throw new Error(`Review ${i + 1} missing: ${f}`);
    });
    return data;
  };

  const handleFile = (file) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let reviews;
        if (file.name.endsWith('.json')) reviews = parseJSON(text);
        else if (file.name.endsWith('.csv')) reviews = parseCSV(text);
        else throw new Error('Use .json or .csv');
        onDataLoaded(reviews, file.name);
      } catch (err) { setError(err.message); }
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className="empty-state"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="empty-state-content">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="empty-title">No reviews loaded</p>
        <p className="empty-subtitle">Drop a file here, or choose an option below</p>

        <div className="empty-actions">
          <button className="empty-btn" onClick={() => fileInputRef.current?.click()}>
            Upload JSON / CSV
          </button>
          <button className="empty-btn primary" onClick={onUseMockData}>
            See Demo Reviews
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        {error && <p className="empty-error">{error}</p>}

        <p className="schema-note">
          Expected fields: <code>rating</code> (number 1-5), <code>content</code> (review text), <code>date</code> (e.g. "Jan 15, 2025"), <code>guestName</code> (reviewer)
        </p>
      </div>
    </div>
  );
}

export default DataSourceSelector;
