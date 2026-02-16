import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ReviewList from './components/ReviewList';
import ReviewDetail from './components/ReviewDetail';
import { mockReviews, stats } from './data/mockData';
import './App.css';

function App() {
  const [selectedReview, setSelectedReview] = useState(mockReviews[0]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="content-area">
          <ReviewList
            reviews={mockReviews}
            selectedReview={selectedReview}
            onSelectReview={setSelectedReview}
            stats={stats}
          />
          <ReviewDetail
            review={selectedReview}
            responseRate={stats.responseRate}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
