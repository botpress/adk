import { useState } from 'react';
import '../../styles/PolaritySection.css';

// Mock data - will be populated by API later
const MOCK_POLARITY_TOPICS = [
  {
    topic: 'Modern minimalist decor',
    positiveCount: 34,
    negativeCount: 29,
    polarityScore: 85,
    positiveSample: 'Loved the clean, modern aesthetic',
    negativeSample: 'Room felt cold and sterile'
  },
  {
    topic: 'Rooftop bar atmosphere',
    positiveCount: 52,
    negativeCount: 41,
    polarityScore: 72,
    positiveSample: 'Amazing views and vibe',
    negativeSample: 'Way too crowded and loud'
  },
  {
    topic: 'Breakfast buffet variety',
    positiveCount: 28,
    negativeCount: 31,
    polarityScore: 68,
    positiveSample: 'Great selection of local dishes',
    negativeSample: 'Not enough healthy options'
  },
  {
    topic: 'Location near nightlife',
    positiveCount: 45,
    negativeCount: 22,
    polarityScore: 55,
    positiveSample: 'Perfect for going out',
    negativeSample: 'Too noisy at night for families'
  }
];

function PolaritySection({ topics: topicsProp, isLoading: isLoadingProp }) {
  const [simulatedLoading, setSimulatedLoading] = useState(true);
  const topics = topicsProp ?? MOCK_POLARITY_TOPICS;
  const isLoading = isLoadingProp || simulatedLoading;

  if (isLoading) {
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
            <button className="simulate-btn" onClick={() => setSimulatedLoading(false)}>
              Simulate Complete
            </button>
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
      <div className="polarity-list">
        {topics.map((topic, index) => (
          <div key={index} className="polarity-card">
            <div className="polarity-header">
              <h3 className="polarity-title">{topic.topic}</h3>
              <div className="polarity-badge">
                {topic.polarityScore}% split
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
            <div className="polarity-samples">
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

export default PolaritySection;
