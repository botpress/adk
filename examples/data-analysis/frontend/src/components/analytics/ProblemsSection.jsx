import { useState } from 'react';
import '../../styles/ProblemsSection.css';

// Mock data - will be populated by API later
const MOCK_TOPICS = [
  { topic: 'Slow room service response time', reviews: [
    'Waited over an hour for a simple breakfast order. Unacceptable.',
    'Room service took 45 minutes and the food was barely warm.',
    'Called three times before anyone answered for room service.',
    'The room service menu said 30 min delivery but it took over an hour.'
  ]},
  { topic: 'WiFi connectivity issues', reviews: [
    'WiFi kept dropping during my video conference. Very frustrating for a business hotel.',
    'Had to use my phone hotspot because the hotel WiFi was unusable.',
    'Internet connection was spotty at best. Couldn\'t even stream.',
    'WiFi password didn\'t work for the first day, front desk had to reset it twice.'
  ]},
  { topic: 'Long wait times at check-in', reviews: [
    'Stood in line for 40 minutes just to check in. Only one person at the desk.',
    'Check-in was painfully slow. They need more staff during peak hours.',
    'Arrived at 3pm and didn\'t get to my room until almost 4pm due to the line.'
  ]},
  { topic: 'Noise from adjacent rooms', reviews: [
    'Could hear every word from the room next door. Walls are paper thin.',
    'Neighbors were loud until 2am. Called front desk but nothing changed.',
    'The soundproofing is terrible. Heard doors slamming all night.'
  ]},
  { topic: 'Air conditioning not working properly', reviews: [
    'AC only had two settings: freezing or off. No in-between.',
    'Room was stuffy and hot. AC seemed to just blow warm air.',
    'Maintenance came twice but couldn\'t fix the AC. Had to change rooms.'
  ]},
  { topic: 'Bathroom cleanliness issues', reviews: [
    'Found hair in the bathtub when I arrived. Clearly not cleaned properly.',
    'Bathroom tiles had mold in the grout. Gross.',
    'Toilet wasn\'t properly cleaned. Had to request housekeeping immediately.'
  ]},
  { topic: 'Elevator wait times excessive', reviews: [
    'Only 2 of 4 elevators working. Waited 10 minutes every time.',
    'The elevator situation is ridiculous. So slow during busy times.'
  ]},
  { topic: 'Parking fees too high', reviews: [
    '$50 per night for parking is highway robbery.',
    'Wasn\'t told about the parking fee until checkout. $45/night is excessive.'
  ]},
  { topic: 'Breakfast buffet quality poor', reviews: [
    'Buffet items were lukewarm and looked like they\'d been sitting out for hours.',
    'Ran out of eggs at 9am. For a $30 buffet, that\'s unacceptable.'
  ]},
  { topic: 'Front desk staff unhelpful', reviews: [
    'Asked for restaurant recommendations and got a shrug. Not helpful at all.',
    'Staff seemed annoyed when I asked questions about the area.'
  ]},
  { topic: 'Pool area overcrowded', reviews: [
    'Pool was packed. No chairs available by 9am.',
    'Too many people, not enough space. Pool needs to be bigger or limit access.'
  ]},
  { topic: 'Gym equipment outdated', reviews: [
    'Half the treadmills were broken. The ones that worked were ancient.',
    'Gym needs serious updating. Equipment from the 90s.'
  ]},
  { topic: 'Room smaller than expected', reviews: [
    'Photos made the room look much bigger than it actually is.',
    'Barely enough space to open my suitcase. Very cramped.'
  ]},
  { topic: 'Housekeeping inconsistent', reviews: [
    'Housekeeping skipped our room two days in a row.',
    'Had to call twice to get fresh towels.'
  ]},
  { topic: 'TV remote not working', reviews: [
    'Remote was dead. Took an hour to get a replacement.'
  ]},
  { topic: 'Coffee maker broken', reviews: [
    'Coffee maker in room didn\'t work. No replacement available.'
  ]}
];

function ProblemsSection({ topics, isLoading }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  // Use mock data only if no real data provided
  const displayTopics = topics ?? MOCK_TOPICS;
  // Show loading only if explicitly loading AND no data yet
  const showLoading = isLoading && !topics;

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Get mention count from reviews array length
  const getMentionCount = (item) => item.reviews?.length ?? 0;

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
        {displayTopics.map((item, index) => {
          const isExpanded = expandedIndex === index;
          const hasReviews = item.reviews?.length > 0;
          const mentionCount = getMentionCount(item);

          return (
            <div key={index} className={`problem-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="problem-rank">#{index + 1}</div>
              <div className="problem-main">
                <div
                  className={`problem-header ${hasReviews ? 'clickable' : ''}`}
                  onClick={() => hasReviews && toggleExpand(index)}
                >
                  <h3 className="problem-title">{item.topic}</h3>
                  <div className="problem-meta">
                    <span className="mention-count">{mentionCount} mentions</span>
                    {hasReviews && (
                      <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                    )}
                  </div>
                </div>
                {isExpanded && hasReviews && (
                  <div className="problem-evidence">
                    <div className="evidence-label">Evidence from reviews</div>
                    <div className="evidence-list">
                      {item.reviews.map((review, reviewIndex) => {
                        // Handle both string reviews and {atomic_feedback: string} objects
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
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProblemsSection;
