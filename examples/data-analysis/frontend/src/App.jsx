import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Client } from '@botpress/chat';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ReviewList from './components/reviews/ReviewList';
import AnalyticsView from './components/analytics/AnalyticsView';
import DataSourceSelector from './components/reviews/DataSourceSelector';
import { mockReviews } from './data/mockData';
import './styles/App.css';

const PAGE_SIZE = 50;

function App() {
  const [reviews, setReviews] = useState(null);
  const [dataSourceName, setDataSourceName] = useState(null);
  const [sortBy, setSortBy] = useState('most-recent');
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState('inbox'); // 'inbox' or 'analytics'
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    // Default to dark mode if no preference saved
    return saved === null ? true : saved === 'true';
  });
  const [disabledButtons, setDisabledButtons] = useState(new Set());

  // Analytics state - prefetched when reviews load
  const [analyticsData, setAnalyticsData] = useState({
    topics: null,
    polarityTopics: null,
    departmentScores: null,
    isLoading: false
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

          if (type === 'topicsResponse') {
            console.log('topics response event received', event);
            setAnalyticsData(prev => ({ ...prev, topics: data }));
          }
          if (type === 'polarityResponse') {
            console.log('polarity response event received', event);
            // setAnalyticsData(prev => ({ ...prev, polarityTopics: data }));
          }
          if (type === 'departmentResponse') {
            console.log('departments response event received', event);
            // setAnalyticsData(prev => ({ ...prev, departmentScores: data }));
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
      const payload = { reviews: reviewsToAnalyze };
      const conversationId = conversationRef.current.id;

      // Send all 3 trigger events in parallel
      await Promise.all([
        clientRef.current.createEvent({
          conversationId,
          payload: { type: 'topicsTrigger', ...payload }
        }),
        clientRef.current.createEvent({
          conversationId,
          payload: { type: 'polarityTrigger', ...payload }
        }),
        clientRef.current.createEvent({
          conversationId,
          payload: { type: 'departmentTrigger', ...payload }
        })
      ]);

      console.log('Full analysis events sent');
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

    switch (sortBy) {
      case 'most-recent':
        return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      case 'oldest-first':
        return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      case 'highest-rated':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'lowest-rated':
        return sorted.sort((a, b) => a.rating - b.rating);
      default:
        return sorted;
    }
  }, [reviews, sortBy]);

  const totalPages = Math.ceil((reviews?.length || 0) / PAGE_SIZE);

  const paginatedReviews = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedReviews.slice(start, start + PAGE_SIZE);
  }, [sortedReviews, page]);

  const stats = useMemo(() => {
    if (!reviews) return { displayedRange: '0', totalReviews: 0 };
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, reviews.length);
    return {
      displayedRange: `${start}-${end}`,
      totalReviews: reviews.length
    };
  }, [reviews, page]);

  const handleDataLoaded = (loadedReviews, fileName) => {
    setReviews(loadedReviews);
    setDataSourceName(fileName);
    setError(null);
    setPage(1);
    // Trigger full analysis in background
    triggerFullAnalysis(loadedReviews);
  };

  const handleUseMockData = () => {
    const mockData = [...mockReviews];
    setReviews(mockData);
    setDataSourceName('Demo Reviews');
    setError(null);
    setPage(1);
    // Trigger full analysis in background
    triggerFullAnalysis(mockData);
  };

  const handleChangeDataSource = () => {
    setReviews(null);
    setDataSourceName(null);
    setSortBy('most-recent');
    setError(null);
    setPage(1);
    // Reset analytics data
    setAnalyticsData({
      topics: null,
      polarityTopics: null,
      departmentScores: null,
      isLoading: false
    });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
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
      <ReviewList
        reviews={paginatedReviews}
        stats={stats}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    );
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        disabledButtons={disabledButtons}
        onDisableButton={handleDisableButton}
      />
      <div className="main-content">
        {activeView !== 'analytics' && (
          <Header
            sortBy={sortBy}
            onSortChange={handleSortChange}
            dataSourceName={dataSourceName}
            onChangeDataSource={handleChangeDataSource}
            activeView={activeView}
            onGoToAnalytics={() => setActiveView('analytics')}
            hasReviews={!!reviews}
          />
        )}
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
