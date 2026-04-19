import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { Video, Clock, CheckCircle, XCircle, Wifi } from 'lucide-react'

export default function WaitingRoomPage() {
  const { meetingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const name = searchParams.get('name') || 'Guest'
  const email = searchParams.get('email') || ''

  const [status, setStatus] = useState('connecting')   // connecting | waiting | admitted | rejected
  const [meetingTitle, setMeetingTitle] = useState('')
  const [waitSecs, setWaitSecs] = useState(0)
  const socketRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    // Fetch meeting info
    fetch(`/api/meetings/${meetingId}`)
      .then(r => r.ok ? r.json() : null)
      .then(m => { if (m) setMeetingTitle(m.title) })
      .catch(() => {})

    // Connect socket and send knock
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('waiting')
      socket.emit('request-join', { roomId: meetingId, name, email })
      // Join the socket room so host messages reach this socket
      socket.emit('join-waiting-room', { roomId: meetingId })
    })

    socket.on('admitted', () => {
      setStatus('admitted')
      setTimeout(() => {
        const params = new URLSearchParams({ name, email, admitted: '1' })
        navigate(`/meeting/${meetingId}?${params}`)
      }, 1800)
    })

    socket.on('rejected', () => {
      setStatus('rejected')
    })

    socket.on('meeting-ended', () => {
      setStatus('rejected')
    })

    // Wait timer
    timerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000)

    return () => {
      socket.disconnect()
      clearInterval(timerRef.current)
    }
  }, [meetingId, name, email])

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const configs = {
    connecting: { icon: <Wifi size={32} color="#60a5fa" />, title: 'Connecting...', sub: 'Establishing secure connection', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    waiting:    { icon: <Clock size={32} color="#f59e0b" />, title: 'Waiting for Host', sub: 'The host will admit you shortly', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    admitted:   { icon: <CheckCircle size={32} color="#22c55e" />, title: 'Admitted!', sub: 'Joining the meeting now...', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    rejected:   { icon: <XCircle size={32} color="#ef4444" />, title: 'Request Denied', sub: 'The host has declined your request', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const cfg = configs[status]

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Animated pulsing background */}
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: cfg.color, filter: 'blur(80px)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Video size={18} color="#60a5fa" />
            <span style={{ fontWeight: '800', fontSize: '1.1rem', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIVA</span>
          </div>
          {meetingTitle && <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '4px' }}>"{meetingTitle}"</p>}
        </div>

        <div className="glass-strong" style={{ borderRadius: '20px', padding: '36px', textAlign: 'center' }}>
          {/* Status icon */}
          <motion.div key={status} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}
            style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '50%', background: cfg.bg, border: `2px solid ${cfg.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cfg.icon}
          </motion.div>

          {/* Pulsing ring for waiting */}
          {status === 'waiting' && (
            <div style={{ position: 'relative', marginTop: '-104px', marginBottom: '24px', pointerEvents: 'none' }}>
              {[1, 2, 3].map(i => (
                <motion.div key={i} animate={{ scale: [1, 2.2], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '80px', height: '80px', borderRadius: '50%', border: `2px solid ${cfg.color}`, marginTop: '-16px' }} />
              ))}
              <div style={{ height: '80px' }} />
            </div>
          )}

          <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px', color: cfg.color }}>{cfg.title}</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.87rem', marginBottom: '24px' }}>{cfg.sub}</p>

          {/* Identity card */}
          <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginBottom: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Joining as</div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{name}</div>
            {email && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>{email}</div>}
          </div>

          {/* Wait time */}
          {status === 'waiting' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '0.82rem' }}>
              <Clock size={14} />
              <span>Waiting: <strong style={{ fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>{fmt(waitSecs)}</strong></span>
            </div>
          )}

          {status === 'admitted' && (
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: '600' }}>
              ✓ Entering meeting room...
            </motion.div>
          )}

          {status === 'rejected' && (
            <motion.button whileTap={{ scale: 0.97 }} className="btn-secondary"
              onClick={() => navigate('/join')} style={{ marginTop: '8px' }}>
              ← Back to Join Page
            </motion.button>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', marginTop: '16px' }}>
          Meeting ID: <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#64748b', fontFamily: 'monospace' }}>{meetingId}</code>
        </p>
      </motion.div>
    </div>
  )
}
