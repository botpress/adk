import { useState } from 'react';
import '../../styles/DepartmentScoresSection.css';

// Mock data - will be populated by API later
const MOCK_DEPARTMENT_SCORES = [
  {
    department: 'Front Desk',
    score: 3.2,
    reviewCount: 156,
    trend: 'down',
    topIssue: 'Long wait times'
  },
  {
    department: 'Housekeeping',
    score: 4.1,
    reviewCount: 203,
    trend: 'up',
    topIssue: 'Inconsistent cleaning quality'
  },
  {
    department: 'Room Service',
    score: 2.8,
    reviewCount: 89,
    trend: 'down',
    topIssue: 'Slow delivery times'
  },
  {
    department: 'Concierge',
    score: 4.5,
    reviewCount: 67,
    trend: 'up',
    topIssue: 'Limited local knowledge'
  },
  {
    department: 'Restaurant',
    score: 3.8,
    reviewCount: 134,
    trend: 'stable',
    topIssue: 'Menu variety'
  },
  {
    department: 'Spa & Wellness',
    score: 4.3,
    reviewCount: 45,
    trend: 'up',
    topIssue: 'Booking availability'
  }
];

function DepartmentScoresSection({ departments: departmentsProp, isLoading: isLoadingProp }) {
  const [simulatedLoading, setSimulatedLoading] = useState(true);
  const departments = departmentsProp ?? MOCK_DEPARTMENT_SCORES;
  const loading = isLoadingProp || simulatedLoading;

  const getScoreColor = (score) => {
    if (score >= 4.0) return 'score-good';
    if (score >= 3.0) return 'score-medium';
    return 'score-poor';
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  if (loading) {
    return (
      <div className="departments-section">
        <div className="section-header">
          <h2 className="section-title">Department Performance</h2>
          <p className="section-description">Performance scores by department for targeted improvement efforts</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Scoring department performance...</p>
            <button className="simulate-btn" onClick={() => setSimulatedLoading(false)}>
              Simulate Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="departments-section">
      <div className="section-header">
        <h2 className="section-title">Department Performance</h2>
        <p className="section-description">Performance scores by department for targeted improvement efforts</p>
      </div>
      <div className="departments-grid">
        {departments.map((dept, index) => (
          <div key={index} className="department-card">
            <div className="department-header">
              <h3 className="department-name">{dept.department}</h3>
              <span className={`trend-indicator trend-${dept.trend}`}>
                {getTrendIcon(dept.trend)}
              </span>
            </div>
            <div className="department-score-container">
              <span className={`department-score ${getScoreColor(dept.score)}`}>
                {dept.score.toFixed(1)}
              </span>
              <span className="score-max">/5</span>
            </div>
            <div className="department-meta">
              <span className="review-count">{dept.reviewCount} reviews</span>
            </div>
            <div className="department-issue">
              <span className="issue-label">Top issue:</span>
              <span className="issue-text">{dept.topIssue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DepartmentScoresSection;
