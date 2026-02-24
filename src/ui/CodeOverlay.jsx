import React, { useRef, useEffect, useState, useCallback } from 'react'

export const PLACEHOLDER = `# Basic
plant("wheat")
harvest()
bag()

# Loop 3 times
# for i in range(3):
#     plant("wheat")
#     harvest()

# While loop
# while has_wheat(1):
#     move(1)
#     plant("wheat")
#     harvest()
`

export default function CodeOverlay({ visible, onClose, code, onCodeChange, onRun, onStop, running, log }) {
  const [logOpen, setLogOpen] = useState(false)
  const [pos, setPos] = useState({ x: 24, y: 24 })
  const [size, setSize] = useState({ w: 400, h: 340 })
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log, logOpen])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y }

    function onMove(e) {
      if (!dragRef.current) return
      setPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY })
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  // ── Resize handle ─────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h }

    function onMove(e) {
      if (!resizeRef.current) return
      const w = Math.max(280, resizeRef.current.startW + e.clientX - resizeRef.current.startX)
      const h = Math.max(200, resizeRef.current.startH + e.clientY - resizeRef.current.startY)
      setSize({ w, h })
    }
    function onUp() {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size])

  const errorCount = log.filter(e => e.type === 'error').length

  if (!visible) return null

  const logHeight = logOpen ? 150 : 0
  const editorHeight = Math.max(80, size.h - 92 - logHeight)

  return (
    <div style={{
      position: 'absolute',
      top: pos.y,
      left: pos.x,
      width: size.w,
      zIndex: 100,
      borderRadius: 14,
      background: 'rgba(10, 14, 28, 0.88)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: dragRef.current || resizeRef.current ? 'none' : 'auto',
    }}>

      {/* Header — drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          cursor: 'grab',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em' }}>
          FARMBOT SCRIPT
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
        }}>✕</button>
      </div>

      {/* Editor */}
      <textarea
        value={code}
        onChange={e => onCodeChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            e.preventDefault()
            const el = e.target
            const start = el.selectionStart
            const end = el.selectionEnd
            const newVal = code.substring(0, start) + '\t' + code.substring(end)
            onCodeChange(newVal)
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = start + 1
            })
          }
        }}
        spellCheck={false}
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: '#e2e8f0',
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          padding: '12px 14px',
          resize: 'none',
          tabSize: 4,
          height: editorHeight,
          outline: 'none',
          width: '100%',
        }}
      />

      {/* Action row */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!running ? (
            <button onClick={onRun} style={{
              background: '#16a34a', border: 'none', borderRadius: 7,
              padding: '7px 20px', color: '#fff',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', letterSpacing: '0.06em',
            }}>▶ RUN</button>
          ) : (
            <button onClick={onStop} style={{
              background: '#dc2626', border: 'none', borderRadius: 7,
              padding: '7px 20px', color: '#fff',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', letterSpacing: '0.06em',
            }}>■ STOP</button>
          )}
          <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
            {running ? 'Running…' : 'C to toggle'}
          </span>
        </div>
        <button
          onClick={() => setLogOpen(o => !o)}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 6, padding: '4px 10px',
            color: errorCount > 0 ? '#f87171' : '#475569',
            fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
          }}
        >
          {errorCount > 0 && <span style={{ color: '#f87171' }}>● </span>}
          {logOpen ? 'hide log ▲' : 'log ▼'}
        </button>
      </div>

      {/* Collapsible log */}
      {logOpen && (
        <div style={{
          height: logHeight, overflowY: 'auto',
          padding: '8px 14px 12px',
          fontSize: 11, fontFamily: 'inherit',
          background: 'rgba(0,0,0,0.25)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {log.length === 0 && (
            <div style={{ color: '#334155', fontStyle: 'italic' }}>No output yet.</div>
          )}
          {log.slice(-30).map((entry, i) => (
            <div key={i} style={{
              color: entry.type === 'success' ? '#4ade80'
                   : entry.type === 'error'   ? '#f87171'
                   : '#94a3b8',
              padding: '1px 0',
            }}>› {entry.msg}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Resize handle — bottom-right corner */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 18, height: 18,
          cursor: 'nwse-resize',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: '3px',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M9 1L1 9M9 5L5 9M9 9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}
