import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Dashboard from './pages/Dashboard.jsx'
import MeetingRoom from './pages/MeetingRoom.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import JoinPage from './pages/JoinPage.jsx'
import WaitingRoomPage from './pages/WaitingRoomPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* All routes are now public as requested */}
      <Route path="/join" element={<JoinPage />} />
      <Route path="/waiting/:meetingId" element={<WaitingRoomPage />} />
      <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
      
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* No more forced login redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
