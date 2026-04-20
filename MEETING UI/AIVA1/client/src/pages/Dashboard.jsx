import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, Settings, Plus, LogOut, LogIn, Calendar, Clock, Users, Copy, CheckCircle,
  X, ChevronRight, Mic, Sparkles, Trash2, Trash, AlertCircle, Globe, Sun, Moon, ArrowLeft
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ onLogout }) {
  const { user } = useAuth()
  return (
    <aside style={{ width: '230px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 14px', background: 'rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Video size={16} color="white" />
        </div>
        <span style={{ fontWeight: '800', fontSize: '1.1rem', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIVA</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}><Video size={17} />Dashboard</NavLink>
        <NavLink to="/join" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}><LogIn size={17} />Join Meeting</NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}><Settings size={17} />Settings</NavLink>
      </nav>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
          {user?.picture
            ? <img src={user.picture} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.85rem' }}>{user?.name?.[0]}</div>
          }
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ color: '#64748b', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.82rem' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <LogOut size={14} />Sign Out
        </button>
      </div>
    </aside>
  )
}

// ─── Create / Schedule Meeting Modal ─────────────────────────────────────────
function CreateMeetingModal({ onClose, onCreate }) {
  const { user } = useAuth()
  const [step, setStep] = useState('form')   // 'form' | 'schedule'
  const [title, setTitle] = useState('')
  const [invitees, setInvitees] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [scheduleNote, setScheduleNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Minimum datetime = now (local)
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)

  const submit = async (isScheduled) => {
    if (!title.trim()) { setError('Please enter a meeting title'); return }
    if (isScheduled && !scheduledFor) { setError('Please select a date & time'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          hostEmail: user.email,
          hostName: user.name,
          isScheduled,
          scheduledFor: isScheduled ? scheduledFor : null,
          invitees: invitees.split(',').map(e => e.trim()).filter(Boolean),
        })
      })
      const meeting = await res.json()
      if (!res.ok) throw new Error(meeting.error || 'Failed')
      onCreate(meeting, !isScheduled)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="glass-strong"
        style={{ width: '100%', maxWidth: '480px', borderRadius: '20px', padding: '28px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={19} /></button>

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '4px' }}>New Meeting</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginBottom: '22px' }}>Set up your interview session</p>

              {error && <div style={{ padding: '8px 12px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '8px', color: '#f87171', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}><AlertCircle size={14} />{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '5px', fontWeight: '500' }}>Meeting Title *</label>
                  <input className="input-field" placeholder="Frontend Engineer — Round 2" value={title}
                    onChange={e => { setTitle(e.target.value); setError('') }} autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '5px', fontWeight: '500' }}>Invite Emails <span style={{ color: '#475569' }}>(comma-separated, optional)</span></label>
                  <input className="input-field" placeholder="candidate@company.com, hr@company.com" value={invitees} onChange={e => setInvitees(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <motion.button whileTap={{ scale: 0.97 }} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => submit(false)} disabled={loading || !title.trim()}>
                    {loading ? '...' : <><Video size={15} />Start Now</>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => { if (!title.trim()) { setError('Please enter a title first'); return } setError(''); setStep('schedule') }} disabled={loading}>
                    <Calendar size={15} />Schedule
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="schedule" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '0.82rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ← Back
              </button>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '4px' }}>Schedule Meeting</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginBottom: '22px' }}>
                Scheduling: <strong style={{ color: '#e2e8f0' }}>{title}</strong>
              </p>

              {error && <div style={{ padding: '8px 12px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '8px', color: '#f87171', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}><AlertCircle size={14} />{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '5px', fontWeight: '500' }}>Date & Time *</label>
                  <input className="input-field" type="datetime-local" value={scheduledFor} min={minDateTime}
                    onChange={e => { setScheduledFor(e.target.value); setError('') }}
                    style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '5px', fontWeight: '500' }}>Notes <span style={{ color: '#475569' }}>(optional)</span></label>
                  <input className="input-field" placeholder="e.g. Prepare system design questions" value={scheduleNote} onChange={e => setScheduleNote(e.target.value)} />
                </div>

                {scheduledFor && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.82rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={14} />
                    Scheduled for: <strong>{new Date(scheduledFor).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                  </div>
                )}

                <motion.button whileTap={{ scale: 0.97 }} className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => submit(true)} disabled={loading || !scheduledFor}>
                  {loading ? '...' : <><Calendar size={15} />Confirm Schedule</>}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── Share Invite Modal ────────────────────────────────────────────────────────
