import { useState } from 'react';
import '../../styles/PolaritySection.css';

function PolaritySection({ topics, isLoading }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [sortByMostBalanced, setSortByMostBalanced] = useState(false);

  const rawTopics = topics ?? [];

  // Sort by distance from 50%
  const sortByBalance = (a, b) => {
    const aDistance = Math.abs((a.polarityScore ?? 0.5) - 0.5);
    const bDistance = Math.abs((b.polarityScore ?? 0.5) - 0.5);
    return sortByMostBalanced ? aDistance - bDistance : bDistance - aDistance;
  };

  // Split into good (>= 50%) and bad (< 50%), then sort
  const goodTopics = rawTopics.filter(t => (t.polarityScore ?? 0.5) >= 0.5).sort(sortByBalance);
  const badTopics = rawTopics.filter(t => (t.polarityScore ?? 0.5) < 0.5).sort(sortByBalance);

  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !topics;

  const toggleExpand = (key) => {
    setExpandedKey(expandedKey === key ? null : key);
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

  const renderCard = (item, index) => {
    const key = `${item.topic}-${index}`;
    const isExpanded = expandedKey === key;
    const hasReviews = item.positiveReviews?.length > 0 || item.negativeReviews?.length > 0;
    const barWidths = getBarWidths(item);
    const moreCount = Math.max(0, (item.positiveReviews?.length ?? 0) - 1) + Math.max(0, (item.negativeReviews?.length ?? 0) - 1);

    return (
      <div
        key={key}
        className={`polarity-card ${isExpanded ? 'expanded' : ''} ${hasReviews ? 'clickable' : ''}`}
        onClick={() => hasReviews && toggleExpand(key)}
      >
        <div className="polarity-header">
          <h3 className="polarity-title">{item.topic}</h3>
          <div className="polarity-badge">
            {formatPolarity(item.polarityScore)} positive
          </div>
        </div>
        <div className="sentiment-bar">
          <div className="sentiment-positive" style={{ width: `${barWidths.positive}%` }} />
          <div className="sentiment-negative" style={{ width: `${barWidths.negative}%` }} />
        </div>
        <div className="sentiment-counts">
          <span className="positive-count">+{item.positiveScore ?? 0}</span>
          <span className="negative-count">−{item.negativeScore ?? 0}</span>
        </div>
        {hasReviews && (
          <div className="polarity-evidence">
            <div className="evidence-columns">
              <div className="evidence-column positive">
                <div className="evidence-label">Positive</div>
                <div className="evidence-list">
                  {(item.positiveReviews ?? []).slice(0, isExpanded ? undefined : 1).map((review, i) => {
                    const text = typeof review === 'string' ? review : review.atomic_feedback ?? JSON.stringify(review);
                    return <blockquote key={i} className="evidence-quote positive">{text}</blockquote>;
                  })}
                </div>
              </div>
              <div className="evidence-column negative">
                <div className="evidence-label">Negative</div>
                <div className="evidence-list">
                  {(item.negativeReviews ?? []).slice(0, isExpanded ? undefined : 1).map((review, i) => {
                    const text = typeof review === 'string' ? review : review.atomic_feedback ?? JSON.stringify(review);
                    return <blockquote key={i} className="evidence-quote negative">{text}</blockquote>;
                  })}
                </div>
              </div>
            </div>
            {!isExpanded && moreCount > 0 && (
              <div className="expand-hint">+{moreCount} more reviews</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="polarity-section">
      <div className="section-header">
        <h2 className="section-title">Sentiment Polarity</h2>
        <p className="section-description">
          Unbalanced topics have clear consensus — act on these with confidence.
          Balanced topics have divided opinions — these are harder to address as guests disagree.
        </p>
      </div>
      <button className="sort-indicator" onClick={() => setSortByMostBalanced(!sortByMostBalanced)}>
        <span className="sort-label">Sorted by</span>
        <span className="sort-value">{sortByMostBalanced ? 'Most Balanced' : 'Least Balanced'}</span>
        <span className="sort-arrow">{sortByMostBalanced ? '↑' : '↓'}</span>
      </button>
      <div className="polarity-columns">
        <div className="polarity-column bad">
          <div className="column-header bad">
            <span className="column-title">Mostly Negative</span>
            <span className="column-count">{badTopics.length}</span>
          </div>
          <div className="polarity-list">
            {badTopics.map((item, index) => renderCard(item, index))}
          </div>
        </div>
        <div className="polarity-column good">
          <div className="column-header good">
            <span className="column-title">Mostly Positive</span>
            <span className="column-count">{goodTopics.length}</span>
          </div>
          <div className="polarity-list">
            {goodTopics.map((item, index) => renderCard(item, index))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PolaritySection;
