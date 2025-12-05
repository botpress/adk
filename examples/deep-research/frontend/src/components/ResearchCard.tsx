import { type FC } from "react";
import type { ResearchData } from "../types/research";

type Props = {
  data: ResearchData;
  onExpand: () => void;
};

const ResearchCard: FC<Props> = ({ data, onExpand }) => {
  const { title, topic, progress, status, summary } = data;

  const getStatusText = () => {
    switch (status) {
      case 'in_progress':
        return 'In progress';
      case 'done':
        return 'Complete';
      case 'errored':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Starting research';
    }
  };

  return (
    <div
      onClick={onExpand}
      className={`research-card ${status === 'done' ? 'research-card-done' : ''}`}
      style={{
        padding: '14px 16px',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        maxWidth: '600px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="research-card-title" style={{
            fontWeight: 600,
            fontSize: '15px',
            marginBottom: '4px',
            lineHeight: '1.3'
          }}>
            {title}
          </div>
          {/* Show summary when done, otherwise show topic */}
          {status === 'done' && summary ? (
            <div className="research-card-summary" style={{
              fontSize: '14px',
              lineHeight: '1.5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}>
              {summary}
            </div>
          ) : (
            <div className="research-card-topic" style={{
              fontSize: '14px',
              lineHeight: '1.4',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {topic}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          {status === 'in_progress' && (
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
          )}
          {status === 'done' && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#10b981"/>
              <path d="M14 7L8.5 12.5L6 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {status === 'errored' && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#ef4444"/>
              <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {status === 'cancelled' && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#f59e0b"/>
              <rect x="6" y="9" width="8" height="2" rx="1" fill="white"/>
            </svg>
          )}
        </div>
      </div>

      {/* Progress Bar - hide when done */}
      {status !== 'done' && (
        <div style={{ marginBottom: '8px' }}>
          <div className="research-card-progress-track" style={{
            width: '100%',
            height: '4px',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor:
                  status === 'errored' ? '#ef4444' :
                  status === 'cancelled' ? '#f59e0b' :
                  '#3b82f6',
                transition: 'width 0.3s ease',
                borderRadius: '2px'
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: status === 'done' ? '12px' : '0' }}>
        <span className={status === 'done' ? 'research-card-status-done' : 'research-card-status'} style={{
          fontSize: '13px',
          fontWeight: status === 'done' ? 500 : 400
        }}>
          {getStatusText()}
        </span>
        <span style={{
          fontSize: '13px',
          color: status === 'done' ? '#059669' : '#3b82f6',
          fontWeight: 500,
          opacity: status === 'done' ? 1 : 0,
          transition: 'opacity 0.15s ease'
        }} className="view-details-text">
          {status === 'done' ? 'View Report →' : 'View details →'}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        div:hover .view-details-text {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ResearchCard;
