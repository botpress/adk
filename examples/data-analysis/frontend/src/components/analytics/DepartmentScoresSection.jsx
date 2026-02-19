import { useState } from 'react';
import '../../styles/DepartmentScoresSection.css';

// Mock data - will be populated by API later
const MOCK_DEPARTMENT_SCORES = [
  {
    department: 'Front Desk',
    score: 3.2,
    reviews: [
      'Stood in line for 40 minutes just to check in. Only one person at the desk.',
      'Check-in was painfully slow. They need more staff during peak hours.',
      'Staff was friendly but the wait was too long.',
      'Asked for a late checkout and they accommodated without any issues.'
    ]
  },
  {
    department: 'Housekeeping',
    score: 4.1,
    reviews: [
      'Room was spotless when we arrived.',
      'Housekeeping skipped our room two days in a row.',
      'Towels were always fresh and bathroom was clean.',
      'Found hair in the bathtub when I arrived. Clearly not cleaned properly.'
    ]
  },
  {
    department: 'Room Service',
    score: 2.8,
    reviews: [
      'Waited over an hour for a simple breakfast order. Unacceptable.',
      'Room service took 45 minutes and the food was barely warm.',
      'Called three times before anyone answered for room service.'
    ]
  },
  {
    department: 'Concierge',
    score: 4.5,
    reviews: [
      'Concierge helped us get tickets to a sold-out show. Amazing!',
      'Great restaurant recommendations from the concierge.',
      'Asked for restaurant recommendations and got a shrug. Not helpful at all.'
    ]
  },
  {
    department: 'Restaurant',
    score: 3.8,
    reviews: [
      'Buffet items were lukewarm and looked like they had been sitting out for hours.',
      'Dinner at the hotel restaurant was excellent.',
      'Ran out of eggs at 9am. For a $30 buffet, that is unacceptable.'
    ]
  },
  {
    department: 'Spa & Wellness',
    score: 4.3,
    reviews: [
      'The spa was a highlight of our stay. Very relaxing.',
      'Could not book a massage because they were fully booked.',
      'Pool area was clean and well-maintained.'
    ]
  }
];

function DepartmentScoresSection({ departments: departmentsProp, isLoading }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const departments = departmentsProp ?? MOCK_DEPARTMENT_SCORES;

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
