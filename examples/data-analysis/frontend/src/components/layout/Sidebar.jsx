import '../../styles/Sidebar.css';

function Sidebar({ activeView, onViewChange, darkMode, onToggleDarkMode, disabledButtons, onDisableButton, showAnalyticsNotification }) {
  const handleUnimplementedClick = (buttonId) => {
    onDisableButton(buttonId);
  };

  const renderButton = (id, title, icon, onClick, isActive = false) => {
    const isDisabled = disabledButtons.has(id);

    return (
      <button
        className={`nav-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled disabled-tooltip' : ''}`}
        title={isDisabled ? undefined : title}
        data-tooltip={isDisabled ? 'Not implemented for demo' : undefined}
        onClick={isDisabled ? undefined : onClick}
        disabled={isDisabled}
      >
        {icon}
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="logo-btn" onClick={() => onViewChange('inbox')} title="Home">
          <div className="logo-mark">R</div>
        </button>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'inbox' ? 'active' : ''}`}
            title="Inbox"
            onClick={() => onViewChange('inbox')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" />
              <path d="M3 9h18" />
            </svg>
          </button>

          <button
            className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`}
            title="Analytics"
            onClick={() => onViewChange('analytics')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
            {showAnalyticsNotification && <span className="notification-dot" />}
          </button>

          {renderButton(
            'calendar',
            'Calendar',
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>,
            () => handleUnimplementedClick('calendar')
          )}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <button
          className="nav-item"
          title={darkMode ? 'Light mode' : 'Dark mode'}
          onClick={onToggleDarkMode}
        >
          {darkMode ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {renderButton(
          'help',
          'Help',
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <circle cx="12" cy="17" r="0.5" fill="currentColor" />
          </svg>,
          () => handleUnimplementedClick('help')
        )}

        {renderButton(
          'logout',
          'Logout',
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>,
          () => handleUnimplementedClick('logout')
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
