import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGoogleLogin } from '@react-oauth/google'
import { Eye, EyeOff, Video, Sparkles, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const GOOGLE_BTN_STYLE = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  width: '100%', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#e2e8f0', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s'
}

export default function LoginPage() {
  const { login, register, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (tab === 'login') await login(form.email, form.password)
      else await register(form.email, form.name, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleGoogleSuccess = async (tokenResponse) => {
    setError(''); setLoading(true)
    try {
      // Exchange code for credential via Google's token endpoint
      await googleLogin(tokenResponse.credential || tokenResponse.access_token)
      navigate('/dashboard')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const googleBtn = useGoogleLogin({
    onSuccess: async (resp) => {
      setError(''); setLoading(true)
      try {
        // Get user info with access token
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        }).then(r => r.json())
        // Create a mock credential object and call our /api/auth/google differently
        const res = await fetch('/api/auth/google-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInfo })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        localStorage.setItem('aiva_user_email', data.email)
        window.location.href = '/dashboard'
      } catch (err) { setError('Google login failed') } finally { setLoading(false) }
    },
    onError: () => setError('Google login failed'),
  })

  return (
    <div className="gradient-hero" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} style={{
            position:'absolute', borderRadius:'50%',
            background: i % 2 === 0 ? 'rgba(59,130,246,0.08)' : 'rgba(99,102,241,0.06)',
            width: `${200 + i * 80}px`, height: `${200 + i * 80}px`,
            left: `${10 + i * 15}%`, top: `${5 + i * 12}%`,
          }} animate={{ scale:[1,1.1,1], opacity:[0.5,0.8,0.5] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }} />
        ))}
      </div>

      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
        style={{ width:'100%', maxWidth:'440px', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <motion.div whileHover={{ scale:1.05 }} style={{
            display:'inline-flex', alignItems:'center', gap:'10px',
            padding:'12px 20px', borderRadius:'16px',
            background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)',
            marginBottom:'16px'
          }}>
            <Video size={24} color="#60a5fa" />
            <span style={{ fontSize:'1.5rem', fontWeight:'800', background:'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>AIVA</span>
          </motion.div>
          <p style={{ color:'#94a3b8', fontSize:'0.9rem' }}>AI-Powered Video Interview Platform</p>
        </div>

        {/* Features row */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
          {[{ icon:Sparkles, text:'AI-Powered' }, { icon:Shield, text:'Anti-Cheat' }, { icon:Video, text:'HD Video' }].map(({ icon:Icon, text }) => (
            <div key={text} style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', padding:'8px 10px', borderRadius:'8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', fontSize:'0.75rem', color:'#94a3b8' }}>
              <Icon size={14} color="#60a5fa" />{text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-strong" style={{ borderRadius:'20px', padding:'32px', overflow:'hidden' }}>
          {/* Tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'28px', background:'rgba(0,0,0,0.2)', padding:'4px', borderRadius:'10px' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }} style={{
                flex:1, padding:'8px', borderRadius:'7px', border:'none', cursor:'pointer',
                background: tab === t ? '#3b82f6' : 'transparent',
                color: tab === t ? 'white' : '#94a3b8',
                fontWeight: tab === t ? '600' : '500', fontSize:'0.9rem', transition:'all 0.2s'
              }}>{t === 'login' ? 'Sign In' : 'Register'}</button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                style={{ padding:'10px 14px', background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', color:'#f87171', fontSize:'0.85rem', marginBottom:'16px' }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <AnimatePresence>
              {tab === 'register' && (
                <motion.div key="name" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  <label style={{ display:'block', fontSize:'0.8rem', color:'#94a3b8', marginBottom:'6px', fontWeight:'500' }}>Full Name</label>
                  <input className="input-field" placeholder="Jane Doe" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label style={{ display:'block', fontSize:'0.8rem', color:'#94a3b8', marginBottom:'6px', fontWeight:'500' }}>Email Address</label>
              <input className="input-field" type="email" placeholder="you@company.com" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'0.8rem', color:'#94a3b8', marginBottom:'6px', fontWeight:'500' }}>Password</label>
              <div style={{ position:'relative' }}>
                <input className="input-field" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required style={{ paddingRight:'42px' }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'#94a3b8'
                }}>{showPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </div>

            <motion.button whileTap={{ scale:0.98 }} className="btn-primary" type="submit" disabled={loading}
              style={{ marginTop:'4px', opacity: loading ? 0.7 : 1 }}>
              {loading ? '...' : tab === 'login' ? 'Sign In to AIVA' : 'Create Account'}
            </motion.button>
          </form>

          <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'20px 0' }}>
            <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.1)' }}/>
            <span style={{ color:'#64748b', fontSize:'0.8rem' }}>or</span>
            <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.1)' }}/>
          </div>

          <motion.button whileHover={{ background:'rgba(255,255,255,0.11)' }} whileTap={{ scale:0.98 }}
            onClick={() => googleBtn()} style={GOOGLE_BTN_STYLE} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </motion.button>
        </div>

        <p style={{ textAlign:'center', marginTop:'16px', color:'#475569', fontSize:'0.8rem' }}>
          By signing in, you agree to AIVA's Terms of Service
        </p>
      </motion.div>
    </div>
  )
}
