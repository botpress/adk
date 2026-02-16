import { useState } from 'react';
import ReviewCard from './ReviewCard';
import './ReviewList.css';

function ReviewList({ reviews, stats }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const handleCardClick = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="review-list">
      <div className="review-list-content">
        {reviews.map((review, index) => (
          <ReviewCard
            key={index}
            review={review}
            isExpanded={expandedIndex === index}
            onClick={() => handleCardClick(index)}
          />
        ))}
      </div>

      <div className="review-list-footer">
        <div className="last-updated">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Last Updated 15 min ago
        </div>
        <div className="pagination">
          <span className="page-info">{stats.displayedRange} of {stats.totalReviews}</span>
          <div className="pagination-buttons">
            <button className="page-btn" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="page-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewList;
