import './ReviewCard.css';

function ReviewCard({ review, isSelected, onClick }) {
  const renderPlatformIcons = () => {
    return review.platforms.map((platform, index) => {
      if (platform === 'google') {
        return (
          <span key={index} className="platform-icon google" title="Google">
            G
          </span>
        );
      }
      if (platform === 'booking') {
        return (
          <span key={index} className="platform-icon booking" title="Booking.com">
            B.
          </span>
        );
      }
      if (platform === 'tripadvisor') {
        return (
          <span key={index} className="platform-icon tripadvisor" title="TripAdvisor">
            T
          </span>
        );
      }
      return null;
    });
  };

  const renderStars = () => {
    return (
      <div className="rating">
        <span className="star">★</span>
        <span className="rating-text">{review.rating}/5</span>
      </div>
    );
  };

  return (
    <div
      className={`review-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="review-card-header">
        <div className="hotel-info">
          <div className="hotel-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#6b7280">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <span className="hotel-name">{review.hotelName}</span>
        </div>
        <div className="review-meta">
          <div className="platform-icons">
            {renderPlatformIcons()}
          </div>
          {renderStars()}
        </div>
      </div>

      <div className="review-card-body">
        <div className="review-title-row">
          <h4 className="review-title">{review.title}</h4>
          <span className="review-date">{review.date}</span>
        </div>
        <p className="review-snippet">{review.content}</p>
      </div>

      <div className="review-card-footer">
        {review.status === 'replied' ? (
          <span className="status-badge replied">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          </span>
        ) : (
          <span className="status-badge pending">
            <span className="pending-dot"></span>
          </span>
        )}
      </div>
    </div>
  );
}

export default ReviewCard;
