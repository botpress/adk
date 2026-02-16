import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ReviewList from './components/ReviewList';
import { mockReviews, stats } from './data/mockData';
import './App.css';

function App() {
  const [sortBy, setSortBy] = useState('most-recent');

  const sortedReviews = useMemo(() => {
    const reviews = [...mockReviews];

    switch (sortBy) {
      case 'most-recent':
        return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
      case 'oldest-first':
        return reviews.sort((a, b) => new Date(a.date) - new Date(b.date));
      case 'highest-rated':
        return reviews.sort((a, b) => b.rating - a.rating);
      case 'lowest-rated':
        return reviews.sort((a, b) => a.rating - b.rating);
      default:
        return reviews;
    }
  }, [sortBy]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Header sortBy={sortBy} onSortChange={setSortBy} />
        <div className="content-area">
          <ReviewList
            reviews={sortedReviews}
            stats={stats}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
