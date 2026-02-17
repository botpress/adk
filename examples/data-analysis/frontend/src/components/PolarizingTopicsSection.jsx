import { useState } from 'react';
import './PolarizingTopicsSection.css';

// Mock data - will be populated by API later
const MOCK_POLARIZING_TOPICS = [
  {
    id: 1,
    topic: 'Modern minimalist decor',
    positiveCount: 34,
    negativeCount: 29,
    imbalanceScore: 85,
    positiveSample: 'Loved the clean, modern aesthetic',
    negativeSample: 'Room felt cold and sterile'
  },
  {
    id: 2,
    topic: 'Rooftop bar atmosphere',
    positiveCount: 52,
    negativeCount: 41,
    imbalanceScore: 72,
    positiveSample: 'Amazing views and vibe',
    negativeSample: 'Way too crowded and loud'
  },
  {
    id: 3,
    topic: 'Breakfast buffet variety',
    positiveCount: 28,
    negativeCount: 31,
    imbalanceScore: 68,
    positiveSample: 'Great selection of local dishes',
    negativeSample: 'Not enough healthy options'
  },
  {
    id: 4,
    topic: 'Location near nightlife',
    positiveCount: 45,
    negativeCount: 22,
    imbalanceScore: 55,
    positiveSample: 'Perfect for going out',
    negativeSample: 'Too noisy at night for families'
  }
];

function PolarizingTopicsSection({ topics: topicsProp }) {
  const [isLoading, setIsLoading] = useState(true);
  const topics = topicsProp ?? MOCK_POLARIZING_TOPICS;

  if (isLoading) {
    return (
      <div className="polarizing-section">
        <div className="section-header">
          <h2 className="section-title">Polarizing Topics</h2>
          <p className="section-description">Topics with mixed sentiment — opportunities to understand diverse guest preferences</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Identifying polarizing topics...</p>
            <button className="simulate-btn" onClick={() => setIsLoading(false)}>
              Simulate Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="polarizing-section">
      <div className="section-header">
        <h2 className="section-title">Polarizing Topics</h2>
        <p className="section-description">Topics with mixed sentiment — opportunities to understand diverse guest preferences</p>
      </div>
      <div className="polarizing-list">
        {topics.map((topic) => (
          <div key={topic.id} className="polarizing-card">
            <div className="polarizing-header">
              <h3 className="polarizing-title">{topic.topic}</h3>
              <div className="imbalance-badge">
                {topic.imbalanceScore}% split
              </div>
            </div>
            <div className="sentiment-bar">
              <div
                className="sentiment-positive"
                style={{ width: `${(topic.positiveCount / (topic.positiveCount + topic.negativeCount)) * 100}%` }}
              />
              <div
                className="sentiment-negative"
                style={{ width: `${(topic.negativeCount / (topic.positiveCount + topic.negativeCount)) * 100}%` }}
              />
            </div>
            <div className="sentiment-counts">
              <span className="positive-count">+{topic.positiveCount}</span>
              <span className="negative-count">−{topic.negativeCount}</span>
            </div>
            <div className="polarizing-samples">
              <div className="sample positive">
                <span className="sample-label">Positive</span>
                <p>"{topic.positiveSample}"</p>
              </div>
              <div className="sample negative">
                <span className="sample-label">Negative</span>
                <p>"{topic.negativeSample}"</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PolarizingTopicsSection;
