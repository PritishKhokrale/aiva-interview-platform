import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Video, LogIn, ArrowRight, Hash } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function JoinPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [meetingId, setMeetingId] = useState('')
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async (e) => {
    e?.preventDefault()
    const id = meetingId.trim()
    if (!id) { setError('Please enter a meeting ID'); return }
    if (!name.trim()) { setError('Please enter your name'); return }
    setError(''); setLoading(true)

    try {
      // Verify the meeting exists
      const res = await fetch(`/api/meetings/${id}`)
      if (!res.ok) { setError('Meeting not found. Check the ID and try again.'); setLoading(false); return }
      const meeting = await res.json()
      if (meeting.status === 'ended') { setError('This meeting has already ended.'); setLoading(false); return }

      // Go to waiting room
      const params = new URLSearchParams({ name: name.trim(), email: email.trim() })
      navigate(`/waiting/${id}?${params}`)
    } catch {
      setError('Could not connect to server. Make sure the server is running.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background */}
      {[0, 1, 2].map(i => (
        <motion.div key={i} animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 1.5 }}
          style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.12,
            width: ['400px', '300px', '350px'][i], height: ['400px', '300px', '350px'][i],
            background: ['#3b82f6', '#6366f1', '#8b5cf6'][i],
            top: ['10%', '60%', '30%'][i], left: ['60%', '10%', '75%'][i] }} />
      ))}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', margin: '0 auto 14px', borderRadius: '16px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(59,130,246,0.4)' }}>
            <Video size={24} color="white" />
          </div>
          <h1 style={{ fontWeight: '800', fontSize: '1.5rem', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Join Interview</h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>Enter your meeting ID to join</p>
        </div>

        <form onSubmit={handleJoin} className="glass-strong" style={{ borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', color: '#f87171', fontSize: '0.83rem' }}>
              {error}
            </motion.div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Hash size={12} />Meeting ID *</span>
            </label>
            <input className="input-field" placeholder="e.g. a1b2c3d4" value={meetingId}
              onChange={e => { setMeetingId(e.target.value.trim()); setError('') }}
              autoFocus style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.08em' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Your Full Name *</label>
            <input className="input-field" placeholder="Jane Smith" value={name} onChange={e => { setName(e.target.value); setError('') }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Email <span style={{ color: '#475569' }}>(optional)</span></label>
            <input className="input-field" type="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <motion.button whileTap={{ scale: 0.97 }} type="submit" className="btn-primary"
            disabled={loading || !meetingId.trim() || !name.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
            {loading ? 'Verifying...' : <><LogIn size={16} />Join Meeting <ArrowRight size={15} /></>}
          </motion.button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#475569', fontSize: '0.82rem' }}>
          Are you a host?{' '}
          <a href="/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '600' }}>Sign in here →</a>
        </p>
      </motion.div>
    </div>
  )
}
