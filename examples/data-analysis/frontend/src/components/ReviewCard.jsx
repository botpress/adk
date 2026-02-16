import './ReviewCard.css';

function ReviewCard({ review, isExpanded, onClick }) {
  const renderStars = () => {
    return Array(5).fill(0).map((_, i) => (
      <span key={i} className={`star ${i < review.rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      className={`review-card ${isExpanded ? 'expanded' : ''}`}
      onClick={onClick}
    >
      <div className="review-card-header">
        <div className="reviewer-info">
          <div className="reviewer-avatar">
            {getInitials(review.guestName)}
          </div>
          <div className="reviewer-details">
            <span className="reviewer-name">{review.guestName}</span>
            <div className="rating-row">
              <div className="rating">
                {renderStars()}
              </div>
              <span className="review-date">{review.date}</span>
            </div>
          </div>
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
