import { useState } from 'react';
import '../../styles/ProblemsSection.css';

// Mock data - will be populated by API later
const MOCK_PROBLEMS = [
  {
    id: 1,
    problem: 'Slow room service response time',
    reviewCount: 47,
    severityScore: 92,
    sampleReviews: [
      'Waited 2 hours for room service breakfast',
      'Called three times before anyone answered'
    ]
  },
  {
    id: 2,
    problem: 'Noise from construction nearby',
    reviewCount: 38,
    severityScore: 78,
    sampleReviews: [
      'Construction started at 7am every day',
      'Could not sleep due to drilling sounds'
    ]
  },
  {
    id: 3,
    problem: 'Outdated room amenities',
    reviewCount: 31,
    severityScore: 65,
    sampleReviews: [
      'TV was from the 90s',
      'No USB charging ports anywhere'
    ]
  },
  {
    id: 4,
    problem: 'Check-in process too long',
    reviewCount: 24,
    severityScore: 58,
    sampleReviews: [
      'Took 45 minutes to get our room key',
      'Only one person at front desk during rush hour'
    ]
  },
  {
    id: 5,
    problem: 'WiFi connectivity issues',
    reviewCount: 19,
    severityScore: 45,
    sampleReviews: [
      'WiFi kept disconnecting during video calls',
      'Speed was unusable for work'
    ]
  }
];

function ProblemsSection({ problems: problemsProp, isLoading: isLoadingProp }) {
  const [simulatedLoading, setSimulatedLoading] = useState(true);
  const problems = problemsProp ?? MOCK_PROBLEMS;
  const isLoading = isLoadingProp || simulatedLoading;

  const getSeverityColor = (score) => {
    if (score >= 80) return 'severity-critical';
    if (score >= 60) return 'severity-high';
    if (score >= 40) return 'severity-medium';
    return 'severity-low';
  };

  if (isLoading) {
    return (
      <div className="problems-section">
        <div className="section-header">
          <h2 className="section-title">Business-Critical Problems</h2>
          <p className="section-description">Issues causing the most harm to guest satisfaction, ranked by severity</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing reviews for critical issues...</p>
            <button className="simulate-btn" onClick={() => setSimulatedLoading(false)}>
              Simulate Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="problems-section">
      <div className="section-header">
        <h2 className="section-title">Business-Critical Problems</h2>
        <p className="section-description">Issues causing the most harm to guest satisfaction, ranked by severity</p>
      </div>
      <div className="problems-list">
        {problems.map((problem, index) => (
          <div key={problem.id} className="problem-card">
            <div className="problem-rank">#{index + 1}</div>
            <div className="problem-content">
              <div className="problem-header">
                <h3 className="problem-title">{problem.problem}</h3>
                <div className={`severity-badge ${getSeverityColor(problem.severityScore)}`}>
                  {problem.severityScore}
                </div>
              </div>
              <div className="problem-meta">
                <span className="review-count">{problem.reviewCount} reviews</span>
              </div>
              <div className="problem-samples">
                {problem.sampleReviews.map((sample, i) => (
                  <p key={i} className="sample-review">"{sample}"</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProblemsSection;
