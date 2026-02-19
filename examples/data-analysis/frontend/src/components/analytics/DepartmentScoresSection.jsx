import { useState } from 'react';
import '../../styles/DepartmentScoresSection.css';

function DepartmentScoresSection({ departments: departmentsProp, isLoading }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const departments = departmentsProp ?? [];

  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !departmentsProp;

  const getScoreColor = (score) => {
    if (score >= 4.0) return 'score-good';
    if (score >= 3.0) return 'score-medium';
    return 'score-poor';
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (showLoading) {
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
        {departments.map((dept, index) => {
          const isExpanded = expandedIndex === index;
          const hasReviews = dept.reviews?.length > 0;
          const reviewCount = dept.reviews?.length ?? 0;

          return (
            <div
              key={index}
              className={`department-card ${isExpanded ? 'expanded' : ''} ${hasReviews ? 'clickable' : ''}`}
              onClick={() => hasReviews && toggleExpand(index)}
            >
              <div className="department-header">
                <h3 className="department-name">{dept.department}</h3>
              </div>
              <div className="department-score-container">
                <span className={`department-score ${getScoreColor(dept.score)}`}>
                  {dept.score.toFixed(1)}
                </span>
              </div>
              <div className="department-meta">
                <span className="review-count">{reviewCount} reviews</span>
              </div>
              {hasReviews && (
                <div className="department-evidence">
                  <div className="evidence-list">
                    {dept.reviews.slice(0, isExpanded ? undefined : 1).map((review, reviewIndex) => {
                      const reviewText = typeof review === 'string'
                        ? review
                        : review.atomic_feedback ?? JSON.stringify(review);
                      return (
                        <blockquote key={reviewIndex} className="evidence-quote">
                          {reviewText}
                        </blockquote>
                      );
                    })}
                  </div>
                  {!isExpanded && dept.reviews.length > 1 && (
                    <div className="expand-hint">
                      +{dept.reviews.length - 1} more reviews
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DepartmentScoresSection;
