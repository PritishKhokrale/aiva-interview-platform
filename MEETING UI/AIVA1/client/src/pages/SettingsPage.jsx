import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Shield, ArrowLeft } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight:'100vh', background:'#020617', padding:'32px' }}>
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} style={{ maxWidth:'560px', margin:'0 auto' }}>
        <button onClick={() => navigate('/dashboard')} style={{ display:'flex', alignItems:'center', gap:'8px', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', marginBottom:'28px', fontSize:'0.88rem' }}>
          <ArrowLeft size={16}/> Back to Dashboard
        </button>
        <h1 style={{ fontSize:'1.75rem', fontWeight:'800', marginBottom:'4px' }}>Settings</h1>
        <p style={{ color:'#64748b', fontSize:'0.9rem', marginBottom:'28px' }}>Manage your account preferences</p>

        <div className="glass" style={{ borderRadius:'16px', overflow:'hidden', marginBottom:'16px' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
              <User size={16} color="#60a5fa"/><span style={{ fontWeight:'700', fontSize:'0.9rem' }}>Profile</span>
            </div>
            <p style={{ color:'#64748b', fontSize:'0.8rem' }}>Your account information</p>
          </div>
          <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={{ display:'block', fontSize:'0.78rem', color:'#94a3b8', marginBottom:'6px', fontWeight:'500' }}>Full Name</label>
              <div className="input-field" style={{ cursor:'not-allowed', opacity:0.7 }}>{user?.name}</div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'0.78rem', color:'#94a3b8', marginBottom:'6px', fontWeight:'500' }}>Email Address</label>
              <div className="input-field" style={{ cursor:'not-allowed', opacity:0.7, display:'flex', alignItems:'center', gap:'8px' }}>
                <Mail size={14} color="#60a5fa"/>{user?.email}
              </div>
            </div>
          </div>
        </div>

        <div className="glass" style={{ borderRadius:'16px', overflow:'hidden' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
              <Shield size={16} color="#a78bfa"/><span style={{ fontWeight:'700', fontSize:'0.9rem' }}>Security</span>
            </div>
          </div>
          <div style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px', borderRadius:'10px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', marginBottom:'16px' }}>
              <Shield size={18} color="#a78bfa"/>
              <div>
                <div style={{ fontWeight:'600', fontSize:'0.88rem' }}>Account Protected</div>
                <div style={{ color:'#64748b', fontSize:'0.78rem', marginTop:'2px' }}>Your session is securely managed</div>
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }}
              style={{ padding:'10px 20px', background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.3)', color:'#f87171', borderRadius:'10px', cursor:'pointer', fontSize:'0.88rem', fontWeight:'600' }}>
              Sign Out of AIVA
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
