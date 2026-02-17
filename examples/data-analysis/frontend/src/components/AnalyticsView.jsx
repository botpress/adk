import { useState, useEffect, useRef } from 'react';
import './AnalyticsView.css';
import { Client } from '@botpress/chat';
import ProblemsSection from './ProblemsSection';
import PolarizingTopicsSection from './PolarizingTopicsSection';
import DepartmentScoresSection from './DepartmentScoresSection';
import DepartmentsPanel from './DepartmentsPanel';

function AnalyticsView({ reviews, onBackToInbox }) {
  const [activeSection, setActiveSection] = useState('problems');

  // State for analytics data - will be fetched from API later
  const [problems, setProblems] = useState(null);
  const [polarizingTopics, setPolarizingTopics] = useState(null);
  const [departmentScores, setDepartmentScores] = useState(null);

  const clientRef = useRef(null);
  const conversationRef = useRef(null);

  const sendEvent = async (eventType) => {
    if (!clientRef.current || !conversationRef.current) {
      console.log('Client not initialized');
      return;
    }
    await clientRef.current.createEvent({
      conversationId: conversationRef.current.id,
      payload: {
        type: eventType,
        reviews
      }
    });
  };

  useEffect(() => {
    const init = async () => {
      clientRef.current = await Client.connect({
        webhookId: import.meta.env.VITE_BOTPRESS_WEBHOOK_ID
      });

      const { conversation } = await clientRef.current.createConversation({});
      conversationRef.current = conversation;

      const serverStream = await clientRef.current.listenConversation({
        id: conversationRef.current.id
      });

      serverStream.on("event_created", (event) => {
        console.log('Event received:', event);
        // TODO: Handle incoming data from bot and update state
        // Example: setProblems(event.payload.problems);
      });
    };
    init();
  }, []);

  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  const sectionCounts = {
    problems: problems?.length ?? 5,
    balance: polarizingTopics?.length ?? 4,
    departments: departmentScores?.length ?? 6
  };

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">AI-powered insights from {reviews?.length || 0} reviews</p>
        </div>
        <div className="analytics-header-right">
          <div className="event-buttons">
            <button className="event-btn" onClick={() => sendEvent('harmfulTrigger')} title="Analyze problems">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </button>
            <button className="event-btn" onClick={() => sendEvent('imbalanceTrigger')} title="Analyze balance">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18" />
              </svg>
            </button>
            <button className="event-btn" onClick={() => sendEvent('departmentTrigger')} title="Analyze departments">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
          <button className="back-btn" onClick={onBackToInbox}>
            Back to Reviews
          </button>
        </div>
      </div>

      <div className="analytics-nav">
        <button
          className={`nav-tab ${activeSection === 'problems' ? 'active' : ''}`}
          onClick={() => setActiveSection('problems')}
        >
          Problems
          <span className="nav-tab-count">{sectionCounts.problems}</span>
        </button>
        <button
          className={`nav-tab ${activeSection === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveSection('balance')}
        >
          Polarizing Topics
          <span className="nav-tab-count">{sectionCounts.balance}</span>
        </button>
        <button
          className={`nav-tab ${activeSection === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveSection('departments')}
        >
          Departments
          <span className="nav-tab-count">{sectionCounts.departments}</span>
        </button>
      </div>

      <div className="analytics-body">
        <div className="analytics-content">
          {activeSection === 'problems' && (
            <ProblemsSection problems={problems} />
          )}
          {activeSection === 'balance' && (
            <PolarizingTopicsSection topics={polarizingTopics} />
          )}
          {activeSection === 'departments' && (
            <DepartmentScoresSection departments={departmentScores} />
          )}
        </div>
        {activeSection === 'departments' && (
          <DepartmentsPanel
            isLoading={departmentsLoading}
            onSimulateComplete={() => setDepartmentsLoading(false)}
          />
        )}
      </div>
    </div>
  );
}

export default AnalyticsView;
