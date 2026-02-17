import { useState } from 'react';
import '../../styles/AnalyticsView.css';
import ProblemsSection from './ProblemsSection';
import PolarizingTopicsSection from './PolarizingTopicsSection';
import DepartmentScoresSection from './DepartmentScoresSection';
import DepartmentsPanel from './DepartmentsPanel';

function AnalyticsView({ reviews, analyticsData, onBackToInbox, onReanalyze }) {
  const [activeSection, setActiveSection] = useState('problems');

  const { problems, polarizingTopics, departmentScores, isLoading } = analyticsData;

  const sectionCounts = {
    problems: problems?.length ?? 5,
    balance: polarizingTopics?.length ?? 4,
    departments: departmentScores?.length ?? 6
  };

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">AI-powered insights from {reviews?.length || 0} reviews</p>
        </div>
        <div className="analytics-header-right">
          <button className="back-btn" onClick={onBackToInbox}>
            Back to Reviews
          </button>
        </div>
      </div>

      <div className="analytics-nav">
        <button
          className={`nav-tab ${activeSection === 'problems' ? 'active' : ''}`}
          onClick={() => setActiveSection('problems')}
        >
          Problems
          <span className="nav-tab-count">{sectionCounts.problems}</span>
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
        <div className="analytics-content">
          {activeSection === 'problems' && (
            <ProblemsSection problems={problems} isLoading={isLoading} />
          )}
          {activeSection === 'balance' && (
            <PolarizingTopicsSection topics={polarizingTopics} isLoading={isLoading} />
          )}
          {activeSection === 'departments' && (
            <DepartmentScoresSection departments={departmentScores} isLoading={isLoading} />
          )}
        </div>
        {activeSection === 'departments' && (
          <DepartmentsPanel
            isLoading={isLoading}
            onReanalyze={onReanalyze}
          />
        )}
      </div>
    </div>
  );
}

export default AnalyticsView;
