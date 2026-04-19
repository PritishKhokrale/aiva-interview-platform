import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Camera, CameraOff, Monitor, Trash2, Crown, Circle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Rich participant row shown inside the Participants panel.
 * Shows host-only controls when `isHost` prop is true.
 */
export default function HostParticipantRow({
  socketId, name, email, role, isLocal,
  isSpeaking, isMuted, handRaised, hasViolation, isSharing,
  recordingPermission,
  isHost,   // viewer is host — show controls
  onMute, onRequestCamera, onDisableScreen, onRemove, onPromote, onGrantRecording
}) {
  const [expanded, setExpanded] = useState(false)

  const roleTag = role === 'host'
    ? { label: 'Host', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' }
    : role === 'cohost'
    ? { label: 'Co-host', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
    : null

  return (
    <div style={{ borderRadius: '10px', marginBottom: '4px', overflow: 'hidden' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 8px', transition: 'background 0.15s', cursor: isHost && !isLocal ? 'pointer' : 'default' }}
        onClick={() => isHost && !isLocal && setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

        {/* Avatar with speaking ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem', color: 'white', boxShadow: isSpeaking ? '0 0 0 2px #3b82f6' : 'none', transition: 'box-shadow 0.3s' }}>
            {name?.[0]?.toUpperCase() || '?'}
          </div>
          {isMuted && <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicOff size={8} color="#f87171" /></div>}
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{name}</span>
            {isLocal && <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>(You)</span>}
            {roleTag && <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: roleTag.bg, color: roleTag.color }}>{roleTag.label}</span>}
            {handRaised && <span style={{ fontSize: '0.65rem' }}>✋</span>}
            {isSharing && <span style={{ fontSize: '0.65rem' }}>🖥</span>}
            {hasViolation && <span style={{ fontSize: '0.65rem' }}>⚠️</span>}
          </div>
          {email && <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
        </div>

        {/* Status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isSpeaking && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />}
          {isHost && !isLocal && (
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={13} color="#64748b" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Host control panel (expandable) */}
      <AnimatePresence>
        {isHost && !isLocal && expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

              <HostBtn icon={isMuted ? Mic : MicOff} label={isMuted ? 'Unmute' : 'Mute'}
                color="#60a5fa" onClick={() => onMute?.(socketId)} />

              <HostBtn icon={Camera} label="Req Cam On" color="#06b6d4"
                onClick={() => onRequestCamera?.(socketId, 'on')} />

              <HostBtn icon={CameraOff} label="Req Cam Off" color="#94a3b8"
                onClick={() => onRequestCamera?.(socketId, 'off')} />

              <HostBtn icon={Monitor} label="Stop Share" color="#f59e0b"
                onClick={() => onDisableScreen?.(socketId)} />

              <HostBtn icon={Crown} label={role === 'cohost' ? 'Is Co-host' : 'Promote'}
                color="#a78bfa" disabled={role === 'cohost'}
                onClick={() => role !== 'cohost' && onPromote?.(socketId)} />

              <HostBtn icon={Circle} label={recordingPermission ? 'Revoke Rec' : 'Allow Rec'}
                color={recordingPermission ? '#f87171' : '#4ade80'}
                onClick={() => onGrantRecording?.(socketId, !recordingPermission)} />

              <HostBtn icon={Trash2} label="Remove" color="#f87171"
                onClick={() => onRemove?.(socketId)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HostBtn({ icon: Icon, label, color, onClick, disabled }) {
  return (
    <motion.button whileTap={disabled ? {} : { scale: 0.92 }} onClick={onClick}
      disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: '6px', background: `${color}18`, border: `1px solid ${color}35`, color, fontSize: '0.69rem', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
      <Icon size={11} />{label}
    </motion.button>
  )
}
