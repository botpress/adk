import { useState } from 'react';
import ReviewCard from './ReviewCard';
import '../../styles/ReviewList.css';

function ReviewList({ reviews, stats, page, totalPages, onPageChange }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const handleCardClick = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handlePrevPage = () => {
    if (page > 1) {
      onPageChange(page - 1);
      setExpandedIndex(null);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
      setExpandedIndex(null);
    }
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
        <a href="https://botpress.com" target="_blank" rel="noopener noreferrer" className="built-with">
          Built with the Botpress ADK
        </a>
        <div className="pagination">
          <span className="page-info">{stats.displayedRange} of {stats.totalReviews}</span>
          <div className="pagination-buttons">
            <button className="page-btn" disabled={page <= 1} onClick={handlePrevPage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="page-btn" disabled={page >= totalPages} onClick={handleNextPage}>
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
