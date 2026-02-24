import React, { useRef, useState } from 'react'
import Block from './Block'

let _id = 1
function uid() { return String(_id++) }

const BUILT_IN_TYPES = ['plant', 'harvest', 'move', 'bag', 'wait', 'repeat', 'while']

const DEFAULTS = {
  plant:   { args: { crop: 'wheat' },  children: null },
  harvest: { args: {},                  children: null },
  move:    { args: { dir: 'right' },    children: null },
  bag:     { args: {},                  children: null },
  wait:    { args: { seconds: 1 },      children: null },
  repeat:  { args: { count: 3 },        children: [] },
  while:   { args: { cond: 'True' },    children: [] },
  call:    { args: { name: '' },         children: null },
}

function makeBlock(type, extraArgs = {}) {
  const def = DEFAULTS[type] ?? DEFAULTS.call
  return {
    id: uid(),
    type,
    args: { ...def.args, ...extraArgs },
    children: def.children ? [] : null,
  }
}

export default function BlockCanvas({ blocks, onChange, customDefs = [], nested = false }) {
  const dragSrc = useRef(null)
  const [dragOver, setDragOver] = useState(null) // index being hovered

  function updateBlock(id, updated) {
    onChange(blocks.map(b => b.id === id ? updated : b))
  }

  function deleteBlock(id) {
    onChange(blocks.filter(b => b.id !== id))
  }

  function addBlock(type, extraArgs) {
    onChange([...blocks, makeBlock(type, extraArgs)])
  }

  function handleDragStart(e, idx) {
    dragSrc.current = idx
    e.dataTransfer.effectAllowed = 'move'
    // Tiny delay so the drag image renders before ghost appears
    e.currentTarget.style.opacity = '0.4'
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1'
    setDragOver(null)
    dragSrc.current = null
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dragSrc.current) setDragOver(idx)
  }

  function handleDrop(e, dropIdx) {
    e.preventDefault()
    const srcIdx = dragSrc.current
    if (srcIdx === null || srcIdx === dropIdx) return
    const next = [...blocks]
    const [moved] = next.splice(srcIdx, 1)
    next.splice(dropIdx, 0, moved)
    onChange(next)
    setDragOver(null)
  }

  const addBtnStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 5,
    padding: '3px 8px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 10,
    color: '#64748b',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* Block list */}
      <div style={{ minHeight: nested ? 4 : 8 }}>
        {blocks.length === 0 && !nested && (
          <div style={{
            color: '#cbd5e1', fontSize: 11, fontStyle: 'italic',
            padding: '8px 4px',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}>
            add blocks below ↓
          </div>
        )}
        {blocks.map((b, idx) => (
          <div
            key={b.id}
            draggable
            onDragStart={e => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={e => handleDrop(e, idx)}
            style={{
              borderTop: dragOver === idx ? '2px solid #6366f1' : '2px solid transparent',
              borderRadius: 2,
              cursor: 'grab',
            }}
          >
            <Block
              block={b}
              onChange={updated => updateBlock(b.id, updated)}
              onDelete={() => deleteBlock(b.id)}
              customDefs={customDefs}
            />
          </div>
        ))}
      </div>

      {/* Add-block row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        paddingTop: 6,
        borderTop: nested ? 'none' : '1px dashed #e2e8f0',
        marginTop: nested ? 2 : 6,
      }}>
        {BUILT_IN_TYPES.map(type => (
          <button key={type} style={addBtnStyle} onClick={() => addBlock(type)}>
            + {type}
          </button>
        ))}
        {customDefs.map(def => (
          <button
            key={def.id}
            style={{ ...addBtnStyle, color: def.color, borderColor: def.color + '55' }}
            onClick={() => addBlock('call', { name: def.name })}
          >
            + {def.name}
          </button>
        ))}
      </div>
    </div>
  )
}
