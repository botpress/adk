import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ReviewList from './components/ReviewList';
import { mockReviews, stats } from './data/mockData';
import './App.css';

function App() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="content-area">
          <ReviewList
            reviews={mockReviews}
            stats={stats}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
