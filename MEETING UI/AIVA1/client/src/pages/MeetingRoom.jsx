import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Circle, StopCircle,
  FileText, Hand, PhoneOff, Users, MessageSquare, Brain, AlertTriangle,
  Copy, CheckCircle, Send, Sparkles, Download, Eye, Activity, Zap,
  UserCheck, UserX, Bell, Lock, Unlock, Shield, X, Camera, Terminal
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useFaceAnalysis } from '../hooks/useFaceAnalysis.js'
import InterviewTimer from '../components/InterviewTimer.jsx'
import HostParticipantRow from '../components/HostParticipantRow.jsx'
import PreJoinScreen from '../components/PreJoinScreen.jsx'
import LiveCodeEditor from '../components/LiveCodeEditor.jsx'

// ─── useAntiCheating ─────────────────────────────────────────────────────────
function useAntiCheating(socketRef, roomId, enabled) {
  const [violations, setViolations] = useState([])
  useEffect(() => {
    if (!enabled) return
    const onVisibility = () => {
      if (document.hidden) {
        setViolations(v => {
          const n = v + 1
          socketRef.current?.emit('anti-cheat-violation', { roomId, violationType: 'Tab Switch', count: n })
          return n
        })
      }
    }
    const onMouseLeave = (e) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setViolations(v => {
          const n = v + 1
          socketRef.current?.emit('anti-cheat-violation', { roomId, violationType: 'Mouse Left Window', count: n })
          return n
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [roomId, enabled])
  return violations
}

// ─── VideoTile ────────────────────────────────────────────────────────────────
function VideoTile({ stream, name, isSpeaking, isMuted, isLocal, noVideo, isScreen }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
  const initials = (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{
      position: 'relative', background: '#0f172a', borderRadius: '14px', overflow: 'hidden',
      flex: 1, minWidth: 0, minHeight: '160px', aspectRatio: '16/9',
      boxShadow: isSpeaking ? '0 0 0 3px #3b82f6, 0 0 20px rgba(59,130,246,0.4)' : 'none',
      transition: 'box-shadow 0.3s'
    }}>
      <video ref={ref} autoPlay playsInline muted={isLocal} 
        style={{ 
          width: '100%', height: '100%', objectFit: 'cover', 
          transform: (isLocal && !isScreen) ? 'scaleX(-1)' : 'none',
          display: (!stream || noVideo) ? 'none' : 'block'
        }} 
      />
      {(!stream || noVideo) && (
        <div style={{ position:'absolute', inset:0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', color: 'white' }}>{initials}</div>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Camera off</span>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.65)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', backdropFilter: 'blur(8px)' }}>
        {isMuted ? <MicOff size={11} color="#f87171" /> : <Mic size={11} color="#4ade80" />}
        {name}{isLocal ? ' (You)' : ''}
      </div>
      {isSpeaking && <div style={{ position: 'absolute', inset: 0, border: '2px solid #3b82f6', borderRadius: '14px', pointerEvents: 'none' }} />}
    </div>
  )
}

// ─── CtrlBtn ─────────────────────────────────────────────────────────────────
function CtrlBtn({ icon: Icon, label, onClick, active, danger }) {
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.93 }} onClick={onClick}
      className={`ctrl-btn ${active ? 'active' : ''} ${danger && !active ? 'danger' : ''}`}>
      <Icon size={18} /><span>{label}</span>
    </motion.button>
  )
}

// ─── LiveTimer ────────────────────────────────────────────────────────────────
function LiveTimer({ startTime }) {
  const [e, setE] = useState(0)
  useEffect(() => { const id = setInterval(() => setE(Math.floor((Date.now() - startTime) / 1000)), 1000); return () => clearInterval(id) }, [startTime])
  const m = Math.floor(e / 60).toString().padStart(2, '0')
  const s = (e % 60).toString().padStart(2, '0')
  return <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{m}:{s}</span>
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', marginBottom: '4px' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ fontWeight: '700', color: '#e2e8f0' }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
        <motion.div animate={{ width: `${value}%` }} transition={{ duration: 0.8 }}
          style={{ height: '100%', background: color, borderRadius: '3px' }} />
      </div>
    </div>
  )
}

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

