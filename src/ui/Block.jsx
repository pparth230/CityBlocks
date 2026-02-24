import React from 'react'
import BlockCanvas from './BlockCanvas'

const BLOCK_COLORS = {
  plant:   '#10b981',
  harvest: '#f59e0b',
  move:    '#0ea5e9',
  bag:     '#8b5cf6',
  wait:    '#94a3b8',
  repeat:  '#f97316',
  while:   '#e11d48',
  call:    '#6366f1',
}

const BLOCK_LABELS = {
  plant:   '🌱 plant',
  harvest: '🌾 harvest',
  move:    '➡️ move',
  bag:     '🎒 bag',
  wait:    '⏱ wait',
  repeat:  '🔄 repeat',
  while:   '🔁 while',
  call:    '📦',
}

export default function Block({ block, onChange, onDelete, customDefs }) {
  const color = block.type === 'call'
    ? (customDefs.find(d => d.name === block.args.name)?.color ?? BLOCK_COLORS.call)
    : BLOCK_COLORS[block.type] ?? '#64748b'

  function patchArgs(patch) {
    onChange({ ...block, args: { ...block.args, ...patch } })
  }

  function patchChildren(children) {
    onChange({ ...block, children })
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${color}`,
      borderRadius: 7,
      marginBottom: 4,
      overflow: 'hidden',
    }}>
      {/* Block header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 12,
        userSelect: 'none',
      }}>
        <span style={{ color, fontWeight: 700, minWidth: 70 }}>
          {block.type === 'call'
            ? `📦 ${block.args.name ?? 'routine'}`
            : BLOCK_LABELS[block.type]}
        </span>

        {/* Inline params */}
        {block.type === 'plant' && (
          <input
            value={block.args.crop ?? 'wheat'}
            onChange={e => patchArgs({ crop: e.target.value })}
            style={inputStyle}
            placeholder="crop"
          />
        )}

        {block.type === 'move' && (
          <select
            value={block.args.dir ?? 'right'}
            onChange={e => patchArgs({ dir: e.target.value })}
            style={selectStyle}
          >
            {['up', 'down', 'left', 'right'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        {block.type === 'wait' && (
          <>
            <input
              type="number"
              min={1} max={60}
              value={block.args.seconds ?? 1}
              onChange={e => patchArgs({ seconds: Number(e.target.value) })}
              style={{ ...inputStyle, width: 44 }}
            />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>sec</span>
          </>
        )}

        {block.type === 'repeat' && (
          <>
            <input
              type="number"
              min={1} max={500}
              value={block.args.count ?? 3}
              onChange={e => patchArgs({ count: Number(e.target.value) })}
              style={{ ...inputStyle, width: 44 }}
            />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>times</span>
          </>
        )}

        {block.type === 'while' && (
          <input
            value={block.args.cond ?? 'True'}
            onChange={e => patchArgs({ cond: e.target.value })}
            style={{ ...inputStyle, width: 110, fontStyle: block.args.cond === 'True' ? 'italic' : 'normal' }}
            placeholder="True"
            spellCheck={false}
          />
        )}

        <button
          onClick={onDelete}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#cbd5e1', cursor: 'pointer', fontSize: 14,
            lineHeight: 1, padding: '0 2px', flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Nested canvas for repeat / while */}
      {(block.type === 'repeat' || block.type === 'while') && (
        <div style={{
          margin: '0 8px 8px 12px',
          borderLeft: `3px solid ${color}55`,
          borderRadius: '0 6px 6px 0',
          background: `${color}08`,
          padding: '6px 8px',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: color, letterSpacing: '0.1em',
            marginBottom: 4, fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}>
            {block.type === 'while' ? 'LOOP BODY' : 'REPEAT BODY'}
          </div>
          <BlockCanvas
            blocks={block.children ?? []}
            onChange={patchChildren}
            customDefs={customDefs}
            nested
          />
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  padding: '2px 6px',
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 11,
  color: '#1e293b',
  outline: 'none',
  width: 72,
}

const selectStyle = {
  ...inputStyle,
  width: 'auto',
  cursor: 'pointer',
}
