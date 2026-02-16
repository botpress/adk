import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ReviewList from './components/ReviewList';
import DataSourceSelector from './components/DataSourceSelector';
import { mockReviews } from './data/mockData';
import './App.css';

function App() {
  const [reviews, setReviews] = useState(null);
  const [dataSourceName, setDataSourceName] = useState(null);
  const [sortBy, setSortBy] = useState('most-recent');
  const [error, setError] = useState(null);

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

  const stats = useMemo(() => {
    if (!reviews) return { displayedRange: '0', totalReviews: 0 };
    return {
      displayedRange: `1-${reviews.length}`,
      totalReviews: reviews.length
    };
  }, [reviews]);

  const handleDataLoaded = (loadedReviews, fileName) => {
    setReviews(loadedReviews);
    setDataSourceName(fileName);
    setError(null);
  };

  const handleUseMockData = () => {
    setReviews([...mockReviews]);
    setDataSourceName('Demo Reviews');
    setError(null);
  };

  const handleChangeDataSource = () => {
    setReviews(null);
    setDataSourceName(null);
    setSortBy('most-recent');
    setError(null);
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Header
          sortBy={sortBy}
          onSortChange={setSortBy}
          dataSourceName={dataSourceName}
          onChangeDataSource={handleChangeDataSource}
        />
        <div className="content-area">
          {!reviews ? (
            <DataSourceSelector
              onDataLoaded={handleDataLoaded}
              onUseMockData={handleUseMockData}
              error={error}
              setError={setError}
            />
          ) : (
            <ReviewList
              reviews={sortedReviews}
              stats={stats}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
