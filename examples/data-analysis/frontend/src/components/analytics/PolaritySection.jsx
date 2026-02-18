import { useState } from 'react';
import '../../styles/PolaritySection.css';

// Mock data - will be populated by API later
const MOCK_POLARITY_TOPICS = [
  {
    topic: 'Modern minimalist decor',
    positiveScore: 34,
    negativeScore: 29,
    polarityScore: 0.54,
    positiveReviews: [
      'Loved the clean, modern aesthetic',
      'The minimalist design was refreshing',
      'Room decor was stylish and contemporary'
    ],
    negativeReviews: [
      'Room felt cold and sterile',
      'Too minimalist, lacked warmth',
      'Decor felt impersonal'
    ]
  },
  {
    topic: 'Rooftop bar atmosphere',
    positiveScore: 52,
    negativeScore: 41,
    polarityScore: 0.56,
    positiveReviews: [
      'Amazing views and vibe',
      'Perfect spot for sunset drinks',
      'Great ambiance at the rooftop'
    ],
    negativeReviews: [
      'Way too crowded and loud',
      'Hard to get a table',
      'Music was too loud to have a conversation'
    ]
  },
  {
    topic: 'Breakfast buffet variety',
    positiveScore: 28,
    negativeScore: 31,
    polarityScore: 0.47,
    positiveReviews: [
      'Great selection of local dishes',
      'Loved the variety of options'
    ],
    negativeReviews: [
      'Not enough healthy options',
      'Limited vegetarian choices',
      'Same items every day'
    ]
  },
  {
    topic: 'Location near nightlife',
    positiveScore: 45,
    negativeScore: 22,
    polarityScore: 0.67,
    positiveReviews: [
      'Perfect for going out',
      'Walking distance to great bars'
    ],
    negativeReviews: [
      'Too noisy at night for families',
      'Street noise was disruptive'
    ]
  }
];

function PolaritySection({ topics, isLoading }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [sortByBalanced, setSortByBalanced] = useState(false); // false = most polarized first

  // Use mock data only if no real data provided
  const rawTopics = topics ?? MOCK_POLARITY_TOPICS;

  // Sort by polarity (distance from 50%)
  const displayTopics = [...rawTopics].sort((a, b) => {
    const aDistance = Math.abs((a.polarityScore ?? 0.5) - 0.5);
    const bDistance = Math.abs((b.polarityScore ?? 0.5) - 0.5);
    return sortByBalanced ? aDistance - bDistance : bDistance - aDistance;
  });

  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !topics;

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Format polarity score as percentage
  const formatPolarity = (score) => {
    if (score === undefined || score === null) return '50%';
    // Handle both 0-1 and 0-100 formats
    const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
    return `${pct}%`;
  };

  // Get bar widths from scores
  const getBarWidths = (item) => {
    const pos = item.positiveScore ?? 50;
    const neg = item.negativeScore ?? 50;
    const total = pos + neg;
    if (total === 0) return { positive: 50, negative: 50 };
    return {
      positive: (pos / total) * 100,
      negative: (neg / total) * 100
    };
  };

  if (showLoading) {
    return (
      <div className="polarity-section">
        <div className="section-header">
          <h2 className="section-title">Polarizing Topics</h2>
          <p className="section-description">Topics with mixed sentiment — opportunities to understand diverse guest preferences</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Identifying polarizing topics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="polarity-section">
      <div className="section-header">
        <h2 className="section-title">Polarizing Topics</h2>
        <p className="section-description">Topics with mixed sentiment — opportunities to understand diverse guest preferences</p>
      </div>
      <button className="sort-indicator" onClick={() => setSortByBalanced(!sortByBalanced)}>
        <span className="sort-label">Sorted by</span>
        <span className="sort-value">{sortByBalanced ? 'Most Balanced' : 'Most Polarized'}</span>
        <span className="sort-arrow">{sortByBalanced ? '↑' : '↓'}</span>
      </button>
      <div className="polarity-list">
        {displayTopics.map((item, index) => {
          const isExpanded = expandedIndex === index;
          const hasReviews = item.positiveReviews?.length > 0 || item.negativeReviews?.length > 0;
          const barWidths = getBarWidths(item);

          return (
            <div key={index} className={`polarity-card ${isExpanded ? 'expanded' : ''}`}>
              <div
                className={`polarity-header ${hasReviews ? 'clickable' : ''}`}
                onClick={() => hasReviews && toggleExpand(index)}
              >
                <h3 className="polarity-title">{item.topic}</h3>
                <div className="polarity-header-right">
                  <div className="polarity-badge">
                    {formatPolarity(item.polarityScore)} split
                  </div>
                  {hasReviews && (
                    <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                  )}
                </div>
              </div>
              <div className="sentiment-bar">
                <div
                  className="sentiment-positive"
                  style={{ width: `${barWidths.positive}%` }}
                />
                <div
                  className="sentiment-negative"
                  style={{ width: `${barWidths.negative}%` }}
                />
              </div>
              <div className="sentiment-counts">
                <span className="positive-count">+{item.positiveScore ?? 0}</span>
                <span className="negative-count">−{item.negativeScore ?? 0}</span>
              </div>
              {hasReviews && (
                <div className="polarity-evidence">
                  <div className="evidence-columns">
                    <div className="evidence-column positive">
                      <div className="evidence-label">Positive feedback</div>
                      <div className="evidence-list">
                        {(item.positiveReviews ?? []).slice(0, isExpanded ? undefined : 1).map((review, i) => {
                          const text = typeof review === 'string' ? review : review.atomic_feedback ?? JSON.stringify(review);
                          return (
                            <blockquote key={i} className="evidence-quote positive">
                              {text}
                            </blockquote>
                          );
                        })}
                      </div>
                    </div>
                    <div className="evidence-column negative">
                      <div className="evidence-label">Negative feedback</div>
                      <div className="evidence-list">
                        {(item.negativeReviews ?? []).slice(0, isExpanded ? undefined : 1).map((review, i) => {
                          const text = typeof review === 'string' ? review : review.atomic_feedback ?? JSON.stringify(review);
                          return (
                            <blockquote key={i} className="evidence-quote negative">
                              {text}
                            </blockquote>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {!isExpanded && ((item.positiveReviews?.length > 1) || (item.negativeReviews?.length > 1)) && (
                    <button className="view-more-btn" onClick={() => toggleExpand(index)}>
                      View {((item.positiveReviews?.length ?? 0) - 1) + ((item.negativeReviews?.length ?? 0) - 1)} more reviews
                    </button>
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

export default PolaritySection;
