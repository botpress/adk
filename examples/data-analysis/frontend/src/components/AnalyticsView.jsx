import { useEffect, useRef } from 'react';
import './AnalyticsView.css';
import { Client } from '@botpress/chat'

function AnalyticsView({ reviews, onBackToInbox }) {
  const clientRef = useRef(null);
  const conversationRef = useRef(null);

  const sendEvent = async () => {
    await clientRef.current.createEvent({
      conversationId: conversationRef.current.id,
      payload: {
        type: 'harmfulTrigger',
        reviews
      }
    });
  };

  // auth client, create convo, setup listeners
  useEffect(() => {
    const init = async () => {

      // auth client
      clientRef.current = await Client.connect({
        webhookId: import.meta.env.VITE_BOTPRESS_WEBHOOK_ID
      });

      // create conversation
      const { conversation } = await clientRef.current.createConversation({})
      conversationRef.current = conversation

      const serverStream = await clientRef.current.listenConversation({
        id: conversationRef.current.id
      })

      serverStream.on("message_created", (event) => {
      })

      serverStream.on("event_created", (event) => {

      });
    }
    init
  }, []);

  return (
    <div className="analytics-view">
      <div className="analytics-placeholder">
        <div className="analytics-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
        </div>
        <h2>Analytics</h2>
        <p>Analytics features coming soon</p>
        <button className="send-event-btn" onClick={sendEvent}>
          Send Event
        </button>
        <button className="back-btn" onClick={onBackToInbox}>
          Back to Reviews
        </button>
      </div>
    </div>
  );
}

export default AnalyticsView;
