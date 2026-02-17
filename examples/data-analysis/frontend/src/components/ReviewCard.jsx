import './ReviewCard.css';

function ReviewCard({ review, isExpanded, onClick }) {
  const renderRating = () => {
    const hasRating = review.rating != null;
    return (
      <span className={`rating-badge ${!hasRating ? 'no-data' : ''}`}>
        {hasRating ? review.rating : '?'}<span className="rating-max">/5</span>
      </span>
    );
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const guestName = review.guestName || 'Anonymous';
  const date = review.date || 'No date';

  return (
    <div
      className={`review-card ${isExpanded ? 'expanded' : ''}`}
      onClick={onClick}
    >
      <div className="review-card-header">
        <div className="reviewer-info">
          <div className="reviewer-avatar">
            {getInitials(guestName)}
          </div>
          <div className="reviewer-details">
            <span className={`reviewer-name ${!review.guestName ? 'no-data' : ''}`}>{guestName}</span>
            <span className={`review-date ${!review.date ? 'no-data' : ''}`}>{date}</span>
          </div>
        </div>
        <div className="rating">
          {renderRating()}
        </div>
      </div>

      <div className="review-card-body">
        <p className={`review-content ${isExpanded ? 'expanded' : ''}`}>
          {review.content}
        </p>
      </div>
    </div>
  );
}

export default ReviewCard;
