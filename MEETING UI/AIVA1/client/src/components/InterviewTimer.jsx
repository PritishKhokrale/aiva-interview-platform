import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Timer, Zap } from 'lucide-react'

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function InterviewTimer({ isHost, socketRef, meetingId }) {
  const [timer, setTimer] = useState({ elapsed: 0, questionElapsed: 0, running: false })
  const intervalRef = useRef(null)

  // Host drives the timer; candidates receive updates
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const handler = (t) => setTimer(t)
    socket.on('timer-update', handler)
    return () => socket.off('timer-update', handler)
  }, [socketRef.current])

  useEffect(() => {
    if (timer.running && isHost) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => {
          const next = { ...prev, elapsed: prev.elapsed + 1, questionElapsed: prev.questionElapsed + 1 }
          socketRef.current?.emit('timer-update', { roomId: meetingId, timerState: next })
          return next
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timer.running, isHost])

  const broadcast = (newTimer) => {
    setTimer(newTimer)
    socketRef.current?.emit('timer-update', { roomId: meetingId, timerState: newTimer })
  }

  const pct = Math.min(100, (timer.questionElapsed / 300) * 100) // 5 min per question

  return (
    <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Timer size={14} color="#06b6d4" />
        <span style={{ fontWeight: '700', fontSize: '0.84rem', color: '#06b6d4' }}>Interview Timer</span>
        {timer.running && (
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
            style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', marginLeft: 'auto' }} />
        )}
      </div>

      {/* Total timer */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '2.2rem', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: '#e2e8f0', letterSpacing: '-0.02em' }}>
          {fmt(timer.elapsed)}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Total Session Time</div>
      </div>

      {/* Per-question timer */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '5px' }}>
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={11} />Current Question</span>
          <span style={{ fontWeight: '700', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(timer.questionElapsed)}</span>
        </div>
        <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
          <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
            style={{ height: '100%', borderRadius: '3px', background: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#06b6d4' }} />
        </div>
      </div>

      {/* Controls — host only */}
      {isHost && (
        <div style={{ display: 'flex', gap: '6px' }}>
          {timer.running
            ? <motion.button whileTap={{ scale: 0.94 }} onClick={() => broadcast({ ...timer, running: false })}
                style={{ flex: 1, padding: '7px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: '600' }}>
                <Pause size={13} />Pause
              </motion.button>
            : <motion.button whileTap={{ scale: 0.94 }} onClick={() => broadcast({ ...timer, running: true })}
                style={{ flex: 1, padding: '7px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: '600' }}>
                <Play size={13} />Start
              </motion.button>
          }
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => broadcast({ ...timer, questionElapsed: 0 })}
            style={{ flex: 1, padding: '7px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: '600' }}>
            <Zap size={13} />Next Q
          </motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => broadcast({ elapsed: 0, questionElapsed: 0, running: false })}
            style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={13} />
          </motion.button>
        </div>
      )}
    </div>
  )
}
