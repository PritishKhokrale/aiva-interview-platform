import React, { useEffect, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function LiveCodeEditor({ socket, roomId }) {
  const [code, setCode] = useState('// Write your real-time collaborative code here...\n\nfunction example() {\n  return "Hello from AIVA!";\n}\n\nconsole.log(example());\n');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ code: incomingCode }) => {
      setCode(incomingCode);
    };

    socket.on('code-editor-update', handleCodeUpdate);
    return () => {
      socket.off('code-editor-update', handleCodeUpdate);
    };
  }, [socket]);

  const onChange = (value) => {
    setCode(value);
    if (socket && roomId) {
      socket.emit('code-editor-update', { roomId, code: value });
    }
  };

  const runCode = () => {
    setOutput('');
    setError(null);
    setShowOutput(true);

    const logs = [];
    const originalLog = console.log;
    
    // Redirect console.log to our local logs array
    console.log = (...args) => {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    try {
      const result = new Function(code)();
      if (result !== undefined) {
        logs.push(`=> ${String(result)}`);
      }
      setOutput(logs.join('\n'));
    } catch (err) {
      setError(err.message);
    } finally {
      console.log = originalLog; // Restore console.log
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f172a',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        minWidth: '400px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', 
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Terminal size={14} color="white" />
        </div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#e2e8f0' }}>Live Editor</h3>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: '#10b981', padding: '2px 8px', background: 'rgba(16,185,129,0.15)', borderRadius: '12px' }}>JavaScript</span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={runCode}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', 
              padding: '6px 12px', borderRadius: '8px',
              background: '#10b981', border: 'none', color: 'white',
              fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
            }}
          >
            <Play size={12} fill="white" /> Run
          </motion.button>
        </div>
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#020617', position: 'relative' }}>
        <CodeMirror
          value={code}
          height="100%"
          theme="dark"
          extensions={[javascript({ jsx: true })]}
          onChange={onChange}
          style={{ fontSize: '14px', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        />
      </div>

      {/* Output Console */}
      <AnimatePresence>
        {showOutput && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              height: '35%',
              background: '#020617',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
              boxShadow: '0 -10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Console Output</span>
              <button onClick={() => setShowOutput(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <ChevronDown size={14} />
              </button>
            </div>
            
            <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>
              {error ? (
                <div style={{ color: '#f87171', display: 'flex', gap: '8px' }}>
                  <XCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>Runtime Error</div>
                    <div style={{ background: 'rgba(248,113,113,0.1)', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #f87171' }}>{error}</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                  {output || <span style={{ color: '#475569', fontStyle: 'italic' }}>Code executed successfully with no output.</span>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!showOutput && (output || error) && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setShowOutput(true)}
          style={{
            position: 'absolute', bottom: '16px', right: '16px',
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', padding: '6px 12px', borderRadius: '20px',
            fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 5
          }}
        >
          <ChevronUp size={12} /> Show Console
        </motion.button>
      )}
    </motion.div>
  );
}
