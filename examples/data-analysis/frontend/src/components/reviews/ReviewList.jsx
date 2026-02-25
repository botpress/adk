import { useState } from 'react';
import ReviewCard from './ReviewCard';
import '../../styles/ReviewList.css';

function ReviewList({ reviews }) {
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
        <span className="review-count">{reviews.length} reviews</span>
        <a href="https://botpress.com" target="_blank" rel="noopener noreferrer" className="built-with">
          Built with the Botpress ADK
        </a>
      </div>
    </div>
  );
}

export default ReviewList;