// ─── MeetingRoom ──────────────────────────────────────────────────────────────
export default function MeetingRoom() {
  const { meetingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Support guest candidates: name/email from URL params (set by WaitingRoomPage)
  const guestName = searchParams.get('name') || null
  const guestEmail = searchParams.get('email') || null
  const effectiveName = user?.name || guestName || 'Guest'
  const effectiveEmail = user?.email || guestEmail || ''
  const wasAdmitted = searchParams.get('admitted') === '1'

  // Pre-join phase (skip if came through waiting room admission)
  const [phase, setPhase] = useState(wasAdmitted ? 'meeting' : 'prejoin')

  // Media
  const [localStream, setLocalStream] = useState(null)
  const [screenStream, setScreenStream] = useState(null)
  const [peers, setPeers] = useState({})       // socketId → { stream, name, email }
  const [speakingMap, setSpeakingMap] = useState({})
  const [handRaisedMap, setHandRaisedMap] = useState({})

  // Controls
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transLang, setTransLang] = useState('en-US')
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [isSpeakingLocally, setIsSpeakingLocally] = useState(false)

  // UI
  const [tab, setTab] = useState('participants')
  const [chat, setChat] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [transcript, setTranscript] = useState([])
  const [participants, setParticipants] = useState([])
  const [remoteViolations, setRemoteViolations] = useState([])
  const [pendingCandidates, setPendingCandidates] = useState([])  // waiting room
  const [showShare, setShowShare] = useState(searchParams.get('new') === '1')
  const [copied, setCopied] = useState(false)
  const [meetingInfo, setMeetingInfo] = useState(null)
  const [mySocketId, setMySocketId] = useState(null)
  const [startTime] = useState(Date.now())

  // Host / role state
  const [isHost, setIsHost] = useState(false)
  const [myRole, setMyRole] = useState('candidate')
  const [participantRoles, setParticipantRoles] = useState({})   // sid -> role
  const [meetingLocked, setMeetingLocked] = useState(false)
  const [interviewMode, setInterviewMode] = useState({ enabled: false, candidateChat: true })
  const [recordingPermissions, setRecordingPermissions] = useState({}) // sid -> bool
  const [canRecord, setCanRecord] = useState(false)
  const [cameraRequestPending, setCameraRequestPending] = useState(null) // 'on'|'off'|null
  const [participantMuted, setParticipantMuted] = useState({}) // sid -> bool
  const [remoteMediaStates, setRemoteMediaStates] = useState({}) // sid -> { isVideoOff, isMuted }

  // Refs
  const socketRef = useRef(null)
  const pcsRef = useRef({})          // socketId → RTCPeerConnection
  const localStreamRef = useRef(null)
  const isSharingRef = useRef(false) // ref for use inside closures/events
  const screenStreamRef = useRef(null)
  const initRef = useRef(false)      // ← GUARD: prevent double-init (StrictMode safe)
  const mediaRecRef = useRef(null)
  const recChunksRef = useRef([])
  const recognitionRef = useRef(null)
  const speakTimerRef = useRef(null)
  const chatEndRef = useRef(null)
  const transcriptEndRef = useRef(null)

  // Anti-cheat (local violation count)
  const localViolations = useAntiCheating(socketRef, meetingId, true)

  // Face analysis
  const { metrics: faceMetrics, generateReport } = useFaceAnalysis(localStream, isSpeakingLocally)

  // AI questions
  const aiQuestions = [
    'Describe a challenging technical problem you recently solved.',
    'How do you approach system design for high-traffic services?',
    'Walk me through your most impactful contribution to a team project.',
    'How do you handle conflicting feedback from stakeholders?',
    'What\'s your debugging process for a production incident?',
  ]

  // ─── Create RTCPeerConnection ──────────────────────────────────────────────
  const createPC = useCallback((targetId, targetName) => {
    if (pcsRef.current[targetId]) return pcsRef.current[targetId]
    const pc = new RTCPeerConnection(ICE)
    pcsRef.current[targetId] = pc

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))

    const remoteStream = new MediaStream()
    pc.ontrack = e => {
      remoteStream.addTrack(e.track)
      setPeers(p => ({ ...p, [targetId]: { ...p[targetId], stream: remoteStream, name: targetName } }))
    }
    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current?.emit('ice-candidate', { targetSocketId: targetId, candidate: e.candidate })
    }
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close(); delete pcsRef.current[targetId]
        setPeers(p => { const n = { ...p }; delete n[targetId]; return n })
      }
    }
    return pc
  }, [])

  // ─── Audio monitoring ──────────────────────────────────────────────────────
  const startAudio = useCallback((stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256
      src.connect(analyser)
      const check = () => {
        const d = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(d)
        const avg = d.reduce((a, b) => a + b, 0) / d.length
        const speaking = avg > 14
        setIsSpeakingLocally(prev => {
          if (prev !== speaking) socketRef.current?.emit('speaking-state', { roomId: meetingId, isSpeaking: speaking })
          return speaking
        })
        speakTimerRef.current = requestAnimationFrame(check)
      }
      speakTimerRef.current = requestAnimationFrame(check)
    } catch {}
  }, [meetingId])

  // ─── Main init ──────────────────────────────────────────────────────────
  // Fetch meeting info during pre-join so preview screen has title
  useEffect(() => {
    fetch(`/api/meetings/${meetingId}`)
      .then(r => r.ok ? r.json() : null)
      .then(m => {
        if (!m) return
        setMeetingInfo(m)
        const hosting = m.hostEmail === effectiveEmail
        setIsHost(hosting)
        setMyRole(hosting ? 'host' : 'candidate')
        if (hosting) setCanRecord(true)
      }).catch(() => {})
  }, [meetingId])

  // WebRTC + socket init — runs when phase flips to 'meeting'
  useEffect(() => {
    if (phase !== 'meeting') return  // wait until pre-join is done
    if (initRef.current) return      // guard against double-run
    initRef.current = true

    const init = async () => {
      // Get media — taken from PreJoinScreen stream passed in via onJoin
      // localStreamRef.current is set by handlePreJoinReady before init() runs
      const stream = localStreamRef.current
      if (stream) { setLocalStream(stream); startAudio(stream) }

      // Socket & WebRTC init runs here — meetingInfo already loaded during pre-join
      if (!meetingInfo) {
        // fallback fetch in case pre-join didn't complete meetingInfo
        try {
          const r = await fetch(`/api/meetings/${meetingId}`)
          if (r.ok) {
            const m = await r.json(); setMeetingInfo(m)
            const hosting = m.hostEmail === effectiveEmail
            setIsHost(hosting); setMyRole(hosting ? 'host' : 'candidate')
            if (hosting) setCanRecord(true)
          }
        } catch {}
      }

      // Socket
      const socket = io('https://aiva-meeting-api.onrender.com', { transports: ['websocket', 'polling'] })
      socketRef.current = socket

      socket.on('connect', () => {
        setMySocketId(socket.id)
        socket.emit('join-room', { roomId: meetingId, name: effectiveName, email: effectiveEmail })
      })

      socket.on('room-state', async ({ participants: existing, socketId: myId }) => {
        setMySocketId(myId)
        // Send initial media status to others
        socket.emit('media-state-update', { roomId: meetingId, isVideoOff, isMuted })
        // Filter out self just in case
        const others = existing.filter(p => p.socketId !== myId)
        setParticipants(others)
        for (const p of others) {
          const pc = createPC(p.socketId, p.name)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('offer', { targetSocketId: p.socketId, offer })
        }
      })

      socket.on('participant-joined', ({ socketId, name, email }) => {
        if (socketId === socket.id) return  // never add self
        setPeers(prev => ({ ...prev, [socketId]: { stream: null, name, email } }))
        setParticipants(prev => [...prev.filter(p => p.socketId !== socketId), { socketId, name, email }])
      })

      socket.on('offer', async ({ fromSocketId, fromName, offer }) => {
        if (fromSocketId === socket.id) return
        const pc = createPC(fromSocketId, fromName)
        setPeers(prev => ({ ...prev, [fromSocketId]: { ...prev[fromSocketId], name: fromName } }))
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('answer', { targetSocketId: fromSocketId, answer })
      })

      socket.on('answer', async ({ fromSocketId, answer }) => {
        const pc = pcsRef.current[fromSocketId]
        if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {})
      })

      socket.on('ice-candidate', async ({ fromSocketId, candidate }) => {
        const pc = pcsRef.current[fromSocketId]
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      })

      socket.on('participant-left', ({ socketId }) => {
        const pc = pcsRef.current[socketId]; if (pc) { pc.close(); delete pcsRef.current[socketId] }
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n })
        setParticipants(prev => prev.filter(p => p.socketId !== socketId))
      })

      socket.on('media-state-update', ({ socketId, isVideoOff, isMuted }) => {
        setRemoteMediaStates(prev => ({ ...prev, [socketId]: { isVideoOff, isMuted } }))
      })

      socket.on('speaking-state', ({ socketId, isSpeaking }) => setSpeakingMap(p => ({ ...p, [socketId]: isSpeaking })))
      socket.on('chat-message', msg => setChat(p => [...p, msg]))
      socket.on('transcript-update', entry => setTranscript(p => [...p, entry]))
      socket.on('raise-hand', ({ socketId, raised }) => setHandRaisedMap(p => ({ ...p, [socketId]: raised })))
      socket.on('anti-cheat-violation', ({ socketId, name, violationType, count }) => {
        setRemoteViolations(prev => {
          const idx = prev.findIndex(v => v.socketId === socketId)
          const entry = { socketId, name, violationType, count }
          if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n }
          return [...prev, entry]
        })
      })

      // ── Waiting room: candidate knocked ──────────────────────────────────────
      socket.on('join-request', ({ socketId, name, email }) => {
        setPendingCandidates(prev => {
          if (prev.find(c => c.socketId === socketId)) return prev
          return [...prev, { socketId, name, email }]
        })
        // Switch to participants tab so host sees the request
        setTab('participants')
      })

      socket.on('candidate-left-waiting', ({ socketId }) => {
        setPendingCandidates(prev => prev.filter(c => c.socketId !== socketId))
      })

      socket.on('candidate-admitted', ({ socketId }) => {
        // Remove from pending — they're now joining as a participant
        setPendingCandidates(prev => prev.filter(c => c.socketId !== socketId))
      })

      // ─ Host control: received by participants ─────────────────────────────────────
      socket.on('force-mute', () => {
        const track = localStreamRef.current?.getAudioTracks()[0]
        if (track) { track.enabled = false; setIsMuted(true) }
      })
      socket.on('camera-request', ({ turn }) => setCameraRequestPending(turn))
      socket.on('force-stop-screenshare', () => {
        if (isSharingRef.current) {
          screenStreamRef.current?.getTracks().forEach(t => t.stop())
          screenStreamRef.current = null; isSharingRef.current = false
          setScreenStream(null); setIsSharing(false)
        }
      })
      socket.on('recording-permission', ({ granted }) => setCanRecord(granted))
      socket.on('participant-muted', ({ socketId }) => setParticipantMuted(prev => ({ ...prev, [socketId]: true })))
      socket.on('role-update', ({ socketId, role }) => {
        setParticipantRoles(prev => ({ ...prev, [socketId]: role }))
        if (socketId === socket.id) setMyRole(role)
      })
      socket.on('interview-mode-update', (settings) => setInterviewMode(settings))
      socket.on('meeting-lock-update', ({ locked }) => setMeetingLocked(locked))
      socket.on('meeting-locked', () => navigate('/dashboard'))
      socket.on('meeting-ended', () => navigate('/dashboard'))
      socket.on('kicked', () => navigate('/dashboard'))
    }

    init()

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(speakTimerRef.current)
      recognitionRef.current?.stop()
      Object.values(pcsRef.current).forEach(pc => pc.close())
      socketRef.current?.disconnect()
    }
  }, [meetingId, phase])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  // ─── Pre-join: bridge from PreJoinScreen to WebRTC init
  const handlePreJoinReady = (stream, { micOn, camOn }) => {
    if (stream) {
      localStreamRef.current = stream
      stream.getAudioTracks().forEach(t => { t.enabled = micOn })
      stream.getVideoTracks().forEach(t => { t.enabled = camOn })
      setIsMuted(!micOn)
      setIsVideoOff(!camOn)
    }
    initRef.current = false  // ← reset BEFORE setPhase so useEffect can fire
    setPhase('meeting')
  }

  // ─── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = async () => {
    let track = localStreamRef.current?.getAudioTracks()[0]
    let off = false
    if (!track) {
      try {
        const temp = await navigator.mediaDevices.getUserMedia({ audio: true })
        track = temp.getAudioTracks()[0]
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(track)
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        } else {
          localStreamRef.current = temp
          setLocalStream(temp)
        }
        Object.values(pcsRef.current).forEach(pc => {
          const s = pc.getSenders().find(s => s.track?.kind === 'audio')
          if (s) s.replaceTrack(track)
          else pc.addTrack(track, localStreamRef.current)
        })
      } catch { return }
    } else {
      track.enabled = !track.enabled
      off = !track.enabled
    }
    setIsMuted(off)
    socketRef.current?.emit('media-state-update', { roomId: meetingId, isVideoOff, isMuted: off })
  }

  const toggleVideo = async () => {
    let track = localStreamRef.current?.getVideoTracks()[0]
    let isOff = false
    if (!track) {
      try {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true })
        track = temp.getVideoTracks()[0]
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(track)
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        } else {
          localStreamRef.current = temp
          setLocalStream(temp)
        }
        Object.values(pcsRef.current).forEach(pc => {
          const s = pc.getSenders().find(s => s.track?.kind === 'video')
          if (s) s.replaceTrack(track)
          else pc.addTrack(track, localStreamRef.current)
        })
      } catch { return }
    } else {
      track.enabled = !track.enabled
      isOff = !track.enabled
    }
    setIsVideoOff(isOff)
    socketRef.current?.emit('media-state-update', { roomId: meetingId, isVideoOff: isOff, isMuted })
  }
  const toggleScreen = async () => {
    if (isSharingRef.current) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null; isSharingRef.current = false
      setScreenStream(null); setIsSharing(false)
      const cam = localStreamRef.current?.getVideoTracks()[0]
      Object.values(pcsRef.current).forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s && cam) s.replaceTrack(cam) })
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = ss; isSharingRef.current = true
        setScreenStream(ss); setIsSharing(true)
        const track = ss.getVideoTracks()[0]
        Object.values(pcsRef.current).forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s) s.replaceTrack(track) })
        // Use ref-based stop to avoid stale closure
        track.onended = () => {
          screenStreamRef.current = null; isSharingRef.current = false
          setScreenStream(null); setIsSharing(false)
          const cam = localStreamRef.current?.getVideoTracks()[0]
          Object.values(pcsRef.current).forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s && cam) s.replaceTrack(cam) })
        }
      } catch {}
    }
  }
  const toggleRecord = () => {
    if (isRecording) {
      mediaRecRef.current?.stop(); setIsRecording(false)
    } else {
      const stream = localStreamRef.current; if (!stream) return
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: 'video/webm' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recording-${meetingId}.webm`; a.click()
        recChunksRef.current = []
      }
      mr.start(1000); mediaRecRef.current = mr; setIsRecording(true)
    }
  }
  const toggleTranscript = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('SpeechRecognition not supported in this browser'); return }
    if (isTranscribing) {
      recognitionRef.current?.stop(); recognitionRef.current = null; setIsTranscribing(false)
    } else {
      const r = new SR(); r.continuous = true; r.interimResults = false
      r.lang = transLang // Use selected language (e.g. 'mr-IN', 'hi-IN')
      
      r.onresult = async e => {
        const text = Array.from(e.results).map(res => res[0].transcript).join(' ').trim()
        if (!text) return
        
        // If not English, translate it first via our backend proxy
        let finalEnglishText = text
        if (transLang !== 'en-US') {
          try {
            const res = await fetch('/api/meetings/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, from: transLang })
            })
            if (res.ok) {
              const data = await res.json()
              finalEnglishText = data.translated
            }
          } catch (err) { console.error('Translation failed', err) }
        }
        
        socketRef.current?.emit('transcript-update', { roomId: meetingId, text: finalEnglishText })
      }
      r.onend = () => { if (isTranscribing) r.start() }
      r.start(); recognitionRef.current = r; setIsTranscribing(true)
    }
  }
  const toggleHand = () => {
    const raised = !isHandRaised; setIsHandRaised(raised)
    socketRef.current?.emit('raise-hand', { roomId: meetingId, raised })
  }
  const sendChat = e => {
    e?.preventDefault()
    if (!chatInput.trim()) return
    socketRef.current?.emit('chat-message', { roomId: meetingId, text: chatInput.trim() })
    setChatInput('')
  }
  const endMeeting = async () => {
    const dur = Math.round((Date.now() - startTime) / 1000)
    generateReport(meetingInfo, { name: effectiveName, email: effectiveEmail }, transcript, [...remoteViolations, ...(localViolations > 0 ? [{ name: effectiveName, violationType: 'Local', count: localViolations }] : [])], startTime, chat)
    socketRef.current?.emit('end-meeting', { roomId: meetingId })
    try { await fetch(`/api/meetings/${meetingId}/end`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durationSeconds: dur }) }) } catch {}
    
    // INTEGRATION: Push transcript to Flask Control Plane for Unified Dashboard Report
    try {
      await fetch('https://aiva-python-api.onrender.com/api/report/live-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_id: meetingId,
          transcript: transcript, // Expected as array of {name, text} by our webhook mapping
          candidate: { name: effectiveName, email: effectiveEmail },
          host: { name: meetingInfo?.hostName || 'Host' }
        })
      });
    } catch (e) { console.error('Failed to push to Flask Control Plane', e); }

    // INTEGRATION: Redirect to Meeting UI Dashboard
    navigate('/dashboard');
  }

  // Host control functions
  const hostMute = sid => socketRef.current?.emit('host-mute-user', { roomId: meetingId, targetSocketId: sid })
  const hostRequestCamera = (sid, turn) => socketRef.current?.emit('host-request-camera', { roomId: meetingId, targetSocketId: sid, turn })
  const hostDisableScreen = sid => socketRef.current?.emit('host-disable-screenshare', { roomId: meetingId, targetSocketId: sid })
  const hostRemove = sid => socketRef.current?.emit('remove-participant', { roomId: meetingId, targetSocketId: sid })
  const hostPromote = sid => socketRef.current?.emit('host-promote-cohost', { roomId: meetingId, targetSocketId: sid })
  const hostGrantRecording = (sid, granted) => {
    socketRef.current?.emit('recording-permission', { roomId: meetingId, targetSocketId: sid, granted })
    setRecordingPermissions(prev => ({ ...prev, [sid]: granted }))
  }
  const toggleLock = () => {
    const l = !meetingLocked; setMeetingLocked(l)
    socketRef.current?.emit('meeting-lock', { roomId: meetingId, locked: l })
  }
  const toggleInterviewMode = () => {
    const next = { ...interviewMode, enabled: !interviewMode.enabled }
    setInterviewMode(next)
    socketRef.current?.emit('interview-mode-update', { roomId: meetingId, settings: next })
  }
  const canShareScreen = isHost || myRole === 'cohost' || !(interviewMode.enabled)
  const canChatNow = isHost || myRole === 'cohost' || !interviewMode.enabled || interviewMode.candidateChat

  // Video grid
  const remotePeers = Object.entries(peers).filter(([sid]) => sid !== mySocketId)
  const allTiles = [
    { key: 'local', stream: isSharing ? screenStream : localStream, name: effectiveName, isLocal: true, isScreen: isSharing, noVideo: isSharing ? false : isVideoOff },
    ...remotePeers.map(([sid, p]) => ({ key: sid, stream: p.stream, name: p.name, isLocal: false, socketId: sid, isScreen: false, noVideo: remoteMediaStates[sid]?.isVideoOff ?? false }))
  ]
  const count = allTiles.length
  const gridStyle = count <= 2
    ? { display: 'flex', gap: '12px', flex: 1 }
    : { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', flex: 1 }

  const inviteUrl = `${window.location.origin}/meeting/${meetingId}`
  const copyUrl = () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }

  const TABS = [
    { id: 'participants', label: 'People', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'code', label: 'Code', icon: Terminal },
    { id: 'transcript', label: 'Script', icon: FileText },
    { id: 'ai', label: 'AI', icon: Brain },
  ]

  const totalViolations = remoteViolations.length + (localViolations > 0 ? 1 : 0)

  // Admit / deny helpers
  const admitCandidate = (socketId) => {
    socketRef.current?.emit('admit-candidate', { roomId: meetingId, targetSocketId: socketId })
    setPendingCandidates(prev => prev.filter(c => c.socketId !== socketId))
  }
  const denyCandidate = (socketId) => {
    socketRef.current?.emit('reject-candidate', { roomId: meetingId, targetSocketId: socketId })
    setPendingCandidates(prev => prev.filter(c => c.socketId !== socketId))
  }

  // \u2500 Pre-join render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (phase === 'prejoin') {
    return (
      <PreJoinScreen
        meetingInfo={meetingInfo}
        userName={effectiveName}
        onJoin={handlePreJoinReady}
        onCancel={() => navigate(-1)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#020617', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '800', fontSize: '1rem', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIVA</span>
          <span style={{ color: '#334155' }}>|</span>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meetingInfo?.title || meetingId}</span>
          {isHost && <span style={{ padding:'2px 7px', borderRadius:'20px', background:'rgba(251,191,36,0.15)', color:'#fbbf24', fontSize:'0.7rem', fontWeight:'700' }}>HOST</span>}
          {interviewMode.enabled && <span style={{ padding:'2px 7px', borderRadius:'20px', background:'rgba(99,102,241,0.2)', color:'#a78bfa', fontSize:'0.7rem', fontWeight:'700', display:'flex', alignItems:'center', gap:'3px' }}><Shield size={9}/>Interview Mode</span>}
          {meetingLocked && <span style={{ padding:'2px 7px', borderRadius:'20px', background:'rgba(220,38,38,0.15)', color:'#f87171', fontSize:'0.7rem', fontWeight:'700', display:'flex', alignItems:'center', gap:'3px' }}><Lock size={9}/>Locked</span>}
          {totalViolations > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.74rem', fontWeight: '600' }}>
              <AlertTriangle size={11} />{totalViolations} alert{totalViolations > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LiveTimer startTime={startTime} />
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowShare(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer' }}>
            <Copy size={12} />Invite
          </motion.button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Video Grid */}
        <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Camera request banner */}
          <AnimatePresence>
            {cameraRequestPending && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
                style={{ padding:'10px 14px', borderRadius:'10px', background:'rgba(99,102,241,0.14)', border:'1px solid rgba(99,102,241,0.3)', marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px' }}>
                <Camera size={14} color="#a78bfa"/>
                <span style={{ flex:1, fontSize:'0.83rem' }}>Host requests: turn camera <strong>{cameraRequestPending}</strong></span>
                <button onClick={() => { toggleVideo(); setCameraRequestPending(null) }} className="btn-primary" style={{ padding:'4px 10px', fontSize:'0.76rem' }}>OK</button>
                <button onClick={() => setCameraRequestPending(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b' }}><X size={13}/></button>
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ ...gridStyle, overflow: 'hidden' }}>
            {allTiles.map(tile => (
              <VideoTile key={tile.key} stream={tile.stream} name={tile.name} isLocal={tile.isLocal}
                isScreen={tile.isScreen} noVideo={tile.noVideo}
                isSpeaking={tile.isLocal ? isSpeakingLocally : speakingMap[tile.socketId]}
                isMuted={tile.isLocal ? isMuted : false} />
            ))}
          </div>

          {/* Face analysis live mini-bar under video */}
          {localStream && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: 'Focus', v: faceMetrics.focus, c: '#3b82f6' },
                { label: 'Confidence', v: faceMetrics.confidence, c: '#8b5cf6' },
                { label: 'Eye Contact', v: faceMetrics.eyeContact, c: '#06b6d4' },
              ].map(({ label, v, c }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '0.73rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                  <span style={{ color: '#94a3b8' }}>{label}:</span>
                  <span style={{ fontWeight: '700', color: '#e2e8f0' }}>{Math.round(v)}%</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.73rem', color: '#a78bfa', fontWeight: '600' }}>
                <Sparkles size={11} />{faceMetrics.dominant}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ width: '370px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.95)' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: '11px 4px', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === id ? '#60a5fa' : '#64748b',
                borderBottom: tab === id ? '2px solid #3b82f6' : '2px solid transparent',
                fontSize: '0.72rem', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', transition: 'all 0.2s'
              }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            <AnimatePresence mode="wait">

              {/* PARTICIPANTS */}
              {tab === 'participants' && (
                <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                  {/* ── Waiting Room Panel (host only) ─────────────────────── */}
                  {pendingCandidates.length > 0 && (
                    <div style={{ marginBottom: '14px', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={14} color="#fbbf24" />
                        <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#fbbf24' }}>Waiting Room</span>
                        <span style={{ marginLeft: 'auto', background: '#fbbf24', color: '#000', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '800', padding: '1px 7px' }}>{pendingCandidates.length}</span>
                      </div>
                      <div style={{ padding: '8px' }}>
                        {pendingCandidates.map(c => (
                          <div key={c.socketId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '9px', background: 'rgba(255,255,255,0.03)', marginBottom: '5px' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem', color: 'white', flexShrink: 0 }}>{c.name?.[0]?.toUpperCase()}</div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                              {c.email && <div style={{ color: '#64748b', fontSize: '0.71rem' }}>{c.email}</div>}
                            </div>
                            <motion.button whileTap={{ scale: 0.93 }} onClick={() => admitCandidate(c.socketId)}
                              style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px', borderRadius:'7px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#4ade80', fontSize:'0.73rem', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>
                              <UserCheck size={12}/>Admit
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.93 }} onClick={() => denyCandidate(c.socketId)}
                              style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px', borderRadius:'7px', background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.25)', color:'#f87171', fontSize:'0.73rem', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>
                              <UserX size={12}/>Deny
                            </motion.button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Remote violations */}
                  {remoteViolations.map(v => (
                    <div key={v.socketId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', marginBottom: '8px', fontSize: '0.77rem', color: '#fbbf24' }}>
                      <AlertTriangle size={12} /><span><strong>{v.name}</strong>: {v.violationType} ×{v.count}</span>
                    </div>
                  ))}
                  {/* Local violation notice */}
                  {localViolations > 0 && (
                    <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '8px', fontSize: '0.77rem', color: '#f87171' }}>
                      <AlertTriangle size={12} style={{ display: 'inline', marginRight: '5px' }} />
                      You have {localViolations} local anti-cheat violation{localViolations > 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Self row */}
                  <HostParticipantRow
                    socketId={mySocketId} name={effectiveName} email={effectiveEmail}
                    role={myRole} isLocal isSpeaking={isSpeakingLocally} isMuted={isMuted}
                    handRaised={isHandRaised} isHost={false} />

                  {/* Remote participants */}
                  {participants.map(p => {
                    const role = participantRoles[p.socketId] || 'candidate'
                    return (
                      <HostParticipantRow key={p.socketId}
                        socketId={p.socketId} name={p.name} email={p.email}
                        role={role}
                        isSpeaking={!!speakingMap[p.socketId]}
                        isMuted={!!participantMuted[p.socketId]}
                        handRaised={!!handRaisedMap[p.socketId]}
                        hasViolation={remoteViolations.some(v => v.socketId === p.socketId)}
                        recordingPermission={!!recordingPermissions[p.socketId]}
                        isHost={isHost}
                        onMute={hostMute}
                        onRequestCamera={hostRequestCamera}
                        onDisableScreen={hostDisableScreen}
                        onRemove={hostRemove}
                        onPromote={hostPromote}
                        onGrantRecording={hostGrantRecording} />
                    )
                  })}
                </motion.div>
              )}

              {/* CHAT */}
              {tab === 'chat' && (
                <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}>
                    {chat.length === 0 && <div style={{ textAlign: 'center', color: '#475569', padding: '32px 0', fontSize: '0.85rem' }}>No messages yet</div>}
                    {chat.map(msg => {
                      const isMe = msg.senderEmail === user?.email
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '3px' }}>{msg.senderName}</span>
                          <div className={isMe ? 'chat-bubble-self' : 'chat-bubble-other'} style={{ padding: '8px 12px', maxWidth: '88%', fontSize: '0.84rem', lineHeight: 1.4 }}>{msg.text}</div>
                        </div>
                      )
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={sendChat} style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <input className="input-field" placeholder={canChatNow ? 'Message...' : 'Chat disabled by host'} value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ flex: 1 }} disabled={!canChatNow} />
                    <button type="submit" className="btn-primary" style={{ padding: '8px 12px', flexShrink: 0 }} disabled={!canChatNow}><Send size={14} /></button>
                  </form>
                </motion.div>
              )}

              {/* CODE EDITOR */}
              {tab === 'code' && (
                <motion.div key="cd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%' }}>
                  <LiveCodeEditor socket={socketRef.current} roomId={meetingId} />
                </motion.div>
              )}

              {/* TRANSCRIPT */}
              {tab === 'transcript' && (
                <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>Live Transcript</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        value={transLang} 
                        onChange={e => setTransLang(e.target.value)} 
                        disabled={isTranscribing}
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 6px', fontSize: '0.7rem', outline: 'none' }}
                      >
                        <option value="en-US">English</option>
                        <option value="mr-IN">Marathi</option>
                        <option value="hi-IN">Hindi</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                      </select>
                      <button onClick={toggleTranscript} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: '600', background: isTranscribing ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: isTranscribing ? '#22c55e' : '#60a5fa' }}>
                        {isTranscribing ? '🔴 Active — Stop' : '▶ Start'}
                      </button>
                    </div>
                  </div>
                  {transcript.length === 0
                    ? <div style={{ textAlign: 'center', color: '#475569', padding: '32px 0', fontSize: '0.84rem' }}>Click Start to begin live transcription</div>
                    : transcript.map(e => (
                      <div key={e.id} style={{ padding: '9px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #3b82f6', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.75rem', color: '#60a5fa', marginBottom: '3px' }}>{e.speakerName}</div>
                        <div style={{ fontSize: '0.83rem', color: '#e2e8f0', lineHeight: 1.5 }}>{e.text}</div>
                      </div>
                    ))
                  }
                  <div ref={transcriptEndRef} />
                </motion.div>
              )}

              {/* AI PANEL */}
              {tab === 'ai' && (
                <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Interview Timer (first item in AI panel) */}
                  <InterviewTimer isHost={isHost} socketRef={socketRef} meetingId={meetingId} />

                  {/* Face analysis */}
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Eye size={14} color="#a78bfa" /><span style={{ fontWeight: '700', fontSize: '0.84rem', color: '#a78bfa' }}>Facial Expression Analysis</span>
                    </div>
                    <ScoreBar label="Focus" value={faceMetrics.focus} color="linear-gradient(90deg,#3b82f6,#6366f1)" />
                    <ScoreBar label="Confidence" value={faceMetrics.confidence} color="linear-gradient(90deg,#8b5cf6,#a78bfa)" />
                    <ScoreBar label="Eye Contact" value={faceMetrics.eyeContact} color="linear-gradient(90deg,#06b6d4,#3b82f6)" />
                    <ScoreBar label="Stress" value={faceMetrics.stress} color="linear-gradient(90deg,#f97316,#ef4444)" />
                    <div style={{ marginTop: '12px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                      <Sparkles size={12} color="#a78bfa" />
                      <span style={{ color: '#94a3b8' }}>Dominant Expression:</span>
                      <span style={{ fontWeight: '700', color: '#ddd6fe', textTransform: 'capitalize' }}>{faceMetrics.dominant}</span>
                    </div>
                  </div>

                  {/* Emotion breakdown */}
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.18)', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Activity size={14} color="#06b6d4" /><span style={{ fontWeight: '700', fontSize: '0.84rem', color: '#06b6d4' }}>Emotion Breakdown</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {Object.entries(faceMetrics.breakdown || {}).map(([k, v]) => (
                        <div key={k} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#e2e8f0' }}>{v}%</div>
                          <div style={{ fontSize: '0.73rem', color: '#94a3b8', textTransform: 'capitalize', marginTop: '2px' }}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Questions */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Zap size={14} color="#fbbf24" /><span style={{ fontWeight: '700', fontSize: '0.84rem', color: '#fbbf24' }}>Suggested Questions</span>
                    </div>
                    {aiQuestions.map((q, i) => (
                      <motion.div key={i} whileHover={{ x: 3 }} style={{ padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontSize: '0.81rem', lineHeight: 1.5, marginBottom: '7px', color: '#cbd5e1', display: 'flex', gap: '7px' }}>
                        <span style={{ color: '#60a5fa', fontWeight: '700', flexShrink: 0 }}>Q{i + 1}.</span>{q}
                      </motion.div>
                    ))}
                  </div>

                  {/* Download report button */}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => generateReport(meetingInfo, user, transcript, remoteViolations, startTime, chat)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.2))', border: '1px solid rgba(99,102,241,0.3)', color: '#a78bfa', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Download size={15} />Download Report Now
                  </motion.button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{ display: 'flex', gap: '8px', padding: '10px 16px', borderRadius: '20px', background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <CtrlBtn icon={isMuted ? MicOff : Mic} label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} active={!isMuted} danger={isMuted} />
          <CtrlBtn icon={isVideoOff ? VideoOff : Video} label={isVideoOff ? 'Start Cam' : 'Camera'} onClick={toggleVideo} active={!isVideoOff} danger={isVideoOff} />
          <CtrlBtn icon={isSharing ? MonitorOff : Monitor} label={isSharing ? 'Stop' : 'Share'} onClick={canShareScreen ? toggleScreen : undefined} active={isSharing} danger={!canShareScreen} />
          <CtrlBtn icon={isRecording ? StopCircle : Circle} label={isRecording ? 'Stop Rec' : 'Record'} onClick={(isHost || canRecord) ? toggleRecord : undefined} active={isRecording} danger={!isHost && !canRecord} />
          <CtrlBtn icon={FileText} label={isTranscribing ? 'Stop' : 'Transcript'} onClick={toggleTranscript} active={isTranscribing} />
          <CtrlBtn icon={Hand} label={isHandRaised ? 'Lower' : 'Raise'} onClick={toggleHand} active={isHandRaised} />
          {isHost && (
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />
              <CtrlBtn icon={interviewMode.enabled ? Shield : Shield} label={interviewMode.enabled ? 'Interview ✓' : 'Interview'} onClick={toggleInterviewMode} active={interviewMode.enabled} />
              <CtrlBtn icon={meetingLocked ? Unlock : Lock} label={meetingLocked ? 'Unlock' : 'Lock'} onClick={toggleLock} active={meetingLocked} danger={meetingLocked} />
            </>
          )}
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />
          <CtrlBtn icon={PhoneOff} label="End" onClick={endMeeting} danger />
        </motion.div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="glass-strong" style={{ width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto 18px', borderRadius: '16px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={26} color="#60a5fa" />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>Share Invite Link</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>Send this to your candidate</p>
              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0', textAlign: 'left' }}>{inviteUrl}</span>
                <button onClick={copyUrl} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: '600', flexShrink: 0 }}>
                  {copied ? <><CheckCircle size={14} />Copied!</> : <><Copy size={14} />Copy</>}
                </button>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: '8px', padding: '8px 12px', marginBottom: '18px', fontSize: '0.81rem', color: '#93c5fd' }}>
                Meeting ID: <strong>{meetingId}</strong>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowShare(false)}>Got it!</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Participant Row ───────────────────────────────────────────────────────────
function ParticipantRow({ name, email, isLocal, isHost, handRaised, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px', borderRadius: '10px', marginBottom: '3px', transition: 'background 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.78rem', color: 'white', flexShrink: 0 }}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: '600', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {name}{isLocal && <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>(You)</span>}
          {isHost && <span style={{ fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '1px 5px', borderRadius: '4px' }}>Host</span>}
          {handRaised && <Hand size={12} color="#fbbf24" />}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.73rem' }}>{email}</div>
      </div>
      {onRemove && (
        <button onClick={onRemove} style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(220,38,38,0.15)', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.7rem', fontWeight: '600' }}>Remove</button>
      )}
    </div>
  )
}