function ShareInviteModal({ meetingId, onClose, onJoin }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/meeting/${meetingId}`
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500) }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="glass-strong" style={{ width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '30px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '14px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={24} color="#60a5fa" />
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>Meeting Created! 🎉</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>Share this link with your candidate</p>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Globe size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.8rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{url}</span>
          <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: '600', flexShrink: 0 }}>
            {copied ? <><CheckCircle size={13} />Copied!</> : <><Copy size={13} />Copy</>}
          </button>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: '8px', padding: '8px 12px', marginBottom: '18px', fontSize: '0.8rem', color: '#93c5fd' }}>
          Meeting ID: <strong>{meetingId}</strong>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Close</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onJoin}>Join Now →</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger = true }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '20px' }}
      onClick={onCancel}>
      <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()} className="glass-strong"
        style={{ width: '100%', maxWidth: '380px', borderRadius: '18px', padding: '28px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '12px', background: danger ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {danger ? <Trash size={22} color="#f87171" /> : <AlertCircle size={22} color="#60a5fa" />}
        </div>
        <h3 style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '8px' }}>{title}</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: '22px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', background: danger ? '#dc2626' : '#3b82f6', color: 'white' }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} className="glass" style={{ borderRadius: '14px', padding: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>{value}</div>
        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{label}</div>
      </div>
    </motion.div>
  )
}

// ─── Meeting Row ──────────────────────────────────────────────────────────────
function MeetingRow({ meeting, onJoin, onDelete }) {
  const isEnded = meeting.status === 'ended'
  const isScheduled = meeting.status === 'scheduled'
  const dur = meeting.durationSeconds
  const durStr = dur > 0 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : '—'
  const scheduledDate = meeting.scheduledFor ? new Date(meeting.scheduledFor) : null
  const createdDate = new Date(meeting.createdAt)

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

      <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: isEnded ? 'rgba(100,116,139,0.2)' : isScheduled ? 'rgba(251,191,36,0.15)' : 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isScheduled ? <Calendar size={15} color="#fbbf24" /> : <Video size={15} color={isEnded ? '#64748b' : '#60a5fa'} />}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meeting.title}</div>
        <div style={{ color: '#64748b', fontSize: '0.75rem', display: 'flex', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
          {isScheduled && scheduledDate
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fbbf24' }}><Calendar size={10} />Scheduled: {scheduledDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{createdDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
          }
          {isEnded && dur > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} />{durStr}</span>}
          {meeting.invitees?.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={10} />{meeting.invitees.length} invited</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: '600', padding: '3px 8px', borderRadius: '20px',
          background: isEnded ? 'rgba(100,116,139,0.2)' : isScheduled ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
          color: isEnded ? '#64748b' : isScheduled ? '#fbbf24' : '#22c55e'
        }}>{meeting.status}</span>

        {!isEnded && (
          <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" style={{ padding: '5px 12px', fontSize: '0.78rem' }} onClick={() => onJoin(meeting.id)}>
            Join <ChevronRight size={12} style={{ display: 'inline' }} />
          </motion.button>
        )}

        {/* Delete button */}
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => onDelete(meeting)}
          style={{ padding: '5px', borderRadius: '7px', background: 'none', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', color: '#64748b', display: 'flex', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b' }}>
          <Trash2 size={14} />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [shareInfo, setShareInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)   // meeting obj to delete
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains('light-theme'))

  useEffect(() => {
    if (localStorage.getItem('theme') === 'light') {
      document.documentElement.classList.add('light-theme')
      setIsLight(true)
    }
  }, [])

  const toggleTheme = () => {
    setIsLight(prev => {
      const next = !prev
      if (next) document.documentElement.classList.add('light-theme')
      else document.documentElement.classList.remove('light-theme')
      localStorage.setItem('theme', next ? 'light' : 'dark')
      return next
    })
  }

  useEffect(() => { if (user?.email) fetchMeetings() }, [user])

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`/api/meetings?email=${encodeURIComponent(user.email)}`)
      const data = await res.json()
      if (Array.isArray(data)) setMeetings(data)
    } catch { }
  }

  const handleCreate = (meeting, startNow) => {
    setShowCreate(false)
    setMeetings(prev => [meeting, ...prev])
    if (startNow) setShareInfo({ meetingId: meeting.id })
  }

  // Delete single
  const handleDelete = async (meeting) => {
    try {
      await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
    } catch { }
    setDeleteTarget(null)
  }

  // Clear all ended (history)
  const handleClearHistory = async () => {
    try {
      await fetch(`/api/meetings?email=${encodeURIComponent(user.email)}&status=ended`, { method: 'DELETE' })
      setMeetings(prev => prev.filter(m => m.status !== 'ended'))
    } catch { }
    setShowClearConfirm(false)
  }

  const handleLogout = () => {
    logout();
    window.location.href = 'https://aiva-python-api.onrender.com/api/auth/logout';
  }

  const upcoming = meetings.filter(m => m.status !== 'ended')
  const history = meetings.filter(m => m.status === 'ended')
  const filtered = activeTab === 'all' ? meetings : activeTab === 'upcoming' ? upcoming : history

  const totalTalk = meetings.reduce((a, m) => a + (m.durationSeconds || 0), 0)
  const stats = [
    { label: 'Total Meetings', value: meetings.length, icon: Video, color: '#3b82f6' },
    { label: 'Scheduled', value: upcoming.filter(m => m.status === 'scheduled').length, icon: Calendar, color: '#a78bfa' },
    { label: 'Completed', value: history.length, icon: Clock, color: '#22c55e' },
    { label: 'Talk Time', value: totalTalk >= 60 ? `${Math.round(totalTalk / 60)}m` : `${totalTalk}s`, icon: Mic, color: '#f59e0b' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#020617' }}>
      <Sidebar onLogout={handleLogout} />

      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: '1.65rem', fontWeight: '800', marginBottom: '3px' }}>
              {getGreeting()}, {user?.name?.split(' ')[0]} 👋
            </motion.h1>
            <p style={{ color: '#64748b', fontSize: '0.87rem' }}>Your interview platform dashboard</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = 'https://aiva-python-api.onrender.com/hr_dashboard'} 
              className="btn-secondary" title="Back to HR Dashboard"
              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <ArrowLeft size={16} /> HR Dashboard
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={toggleTheme} className="btn-secondary" title="Toggle Theme"
              style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreate(true)} className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.88rem' }}>
              <Plus size={16} />New Meeting
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: '14px', marginBottom: '28px' }}>
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Meeting list card */}
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          {/* Tab bar + actions */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', flex: 1 }}>
              {[
                { id: 'all', label: `All (${meetings.length})` },
                { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
                { id: 'history', label: `History (${history.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === t.id ? '#60a5fa' : '#64748b',
                  fontWeight: activeTab === t.id ? '600' : '500', fontSize: '0.85rem',
                  borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.2s'
                }}>{t.label}</button>
              ))}
            </div>

            {/* Clear history button — only in history tab with some items */}
            {activeTab === 'history' && history.length > 0 && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowClearConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#f87171', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', marginRight: '10px', flexShrink: 0 }}>
                <Trash size={13} />Clear History
              </motion.button>
            )}
          </div>

          {/* List */}
          <div style={{ padding: '8px' }}>
            <AnimatePresence>
              {filtered.length === 0
                ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '48px', textAlign: 'center', color: '#475569' }}>
                    {activeTab === 'history'
                      ? <><Trash size={36} style={{ margin: '0 auto 12px', opacity: 0.25, display: 'block' }} /><p>No completed meetings yet</p></>
                      : <><Video size={36} style={{ margin: '0 auto 12px', opacity: 0.25, display: 'block' }} /><p>No meetings found. Click <strong>New Meeting</strong> to start.</p></>
                    }
                  </motion.div>
                )
                : filtered.map(m => (
                  <MeetingRow key={m.id} meeting={m}
                    onJoin={id => navigate(`/meeting/${id}`)}
                    onDelete={meeting => setDeleteTarget(meeting)} />
                ))
              }
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateMeetingModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}

        {shareInfo && (
          <ShareInviteModal meetingId={shareInfo.meetingId}
            onClose={() => setShareInfo(null)}
            onJoin={() => { setShareInfo(null); navigate(`/meeting/${shareInfo.meetingId}?new=1`) }} />
        )}

        {deleteTarget && (
          <ConfirmModal
            title="Delete Meeting?"
            message={`"${deleteTarget.title}" will be permanently removed from your dashboard.`}
            confirmLabel="Delete"
            onConfirm={() => handleDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)} />
        )}

        {showClearConfirm && (
          <ConfirmModal
            title="Clear All History?"
            message={`This will permanently delete all ${history.length} completed meeting${history.length > 1 ? 's' : ''} from your history.`}
            confirmLabel="Clear History"
            onConfirm={handleClearHistory}
            onCancel={() => setShowClearConfirm(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
