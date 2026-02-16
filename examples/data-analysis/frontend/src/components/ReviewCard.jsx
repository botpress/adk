import './ReviewCard.css';

function ReviewCard({ review, isExpanded, onClick }) {
  const renderStars = () => {
    return Array(5).fill(0).map((_, i) => (
      <span key={i} className={`star ${i < review.rating ? 'filled' : ''}`}>★</span>
    ));
  };

  return (
    <div
      className={`review-card ${isExpanded ? 'expanded' : ''}`}
      onClick={onClick}
    >
      <div className="review-card-header">
        <div className="rating">
          {renderStars()}
          <span className="rating-text">{review.rating}/5</span>
        </div>
        <span className="review-date">{review.date}</span>
      </div>

      <div className="review-card-body">
        <p className={`review-content ${isExpanded ? 'expanded' : ''}`}>
          {review.content}
        </p>
      </div>

      <div className="review-card-footer">
        <span className="guest-name">- {review.guestName}</span>
      </div>
    </div>
  );
}

export default ReviewCard;
