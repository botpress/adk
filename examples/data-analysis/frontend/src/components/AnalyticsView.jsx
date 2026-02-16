import './AnalyticsView.css';

function AnalyticsView({ onBackToInbox }) {
  return (
    <div className="analytics-view">
      <div className="analytics-placeholder">
        <div className="analytics-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
        </div>
        <h2>AI Analytics</h2>
        <p>Analytics features coming soon</p>
        <button className="back-btn" onClick={onBackToInbox}>
          Back to Reviews
        </button>
      </div>
    </div>
  );
}

export default AnalyticsView;
