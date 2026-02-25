import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Client } from '@botpress/chat';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ReviewList from './components/reviews/ReviewList';
import AnalyticsView from './components/analytics/AnalyticsView';
import DataSourceSelector from './components/reviews/DataSourceSelector';
import { mockReviews } from './data/mockData';
import './styles/App.css';


function App() {
  const [reviews, setReviews] = useState(null);
  const [dataSourceName, setDataSourceName] = useState(null);
  const [sortBy, setSortBy] = useState('most-recent');
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('inbox'); // 'inbox' or 'analytics'
  const [analyticsSeen, setAnalyticsSeen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    // Default to dark mode if no preference saved
    return saved === null ? true : saved === 'true';
  });
  const [disabledButtons, setDisabledButtons] = useState(new Set());

  // Analytics state - prefetched when reviews load
  const [analyticsData, setAnalyticsData] = useState({
    issues: null,
    polarityTopics: null,
    departmentScores: null,
    isLoading: false,
    requestedDepartments: null
  });

  // Bot client refs
  const clientRef = useRef(null);
  const conversationRef = useRef(null);
  const clientInitializedRef = useRef(false);

  // Initialize bot client once on mount
  useEffect(() => {
    if (clientInitializedRef.current) return;
    clientInitializedRef.current = true;

    const initClient = async () => {
      try {
        clientRef.current = await Client.connect({
          webhookId: import.meta.env.VITE_BOTPRESS_WEBHOOK_ID
        });

        const { conversation } = await clientRef.current.createConversation({});
        conversationRef.current = conversation;

        const serverStream = await clientRef.current.listenConversation({
          id: conversationRef.current.id
        });

        // Listen for response events from bot
        serverStream.on("event_created", (event) => {
          const { type, data } = event.payload || {};

          if (type === 'issuesResponse') {
            console.log('issues response event received', event);
            setAnalyticsData(prev => {
              const next = { ...prev, issues: data };
              if (next.issues && next.polarityTopics && next.departmentScores) next.isLoading = false;
              return next;
            });
          }
          if (type === 'polarityResponse') {
            console.log('polarity response event received', event);
            setAnalyticsData(prev => {
              const next = { ...prev, polarityTopics: data };
              if (next.issues && next.polarityTopics && next.departmentScores) next.isLoading = false;
              return next;
            });
          }
          if (type === 'departmentsResponse') {
            console.log('departments response event received', event);
            setAnalyticsData(prev => {
              const next = { ...prev, departmentScores: data };
              if (next.issues && next.polarityTopics && next.departmentScores) next.isLoading = false;
              return next;
            });
          }
        });

      } catch (err) {
        console.error('Failed to initialize bot client:', err);
      }
    };

    initClient();
  }, []);

  // Helper to wait for client to be ready, retrying every 1 second
  const waitForClient = useCallback(() => {
    return new Promise((resolve) => {
      const check = () => {
        if (clientRef.current && conversationRef.current) {
          resolve();
        } else {
          console.log('Client not ready, retrying in 1s...');
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }, []);

  // Trigger all analytics when reviews change (topics, polarity, departments)
  const triggerFullAnalysis = useCallback(async (reviewsToAnalyze) => {
    await waitForClient();

    console.log('Triggering full analysis for', reviewsToAnalyze.length, 'reviews');
    setAnalyticsData(prev => ({ ...prev, isLoading: true }));

    try {
      const conversationId = conversationRef.current.id;

      // Send single combined trigger event
      await clientRef.current.createEvent({
        conversationId,
        payload: { type: 'fullAnalysisTrigger', reviews: reviewsToAnalyze }
      });

      console.log('Full analysis event sent');
    } catch (err) {
      console.error('Failed to trigger full analysis:', err);
      setAnalyticsData(prev => ({ ...prev, isLoading: false }));
    }
  }, [waitForClient]);

  // Trigger only department analysis (for manual regeneration from DepartmentsPanel)
  const triggerDepartmentAnalysis = useCallback(async (departments) => {
    if (!reviews?.length) {
      console.log('No reviews, skipping department analysis');
      return;
    }

    await waitForClient();

    console.log('Triggering department analysis with departments:', departments);
    setAnalyticsData(prev => ({
      ...prev,
      isLoading: true,
      requestedDepartments: new Set(departments.map(d => d.toLowerCase()))
    }));

    try {
      const conversationId = conversationRef.current.id;

      await clientRef.current.createEvent({
        conversationId,
        payload: {
          type: 'departmentTrigger',
          reviews,
          departments
        }
      });

      console.log('Department analysis event sent');
    } catch (err) {
      console.error('Failed to trigger department analysis:', err);
      setAnalyticsData(prev => ({ ...prev, isLoading: false }));
    }
  }, [reviews, waitForClient]);

  const handleToggleDarkMode = () => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('darkMode', String(newValue));
      return newValue;
    });
  };

  const handleDisableButton = (buttonId) => {
    setDisabledButtons(prev => new Set([...prev, buttonId]));
  };

  const sortedReviews = useMemo(() => {
    if (!reviews) return [];
    const sorted = [...reviews];

    // Helper: push items with missing field to end
    const sortWithMissing = (arr, getField, compareFn) => {
      return arr.sort((a, b) => {
        const aVal = getField(a);
        const bVal = getField(b);
        const aMissing = aVal == null || aVal === '';
        const bMissing = bVal == null || bVal === '';

        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return compareFn(aVal, bVal);
      });
    };

    switch (sortBy) {
      case 'most-recent':
        return sortWithMissing(sorted, r => r.date, (a, b) => new Date(b) - new Date(a));
      case 'oldest-first':
        return sortWithMissing(sorted, r => r.date, (a, b) => new Date(a) - new Date(b));
      case 'highest-rated':
        return sortWithMissing(sorted, r => r.rating, (a, b) => b - a);
      case 'lowest-rated':
        return sortWithMissing(sorted, r => r.rating, (a, b) => a - b);
      default:
        return sorted;
    }
  }, [reviews, sortBy]);


  const handleDataLoaded = (loadedReviews, fileName) => {
    setReviews(loadedReviews);
    setDataSourceName(fileName);
    setError(null);
        // Trigger full analysis in background
    triggerFullAnalysis(loadedReviews);
  };

  const handleUseMockData = () => {
    const mockData = [...mockReviews];
    setReviews(mockData);
    setDataSourceName('Demo Reviews');
    setError(null);
        // Trigger full analysis in background
    triggerFullAnalysis(mockData);
  };

  const handleChangeDataSource = () => {
    setReviews(null);
    setDataSourceName(null);
    setSortBy('most-recent');
    setError(null);
        // Reset analytics data
    setAnalyticsData({
      issues: null,
      polarityTopics: null,
      departmentScores: null,
      isLoading: false
    });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
      };

  const renderContent = () => {
    if (activeView === 'analytics') {
      return (
        <AnalyticsView
          reviews={reviews}
          analyticsData={analyticsData}
          onBackToInbox={() => setActiveView('inbox')}
          onRegenerateDepartments={triggerDepartmentAnalysis}
        />
      );
    }

    if (!reviews) {
      return (
        <DataSourceSelector
          onDataLoaded={handleDataLoaded}
          onUseMockData={handleUseMockData}
          error={error}
          setError={setError}
        />
      );
    }

    return (
      <ReviewList reviews={sortedReviews} />
    );
  };

  // Analytics are ready when all three data items are loaded
  const analyticsReady = !!(analyticsData.issues && analyticsData.polarityTopics && analyticsData.departmentScores);

  // Show notification only if analytics is ready and hasn't been seen yet
  const showAnalyticsNotification = analyticsReady && !analyticsSeen;

  // Toast notification when analytics completes
  const [showToast, setShowToast] = useState(false);
  const prevAnalyticsReady = useRef(false);

  useEffect(() => {
    if (analyticsReady && !prevAnalyticsReady.current && activeView !== 'analytics') {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }
    prevAnalyticsReady.current = analyticsReady;
  }, [analyticsReady, activeView]);

  const handleGoToAnalytics = () => {
    setActiveView('analytics');
    setAnalyticsSeen(true);
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          if (view === 'analytics') setAnalyticsSeen(true);
        }}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        disabledButtons={disabledButtons}
        onDisableButton={handleDisableButton}
        showAnalyticsNotification={showAnalyticsNotification}
      />
      <div className="main-content">
        {activeView !== 'analytics' && (
          <Header
            sortBy={sortBy}
            onSortChange={handleSortChange}
            dataSourceName={dataSourceName}
            onChangeDataSource={handleChangeDataSource}
            activeView={activeView}
            onGoToAnalytics={handleGoToAnalytics}
            hasReviews={!!reviews}
            showAnalyticsNotification={showAnalyticsNotification}
            isAnalyticsLoading={analyticsData.isLoading}
          />
        )}
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
      {showToast && (
        <div className="toast" onClick={() => { setShowToast(false); handleGoToAnalytics(); }}>
          Analytics ready — click to view
        </div>
      )}
    </div>
  );
}

export default App;
