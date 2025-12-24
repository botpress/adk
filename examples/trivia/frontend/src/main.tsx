import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { JoinGameScreen } from './pages/JoinGameScreen.tsx'
import { LobbyScreen } from './pages/LobbyScreen.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinGameScreen />} />
        <Route path="/lobby" element={<LobbyScreen />} />
        <Route path="/chat" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
