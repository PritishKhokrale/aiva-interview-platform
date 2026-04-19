import { useState, useEffect, useRef, useCallback } from 'react'
import * as faceapi from 'face-api.js'

/**
 * useFaceAnalysis — ML-based facial expression analysis using face-api.js
 * Samples the local video stream every 3s, detects facial expressions using TensorFlow.js,
 * and maps them to interview metrics.
 */
export function useFaceAnalysis(localStream, isSpeaking) {
  const [metrics, setMetrics] = useState({
    focus: 82, confidence: 70, stress: 18, eyeContact: 78,
    dominant: 'Focused', breakdown: { focused: 55, confident: 25, neutral: 15, stressed: 5 }
  })
  const [timeline, setTimeline] = useState([])
  const videoElRef = useRef(null)

  useEffect(() => {
    let modelsLoaded = false
    const loadModels = async () => {
      try {
        // Models are hosted in the public/models directory
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
        await faceapi.nets.faceExpressionNet.loadFromUri('/models')
        modelsLoaded = true
      } catch (err) {
        console.error("Failed to load face-api models:", err)
      }
    }
    loadModels()

    if (!localStream) return
    const video = document.createElement('video')
    video.srcObject = localStream
    video.muted = true
    video.play().catch(() => {})
    videoElRef.current = video

    const analyze = async () => {
      if (video.readyState < 2 || !modelsLoaded) return
      try {
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions()

        let focus = 50, confidence = 40, stress = 15, eyeContact = 50, dominant = 'Neutral'
        let breakdown = { focused: 0, confident: 0, neutral: 100, stressed: 0 }

        if (detections) {
          const expr = detections.expressions
          
          // face-api.js returns values from 0.0 to 1.0 for each emotion
          const neutral = expr.neutral || 0
          const happy = expr.happy || 0
          const angry = expr.angry || 0
          const fearful = expr.fearful || 0
          const sad = expr.sad || 0

          // Map actual ML emotions to meeting metrics
          stress = clamp((angry + fearful * 1.5 + sad) * 100 + 10, 0, 100)
          
          const speakBoost = isSpeaking ? 15 : 0
          confidence = clamp((happy * 1.2 + neutral * 0.8) * 100 + speakBoost, 0, 100)
          
          focus = clamp((neutral + happy * 0.5) * 100 - (angry * 50), 20, 100)
          eyeContact = clamp(focus - 5 + (isSpeaking ? 10 : 0), 20, 100)

          const scores = { focused: focus, confident: confidence, neutral: neutral * 100, stressed: stress }
          dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]

          const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1
          breakdown = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round(v / total * 100)]))
        } else {
          // No face detected - drop focus and eye contact
          focus = 10; eyeContact = 0; dominant = 'Away'
          breakdown = { focused: 0, confident: 0, neutral: 0, stressed: 0 }
        }

        setMetrics({ focus, confidence, stress, eyeContact, dominant, breakdown })
        setTimeline(prev => [...prev.slice(-60), {
          time: Date.now(), focus, confidence, stress, eyeContact, dominant
        }])
      } catch (err) {
        console.error("Analysis error:", err)
      }
    }

    const id = setInterval(analyze, 3000)
    setTimeout(analyze, 1000) // Initial sample shortly after load
    return () => {
      clearInterval(id)
      video.srcObject = null
    }
  }, [localStream, isSpeaking])

  const generateReport = useCallback((meetingInfo, user, transcript, violations, startTime, chat) => {
    const duration = Math.round((Date.now() - startTime) / 1000)
    const mins = Math.floor(duration / 60), secs = duration % 60
    const snap = timeline.length ? timeline : [metrics]
    const avg = (key) => Math.round(snap.reduce((s, t) => s + t[key], 0) / snap.length)
    const avgFocus = avg('focus'), avgConf = avg('confidence'), avgStress = avg('stress'), avgEye = avg('eyeContact')

    const emotionCounts = {}
    snap.forEach(t => { emotionCounts[t.dominant] = (emotionCounts[t.dominant] || 0) + 1 })
    const dominantOverall = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Focused'

    const scoreColor = (v) => v >= 75 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444'
    const grade = (v) => v >= 80 ? 'Excellent' : v >= 65 ? 'Good' : v >= 50 ? 'Average' : 'Needs Work'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>AIVA Interview Report — ${meetingInfo?.title || 'Meeting'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #1e40af, #4f46e5); color: white; padding: 40px; }
  .header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 8px; }
  .header p { opacity: 0.8; font-size: 0.95rem; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.2); font-size:0.8rem; margin-right:8px; margin-top:8px; }
  .container { max-width: 860px; margin: 0 auto; padding: 32px 20px; }
  .section { background: white; border-radius: 16px; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .section h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; color: #1e293b; display:flex; align-items:center; gap:8px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .metric-card { text-align: center; padding: 20px 10px; border-radius: 12px; background: #f8fafc; }
  .metric-val { font-size: 2rem; font-weight: 800; }
  .metric-label { font-size: 0.78rem; color: #64748b; margin-top: 4px; font-weight: 600; text-transform:uppercase; letter-spacing:0.04em; }
  .metric-grade { font-size: 0.75rem; margin-top: 6px; font-weight: 600; padding: 2px 8px; border-radius: 20px; display:inline-block; background:#f1f5f9; }
  .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .bar-label { width: 100px; font-size: 0.85rem; font-weight: 600; flex-shrink: 0; }
  .bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; }
  .bar-val { width: 36px; text-align: right; font-size: 0.85rem; font-weight: 700; }
  .transcript-item { padding: 10px 14px; border-left: 3px solid #3b82f6; background: #f8fafc; border-radius: 0 8px 8px 0; margin-bottom: 8px; }
  .transcript-speaker { font-weight: 700; font-size: 0.8rem; color: #3b82f6; margin-bottom: 3px; }
  .transcript-text { font-size: 0.88rem; color: #374151; line-height: 1.5; }
  .violation-item { padding: 8px 12px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; margin-bottom: 6px; font-size: 0.85rem; }
  .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 0.8rem; }
  @media print { body { background: white; } .section { box-shadow: none; border: 1px solid #e2e8f0; } }
</style>
</head>
<body>
<div class="header">
  <h1>🎯 Interview Report</h1>
  <p>${meetingInfo?.title || 'AIVA Interview Session'}</p>
  <div style="margin-top:12px">
    <span class="badge">👤 ${user?.name || 'Candidate'}</span>
    <span class="badge">⏱ Duration: ${mins}m ${secs}s</span>
    <span class="badge">📅 ${new Date().toLocaleDateString('en-IN', { dateStyle:'long' })}</span>
    <span class="badge">🏷 Meeting #${meetingInfo?.id || 'N/A'}</span>
  </div>
</div>

<div class="container">

  <!-- Score Cards -->
  <div class="section">
    <h2>📊 Performance Overview</h2>
    <div class="grid-4">
      ${[
        { label: 'Focus', val: avgFocus },
        { label: 'Confidence', val: avgConf },
        { label: 'Eye Contact', val: avgEye },
        { label: 'Composure', val: Math.round(100 - avgStress) },
      ].map(({ label, val }) => `
      <div class="metric-card">
        <div class="metric-val" style="color:${scoreColor(val)}">${val}%</div>
        <div class="metric-label">${label}</div>
        <div class="metric-grade" style="color:${scoreColor(val)}">${grade(val)}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Facial Analysis -->
  <div class="section">
    <h2>🧠 Facial Expression Analysis</h2>
    <p style="color:#64748b;font-size:0.85rem;margin-bottom:16px">Dominant emotion throughout session: <strong>${dominantOverall}</strong></p>
    ${[
      ['Focus',       avgFocus,  '#3b82f6'],
      ['Confidence',  avgConf,   '#8b5cf6'],
      ['Eye Contact', avgEye,    '#06b6d4'],
      ['Stress Level',avgStress, '#ef4444'],
    ].map(([l, v, c]) => `
    <div class="bar-row">
      <div class="bar-label">${l}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${c}"></div></div>
      <div class="bar-val">${Math.round(v)}%</div>
    </div>`).join('')}
  </div>

  <!-- Anti-cheat -->
  ${violations.length > 0 ? `
  <div class="section">
    <h2>🚨 Anti-Cheat Report (${violations.length} violation${violations.length > 1 ? 's' : ''})</h2>
    ${violations.map(v => `<div class="violation-item">⚠️ <strong>${v.name}</strong>: ${v.violationType} — ${v.count} occurrence${v.count > 1 ? 's' : ''}</div>`).join('')}
  </div>` : `
  <div class="section">
    <h2>✅ Anti-Cheat</h2>
    <p style="color:#22c55e;font-weight:600">No violations detected during this session.</p>
  </div>`}

  <!-- Transcript -->
  ${transcript.length > 0 ? `
  <div class="section">
    <h2>📝 Session Transcript</h2>
    ${transcript.slice(0, 30).map(t => `
    <div class="transcript-item">
      <div class="transcript-speaker">${t.speakerName} — ${new Date(t.timestamp || Date.now()).toLocaleTimeString()}</div>
      <div class="transcript-text">${t.text}</div>
    </div>`).join('')}
    ${transcript.length > 30 ? `<p style="color:#94a3b8;font-size:0.8rem;margin-top:8px">... and ${transcript.length - 30} more entries</p>` : ''}
  </div>` : ''}

</div>
<div class="footer">Generated by AIVA — AI Video Interview Platform · ${new Date().toISOString()}</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AIVA-Report-${meetingInfo?.id || Date.now()}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }, [timeline, metrics])

  return { metrics, timeline, generateReport }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)) }
