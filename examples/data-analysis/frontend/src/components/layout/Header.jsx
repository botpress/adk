import '../../styles/Header.css';

function Header({ sortBy, onSortChange, dataSourceName, onChangeDataSource, activeView, onGoToAnalytics, hasReviews, showAnalyticsNotification, isAnalyticsLoading }) {
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

      <div className="header-right">
        {activeView === 'inbox' && hasReviews && (
          <button className="analytics-btn" onClick={onGoToAnalytics}>
            {isAnalyticsLoading ? (
              <>
                <div className="btn-spinner" />
                Analyzing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10" />
                  <path d="M12 20V4" />
                  <path d="M6 20v-6" />
                </svg>
                See Analytics
                {showAnalyticsNotification && <span className="notification-dot" />}
              </>
            )}
          </button>
        )}
        <a
          href="https://botpress.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="botpress-link"
          title="Built with Botpress ADK"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M11.8968 9.51407L12.7813 10.0384L13.6659 10.5627C13.871 10.6807 14.012 10.9166 13.9992 11.1657V13.25C13.9992 13.499 13.871 13.7219 13.6659 13.853L12.7813 14.3774L11.8968 14.9017C11.6917 15.0328 11.4353 15.0328 11.2173 14.9017L10.3327 14.3774L9.44817 13.853C9.24312 13.735 9.10205 13.499 9.11492 13.25V11.2837L4.98694 8.84549L5.79463 10.0777L4.78189 10.6807C4.57676 10.8118 4.32038 10.8118 4.10241 10.6807L3.21786 10.1564L2.33331 9.63199C2.12819 9.51407 2 9.29116 2 9.04216V6.94476C2 6.69568 2.12819 6.47285 2.33331 6.34176L3.21786 5.81743L4.10241 5.2931C4.30751 5.16195 4.56389 5.16195 4.78189 5.2931L5.66644 5.81743L6.44839 6.27618L9.11492 4.7032V2.75C9.11492 2.50093 9.24312 2.27809 9.44817 2.147L10.3327 1.62266L11.2173 1.09831C11.4224 0.967229 11.6788 0.967229 11.8968 1.09831L12.7813 1.62266L13.6659 2.147C13.871 2.26498 14.012 2.50093 13.9992 2.75V4.83428C13.9992 5.08336 13.871 5.30619 13.6659 5.43727L12.7813 5.9616L11.8968 6.48593C11.6917 6.61701 11.4353 6.61701 11.2173 6.48593L10.3327 5.9616L10.2815 5.93535L11.2173 4.53278L9.56356 5.51594L6.89711 7.08893V8.93724L9.56356 10.5103L10.3456 10.0515L11.2301 9.52715C11.4224 9.38298 11.6917 9.39607 11.8968 9.51407Z" fill="currentColor"/>
          </svg>
          Built with Botpress ADK
        </a>
      </div>
    </header>
  );
}

export default Header;
