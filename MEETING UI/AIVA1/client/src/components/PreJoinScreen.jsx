import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Video, VideoOff, Settings, ArrowRight, AlertCircle, CheckCircle, Volume2 } from 'lucide-react'

/**
 * Zoom-like pre-join screen: camera preview + mic level + device controls.
 * Calls onJoin(stream) when user is ready.
 */
export default function PreJoinScreen({ meetingInfo, userName, onJoin, onCancel }) {
  const videoRef = useRef(null)
  const analyserRef = useRef(null)
  const animRef = useRef(null)

  const [stream, setStream] = useState(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [micLevel, setMicLevel] = useState(0)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState({ cameras: [], mics: [] })
  const [selCam, setSelCam] = useState('')
  const [selMic, setSelMic] = useState('')
  const [showDevices, setShowDevices] = useState(false)

  // Acquire media
  useEffect(() => {
    let s = null
    const start = async () => {
      try {
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
        const mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput')
        setDevices({ cameras: cams, mics })
        if (cams.length) setSelCam(cams[0].deviceId)
        if (mics.length) setSelMic(mics[0].deviceId)

        s = await navigator.mediaDevices.getUserMedia({
          video: cams.length ? { deviceId: selCam || undefined } : false,
          audio: mics.length ? { deviceId: selMic || undefined } : true,
        })
        setStream(s)
        startMicMonitor(s)
        if (videoRef.current) videoRef.current.srcObject = s
      } catch (err) {
        setError(err.name === 'NotAllowedError'
          ? 'Camera/microphone access was denied. Please allow access in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera or microphone found. You can still join without them.'
          : `Media error: ${err.message}`)
      }
    }
    start()
    return () => {
      // ONLY stop the stream on unmount if we didn't explicitly pass it to MeetingRoom
      // stream gets cleared on handleJoin
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  const startMicMonitor = (s) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(s)
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256
      src.connect(analyser); analyserRef.current = analyser
      const tick = () => {
        const d = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(d)
        setMicLevel(Math.min(100, (d.reduce((a, b) => a + b, 0) / d.length) * 4))
        animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    } catch {}
  }

  const toggleCam = () => {
    const track = stream?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setCamOn(!camOn) }
  }

  const toggleMic = () => {
    const track = stream?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMicOn(!micOn) }
  }

  const handleJoin = () => {
    cancelAnimationFrame(animRef.current)
    onJoin(stream, { micOn, camOn })
  }

  const handleJoinWithout = () => {
    stream?.getTracks().forEach(t => t.stop())
    onJoin(null, { micOn: false, camOn: false })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* BG glow */}
      <div style={{ position: 'absolute', width: '400px', height: '400px', background: '#3b82f6', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.07, top: '20%', left: '30%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontWeight: '800', fontSize: '1.3rem', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px' }}>AIVA</div>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Joining{meetingInfo?.title ? <strong style={{ color: '#e2e8f0' }}> "{meetingInfo.title}"</strong> : ''}
          </p>
        </div>

        <div className="glass-strong" style={{ borderRadius: '20px', padding: '24px' }}>
          {/* Camera preview */}
          <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9', marginBottom: '16px' }}>
            {camOn && stream?.getVideoTracks()[0]?.enabled
              ? <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                    {userName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{camOn ? 'Starting camera...' : 'Camera off'}</span>
                </div>
            }
            {/* Name tag */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}>
              {userName || 'You'}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />{error}
            </div>
          )}

          {/* Mic level */}
          {stream && micOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Volume2 size={13} color="#22c55e" />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>Microphone</span>
              <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${micLevel}%` }} transition={{ duration: 0.05 }}
                  style={{ height: '100%', background: micLevel > 70 ? '#22c55e' : micLevel > 40 ? '#86efac' : '#3b82f6', borderRadius: '3px' }} />
              </div>
              <span style={{ fontSize: '0.7rem', color: micLevel > 10 ? '#22c55e' : '#64748b', flexShrink: 0 }}>
                {micLevel > 10 ? '✓ Detected' : 'Listening...'}
              </span>
            </div>
          )}

          {/* Camera / Mic toggles */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleCam}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontWeight: '600', fontSize: '0.83rem', background: camOn ? 'rgba(59,130,246,0.15)' : 'rgba(220,38,38,0.12)', color: camOn ? '#60a5fa' : '#f87171', borderWidth: '1px', borderStyle: 'solid', borderColor: camOn ? 'rgba(59,130,246,0.3)' : 'rgba(220,38,38,0.25)' }}>
              {camOn ? <Video size={15} /> : <VideoOff size={15} />}
              {camOn ? 'Camera On' : 'Camera Off'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleMic}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontWeight: '600', fontSize: '0.83rem', background: micOn ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.12)', color: micOn ? '#22c55e' : '#f87171', borderWidth: '1px', borderStyle: 'solid', borderColor: micOn ? 'rgba(34,197,94,0.25)' : 'rgba(220,38,38,0.25)' }}>
              {micOn ? <Mic size={15} /> : <MicOff size={15} />}
              {micOn ? 'Mic On' : 'Mic Off'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowDevices(v => !v)}
              style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              <Settings size={15} />
            </motion.button>
          </div>

          {/* Device selector */}
          <AnimatePresence>
            {showDevices && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {devices.cameras.length > 0 && (
                    <div>
                      <label style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Camera</label>
                      <select value={selCam} onChange={e => setSelCam(e.target.value)} className="input-field" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                        {devices.cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                      </select>
                    </div>
                  )}
                  {devices.mics.length > 0 && (
                    <div>
                      <label style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Microphone</label>
                      <select value={selMic} onChange={e => setSelMic(e.target.value)} className="input-field" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                        {devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status summary */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { ok: camOn && !!stream?.getVideoTracks().length, label: 'Camera', icon: camOn ? Video : VideoOff },
              { ok: micOn && !!stream?.getAudioTracks().length, label: 'Microphone', icon: micOn ? Mic : MicOff },
            ].map(({ ok, label, icon: Icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '6px', background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(100,116,139,0.1)', fontSize: '0.73rem', color: ok ? '#4ade80' : '#64748b' }}>
                <Icon size={11} />{label}: {ok ? 'Ready' : 'Off'}
              </div>
            ))}
          </div>

          {/* Join buttons */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleJoin} className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', padding: '12px' }}>
            <CheckCircle size={16} />Join Meeting <ArrowRight size={15} />
          </motion.button>
          {error && (
            <button onClick={handleJoinWithout} style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>
              Join without camera/mic
            </button>
          )}
        </div>

        {onCancel && (
          <button onClick={onCancel} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: '#475569', fontSize: '0.82rem', cursor: 'pointer' }}>
            ← Cancel
          </button>
        )}
      </motion.div>
    </div>
  )
}
