import { useState } from 'react';
import '../../styles/DepartmentScoresSection.css';

function DepartmentScoresSection({ departments: departmentsProp, isLoading, requestedDepartments }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [reversedCards, setReversedCards] = useState(new Set());
  const departments = departmentsProp ?? [];

  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !departmentsProp;

  const getScoreColor = (score) => {
    const pct = score * 10;
    if (pct >= 70) return 'score-good';
    if (pct >= 40) return 'score-medium';
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
          const isReversed = reversedCards.has(index);
          const displayReviews = isReversed ? [...(dept.reviews || [])].reverse() : (dept.reviews || []);

          return (
            <div
              key={index}
              className={`department-card ${isExpanded ? 'expanded' : ''} ${hasReviews ? 'clickable' : ''}`}
              onClick={() => hasReviews && toggleExpand(index)}
            >
              <div className="department-header">
                <h3 className="department-name">{dept.department}</h3>
                {requestedDepartments && !requestedDepartments.has(dept.department.toLowerCase()) && (
                  <span className="ai-detected-label">ai detected</span>
                )}
              </div>
              <div className="department-score-container">
                <span className={`department-score ${getScoreColor(dept.score)}`}>
                  {Math.round(dept.score * 10)}%
                </span>
              </div>
              <div className="department-meta">
                <span className="review-count">{reviewCount} reviews</span>
              </div>
              {hasReviews && (
                <div className="department-evidence">
                  <div className="evidence-sort-bar" onClick={(e) => {
                    e.stopPropagation();
                    setReversedCards(prev => {
                      const next = new Set(prev);
                      next.has(index) ? next.delete(index) : next.add(index);
                      return next;
                    });
                    setExpandedIndex(index);
                  }}>
                    <span className="evidence-sort-label">{isReversed ? 'most negative' : 'most positive'}</span>
                    <span className="evidence-sort-line" />
                    <span className="evidence-sort-arrow">{isReversed ? '↑' : '↓'}</span>
                  </div>
                  <div className="evidence-list">
                    {displayReviews.slice(0, isExpanded ? undefined : 1).map((review, reviewIndex) => {
                      const reviewText = typeof review === 'string'
                        ? review
                        : review.text ?? review.atomic_feedback ?? JSON.stringify(review);
                      const sentiment = typeof review === 'object' ? review.sentiment : null;
                      return (
                        <blockquote key={reviewIndex} className={`evidence-quote ${sentiment ? `sentiment-${sentiment}` : ''}`}>
                          {reviewText}
                        </blockquote>
                      );
                    })}
                  </div>
                  {!isExpanded && displayReviews.length > 1 && (
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
