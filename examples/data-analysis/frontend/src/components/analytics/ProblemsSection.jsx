import '../../styles/ProblemsSection.css';

// Mock data - will be populated by API later
const MOCK_TOPICS = [
  { topic: 'Slow room service response time', number_of_mentions: 47 },
  { topic: 'Noise from construction nearby', number_of_mentions: 38 },
  { topic: 'Outdated room amenities', number_of_mentions: 31 },
  { topic: 'Check-in process too long', number_of_mentions: 24 },
  { topic: 'WiFi connectivity issues', number_of_mentions: 19 }
];

function ProblemsSection({ topics, isLoading }) {
  // Use mock data only if no real data provided
  const displayTopics = topics ?? MOCK_TOPICS;
  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !topics;

  if (showLoading) {
    return (
      <div className="problems-section">
        <div className="section-header">
          <h2 className="section-title">Business-Critical Topics</h2>
          <p className="section-description">Issues identified from reviews, ranked by business impact</p>
        </div>
        <div className="loading-state">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing reviews for critical topics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="problems-section">
      <div className="section-header">
        <h2 className="section-title">Business-Critical Topics</h2>
        <p className="section-description">Issues identified from reviews, ranked by business impact</p>
      </div>
      <div className="problems-list">
        {displayTopics.map((item, index) => (
          <div key={index} className="problem-card">
            <div className="problem-rank">#{index + 1}</div>
            <div className="problem-content">
              <h3 className="problem-title">{item.topic}</h3>
              <span className="mention-count">{item.number_of_mentions} mentions</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProblemsSection;
