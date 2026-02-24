import React from 'react'
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
  function updateBlock(id, updated) {
    onChange(blocks.map(b => b.id === id ? updated : b))
  }

  function deleteBlock(id) {
    onChange(blocks.filter(b => b.id !== id))
  }

  function addBlock(type, extraArgs) {
    onChange([...blocks, makeBlock(type, extraArgs)])
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
        {blocks.map(b => (
          <Block
            key={b.id}
            block={b}
            onChange={updated => updateBlock(b.id, updated)}
            onDelete={() => deleteBlock(b.id)}
            customDefs={customDefs}
          />
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
