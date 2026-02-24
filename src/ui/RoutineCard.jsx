import React, { useRef, useCallback, useState } from 'react'
import BlockCanvas from './BlockCanvas'

const CARD_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

export default function RoutineCard({
  routine,          // { id, name, blocks, pos, color }
  isMain,
  running,
  onBlocksChange,
  onNameChange,
  onRun,
  onStop,
  onDelete,
  onMove,
  log,
  customDefs,
  onAddCustomDef,
}) {
  const [logOpen, setLogOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(routine.name)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [customColor, setCustomColor] = useState(CARD_COLORS[2])
  const dragRef = useRef(null)

  const onHeaderMouseDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
    e.preventDefault()
    dragRef.current = { startX: e.clientX - routine.pos.x, startY: e.clientY - routine.pos.y }
    function onMouseMove(e) {
      if (!dragRef.current) return
      onMove({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY })
    }
    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [routine.pos, onMove])

  const commitName = () => {
    setEditingName(false)
    const clean = nameVal.trim().replace(/\s+/g, '_') || routine.name
    setNameVal(clean)
    onNameChange(clean)
  }

  const saveCustomDef = () => {
    const name = customName.trim().replace(/\s+/g, '_')
    if (!name) return
    onAddCustomDef({ name, code: customCode, color: customColor })
    setCustomName('')
    setCustomCode('')
    setCustomColor(CARD_COLORS[2])
    setShowCustomModal(false)
  }

  const accentColor = routine.color ?? CARD_COLORS[0]
  const errorCount = (log ?? []).filter(e => e.type === 'error').length

  return (
    <div style={{
      position: 'absolute',
      top: routine.pos.y,
      left: routine.pos.x,
      width: 340,
      zIndex: 100,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(12px)',
      border: `1.5px solid ${accentColor}33`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px ${accentColor}22`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>

      {/* Header */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px',
          background: accentColor + '18',
          borderBottom: `1px solid ${accentColor}22`,
          cursor: 'grab',
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: accentColor, flexShrink: 0,
        }} />

        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setEditingName(false); setNameVal(routine.name) }
            }}
            style={{
              flex: 1, background: 'white', border: `1px solid ${accentColor}`,
              borderRadius: 5, padding: '2px 6px',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12, fontWeight: 700, color: '#1e293b', outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingName(true)}
            style={{
              flex: 1, fontSize: 12, fontWeight: 700,
              color: '#1e293b', letterSpacing: '0.04em',
              cursor: 'text',
            }}
            title="Double-click to rename"
          >
            {isMain ? '▶ main' : routine.name}
          </span>
        )}

        {!isMain && (
          <button onClick={onDelete} style={{
            background: 'none', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}>✕</button>
        )}
      </div>

      {/* Block canvas */}
      <div style={{ padding: '10px 12px', userSelect: 'text', overflowY: 'auto', maxHeight: 360 }}>
        <BlockCanvas
          blocks={routine.blocks ?? []}
          onChange={onBlocksChange}
          customDefs={customDefs ?? []}
        />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        borderTop: `1px solid ${accentColor}22`,
        background: accentColor + '08',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isMain && (
            !running ? (
              <button onClick={onRun} style={runBtn('#16a34a')}>▶ RUN</button>
            ) : (
              <button onClick={onStop} style={runBtn('#dc2626')}>■ STOP</button>
            )
          )}
          <button
            onClick={() => setShowCustomModal(true)}
            style={{
              background: 'none', border: `1px dashed ${accentColor}66`,
              borderRadius: 5, padding: '3px 8px',
              color: accentColor, fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 10, cursor: 'pointer',
            }}
          >
            + custom block
          </button>
        </div>

        {isMain && (
          <button
            onClick={() => setLogOpen(o => !o)}
            style={{
              background: 'none',
              border: `1px solid ${errorCount > 0 ? '#fca5a5' : '#e2e8f0'}`,
              borderRadius: 5, padding: '3px 8px',
              color: errorCount > 0 ? '#ef4444' : '#94a3b8',
              fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 10, cursor: 'pointer',
            }}
          >
            {errorCount > 0 ? `● ${errorCount} error${errorCount > 1 ? 's' : ''}` : (logOpen ? 'hide ▲' : 'log ▼')}
          </button>
        )}
      </div>

      {/* Log */}
      {isMain && logOpen && (
        <div style={{
          maxHeight: 120, overflowY: 'auto',
          padding: '6px 12px 10px',
          fontSize: 11, fontFamily: "'SF Mono', 'Fira Code', monospace",
          background: '#f8fafc',
          borderTop: '1px solid #f1f5f9',
        }}>
          {(log ?? []).length === 0 && (
            <div style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No output.</div>
          )}
          {(log ?? []).slice(-30).map((entry, i) => (
            <div key={i} style={{
              color: entry.type === 'success' ? '#16a34a'
                   : entry.type === 'error'   ? '#ef4444'
                   : '#64748b',
              padding: '1px 0',
            }}>› {entry.msg}</div>
          ))}
        </div>
      )}

      {/* Custom block modal */}
      {showCustomModal && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.97)',
          zIndex: 10, display: 'flex', flexDirection: 'column', padding: 16, gap: 10,
          borderRadius: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>New Custom Block</div>

          <input
            autoFocus
            placeholder="block name (e.g. farm_row)"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            style={modalInput}
          />

          <textarea
            placeholder={'plant("wheat")\nharvest()'}
            value={customCode}
            onChange={e => setCustomCode(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const el = e.target
                const s = el.selectionStart
                const newVal = customCode.substring(0, s) + '\t' + customCode.substring(el.selectionEnd)
                setCustomCode(newVal)
                requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 1 })
              }
            }}
            rows={5}
            style={{ ...modalInput, resize: 'vertical', fontFamily: "'SF Mono', 'Fira Code', monospace", tabSize: 4 }}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>color:</span>
            {CARD_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setCustomColor(c)}
                style={{
                  width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer',
                  outline: customColor === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={saveCustomDef} style={runBtn('#16a34a')}>Save</button>
            <button onClick={() => setShowCustomModal(false)} style={runBtn('#64748b')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function runBtn(bg) {
  return {
    background: bg, border: 'none', borderRadius: 6,
    padding: '5px 14px', color: '#fff',
    fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 700, fontSize: 11,
    cursor: 'pointer',
  }
}

const modalInput = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: '#1e293b',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export { CARD_COLORS }
