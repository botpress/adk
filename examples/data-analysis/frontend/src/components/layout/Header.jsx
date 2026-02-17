import '../../styles/Header.css';

function Header({ sortBy, onSortChange, dataSourceName, onChangeDataSource, activeView, onGoToAnalytics, hasReviews }) {
  const title = activeView === 'analytics' ? 'Analytics' : 'Review Inbox';

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>

        {activeView === 'inbox' && dataSourceName && (
          <div className="data-source-badge" onClick={onChangeDataSource}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {dataSourceName}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="change-icon">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}

        {activeView === 'inbox' && (
          <div className="sort-dropdown">
            <span className="sort-label">Sort By:</span>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="most-recent">Most recent</option>
              <option value="oldest-first">Oldest first</option>
              <option value="highest-rated">Highest rated</option>
              <option value="lowest-rated">Lowest rated</option>
            </select>
          </div>
        )}
      </div>

      {activeView === 'inbox' && hasReviews && (
        <button className="analytics-btn" onClick={onGoToAnalytics}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          See Analytics
        </button>
      )}
    </header>
  );
}

export default Header;
