import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Dashboard from './pages/Dashboard.jsx'
import MeetingRoom from './pages/MeetingRoom.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import JoinPage from './pages/JoinPage.jsx'
import WaitingRoomPage from './pages/WaitingRoomPage.jsx'

function RedirectToPythonLogin() {
  window.location.href = 'https://aiva-python-api.onrender.com/login';
  return null;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:'16px' }}>
      <div style={{ width:'44px', height:'44px', border:'3px solid #334155', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color:'#94a3b8', fontSize:'0.9rem' }}>Loading AIVA...</p>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/login" element={<RedirectToPythonLogin />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/waiting/:meetingId" element={<WaitingRoomPage />} />

      {/* Meeting room — accessible by admitted candidates via URL params (Auth Bypassed for Flask Control Plane Integration) */}
      <Route path="/meeting/:meetingId" element={<MeetingRoom />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
