import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ReviewList from './components/ReviewList';
import AnalyticsView from './components/AnalyticsView';
import DataSourceSelector from './components/DataSourceSelector';
import { mockReviews } from './data/mockData';
import './App.css';

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
  };

  const handleUseMockData = () => {
    setReviews([...mockReviews]);
    setDataSourceName('Demo Reviews');
    setError(null);
    setPage(1);
  };

  const handleChangeDataSource = () => {
    setReviews(null);
    setDataSourceName(null);
    setSortBy('most-recent');
    setError(null);
    setPage(1);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
  };

  const renderContent = () => {
    if (activeView === 'analytics') {
      return <AnalyticsView reviews={reviews} onBackToInbox={() => setActiveView('inbox')} />;
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
        <Header
          sortBy={sortBy}
          onSortChange={handleSortChange}
          dataSourceName={dataSourceName}
          onChangeDataSource={handleChangeDataSource}
          activeView={activeView}
          onGoToAnalytics={() => setActiveView('analytics')}
          hasReviews={!!reviews}
        />
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
