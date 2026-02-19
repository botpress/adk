import { useState } from 'react';
import '../../styles/AnalyticsView.css';
import ProblemsSection from './ProblemsSection';
import PolaritySection from './PolaritySection';
import DepartmentScoresSection from './DepartmentScoresSection';
import DepartmentsPanel from './DepartmentsPanel';

function AnalyticsView({ reviews, analyticsData, onBackToInbox, onRegenerateDepartments }) {
  const [activeSection, setActiveSection] = useState('issues');

  const { issues, polarityTopics, departmentScores, isLoading } = analyticsData;

  const sectionCounts = {
    issues: issues?.length ?? '–',
    balance: polarityTopics?.length ?? '–',
    departments: departmentScores?.length ?? '–'
  };

  // Calculate total atomic topics from polarity data
  const atomicTopicsCount = polarityTopics?.reduce((total, topic) => {
    return total + (topic.positiveReviews?.length ?? 0) + (topic.negativeReviews?.length ?? 0);
  }, 0) ?? 0;

  const hasReviews = reviews && reviews.length > 0;

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">
            AI business analytics from {reviews?.length || 0} reviews split into {atomicTopicsCount || '–'} atomic topics
          </p>
        </div>
        <div className="analytics-header-right">
          <button className="back-btn" onClick={onBackToInbox}>
            Back to Reviews
          </button>
        </div>
      </div>

      <div className="analytics-nav">
        <button
          className={`nav-tab ${activeSection === 'issues' ? 'active' : ''}`}
          onClick={() => setActiveSection('issues')}
        >
          Issues
          <span className="nav-tab-count">{sectionCounts.issues}</span>
        </button>
        <button
          className={`nav-tab ${activeSection === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveSection('balance')}
        >
          Polarizing Topics
          <span className="nav-tab-count">{sectionCounts.balance}</span>
        </button>
        <button
          className={`nav-tab ${activeSection === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveSection('departments')}
        >
          Departments
          <span className="nav-tab-count">{sectionCounts.departments}</span>
        </button>
      </div>

      <div className="analytics-body">
        {hasReviews ? (
          <>
            <div className="analytics-content">
              {activeSection === 'issues' && (
                <ProblemsSection issues={issues} isLoading={isLoading} />
              )}
              {activeSection === 'balance' && (
                <PolaritySection topics={polarityTopics} isLoading={isLoading} />
              )}
              {activeSection === 'departments' && (
                <DepartmentScoresSection departments={departmentScores} isLoading={isLoading} />
              )}
            </div>
            {activeSection === 'departments' && (
              <DepartmentsPanel
                departments={departmentScores}
                isLoading={isLoading}
                onRegenerateDepartments={onRegenerateDepartments}
              />
            )}
          </>
        ) : (
          <div className="analytics-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
            <h2>No Reviews Loaded</h2>
            <p>Load reviews first to generate analytics insights.</p>
            <button className="back-btn" onClick={onBackToInbox}>
              Load Reviews
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsView;
