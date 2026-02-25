import { useState } from 'react';
import '../../styles/ProblemsSection.css';

function ProblemsSection({ issues, isLoading }) {
  const [sortAscending, setSortAscending] = useState(false); // false = highest first

  const rawIssues = issues ?? [];
  const displayIssues = sortAscending ? [...rawIssues].reverse() : rawIssues;
  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !issues;

  // Get mention count from reviews array length
  const getMentionCount = (item) => item.reviews?.length ?? 0;

  if (showLoading) {
    return (
      <div className="problems-section">
        <div className="section-header">
          <h2 className="section-title">Business-Critical Issues</h2>
          <p className="section-description">Negative feedback identified from reviews, ranked by business impact</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing reviews for critical issues...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="problems-section">
      <div className="section-header">
        <h2 className="section-title">Business-Critical Issues</h2>
        <p className="section-description">Negative feedback identified from reviews, ranked by business impact</p>
      </div>
      <button className="sort-indicator" onClick={() => setSortAscending(!sortAscending)}>
        <span className="sort-label">Sorted by</span>
        <span className="sort-value">{sortAscending ? 'Lowest Impact' : 'Highest Impact'}</span>
        <span className="sort-arrow">{sortAscending ? '↑' : '↓'}</span>
      </button>
      <div className="problems-list">
        {displayIssues.map((item, index) => {
          const hasReviews = item.reviews?.length > 0;
          const mentionCount = getMentionCount(item);

          return (
            <div key={index} className="problem-card expanded">
              <div className="problem-rank">#{index + 1}</div>
              <div className="problem-main">
                <div className="problem-header">
                  <h3 className="problem-title">{item.topic}</h3>
                  <div className="problem-meta">
                    <span className="mention-count">{mentionCount} mentions</span>
                  </div>
                </div>
                {hasReviews && (
                  <div className="problem-evidence">
                    <div className="evidence-list">
                      {item.reviews.map((review, reviewIndex) => {
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
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProblemsSection;
