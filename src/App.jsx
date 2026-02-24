import React, { useState, useRef, useCallback, useEffect } from 'react'
import GameScene from './scene/GameScene'
import RoutineCard, { CARD_COLORS } from './ui/RoutineCard'
import { useGameStore, CROP_STAGES, TILE_COST } from './game/store'
import { interpret, MACHINE_COMPAT } from './game/lang/interpreter'
import { blocksToCode } from './game/lang/blocksToCode'

const STEP_MS = 400
let nextId = 1

const DIR_DELTA = {
  right: { col: 1, row: 0 },
  left:  { col: -1, row: 0 },
  up:    { col: 0, row: -1 },
  down:  { col: 0, row: 1 },
}

const DIR_ARROWS = { up: '↑', down: '↓', left: '←', right: '→' }

const MACHINE_TYPES = [
  { type: 'base_drone', label: 'Drone',     color: '#3b82f6' },
  { type: 'mower',      label: 'Mower',     color: '#22c55e' },
  { type: 'planter',    label: 'Planter',   color: '#f97316' },
  { type: 'harvester',  label: 'Harvester', color: '#ef4444' },
]

function makeRoutine(name, color, x, y, blocks = []) {
  return { id: String(nextId++), name, color, pos: { x, y }, blocks }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Per-machine getState wrapper — makes interpreter see drone = this machine's position
function makeMachineGetState(machineId) {
  return () => {
    const s = useGameStore.getState()
    const m = s.machines.find(m => m.id === machineId)
    if (!m) return s
    return {
      ...s,
      drone: { col: m.col, row: m.row, action: m.action },
      canMove: (dir) => {
        const d = DIR_DELTA[dir]
        if (!d) return false
        return !!s.tiles.find(t => t.col === m.col + d.col && t.row === m.row + d.row)
      },
      getCurrentTile: () => s.getTileAt(m.col, m.row),
    }
  }
}

export default function App() {
  const store = useGameStore()
  const [visible, setVisible] = useState(true)

  // Main card blocks (used by base drone when no routineId set)
  const [mainBlocks, setMainBlocks] = useState([
    { id: 'm1', type: 'call', args: { name: 'farm_tile' }, children: null },
  ])
  const [mainPos, setMainPos] = useState({ x: 24, y: 24 })

  // Routine cards
  const [routines, setRoutines] = useState([
    makeRoutine('farm_tile', CARD_COLORS[1], 400, 24, [
      { id: 'r1', type: 'plant',   args: { crop: 'wheat' }, children: null },
      { id: 'r2', type: 'harvest', args: {},                children: null },
    ]),
  ])

  const [customDefs, setCustomDefs] = useState([])
  const runningRef = useRef(false)

  // C key toggle
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (e.key === 'c' || e.key === 'C') setVisible(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Crop timer
  useEffect(() => {
    const id = setInterval(() => useGameStore.getState().tickCrops(), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Per-machine step runner ────────────────────────────────────────────────
  async function runMachine(machineId, code, userRoutines, machineType) {
    const getState = makeMachineGetState(machineId)
    const gen = interpret(code, getState, userRoutines, machineType)
    for await (const step of gen) {
      if (!runningRef.current) break
      switch (step.type) {
        case 'plant': {
          const m = useGameStore.getState().machines.find(m => m.id === machineId)
          if (m) useGameStore.getState().setTileStage(m.col, m.row, CROP_STAGES.SEEDED)
          useGameStore.getState().setMachineAction(machineId, 'planting')
          await sleep(STEP_MS)
          useGameStore.getState().setMachineAction(machineId, 'idle')
          break
        }
        case 'harvest': {
          useGameStore.getState().setMachineAction(machineId, 'harvesting')
          await sleep(STEP_MS)
          const m = useGameStore.getState().machines.find(m => m.id === machineId)
          if (m) {
            useGameStore.getState().setTileStage(m.col, m.row, CROP_STAGES.EMPTY)
            useGameStore.getState().addToBag('wheat', 1)
          }
          useGameStore.getState().setMachineAction(machineId, 'idle')
          break
        }
        case 'move_dir': {
          useGameStore.getState().moveMachineDir(machineId, step.dir)
          await sleep(STEP_MS)
          break
        }
        case 'wait':  { await sleep(STEP_MS); break }
        case 'poll':  { await sleep(250); break }
        case 'tick':  { await sleep(0); break }
        case 'log':   {
          const label = machineType !== 'base_drone' ? `[${machineType}] ` : ''
          useGameStore.getState().appendLog(`${label}${step.msg}`, step.logType)
          break
        }
        case 'done': {
          const label = machineType !== 'base_drone' ? `[${machineType}] ` : ''
          useGameStore.getState().appendLog(`${label}Done.`, 'success')
          break
        }
      }
    }
    useGameStore.getState().setMachineAction(machineId, 'idle')
  }

  // ── Run all machines in parallel ──────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    store.setRunning(true)
    store.clearLog()

    const userRoutines = {}
    customDefs.forEach(d => { userRoutines[d.name] = d.code })
    routines.forEach(r => { userRoutines[r.name] = blocksToCode(r.blocks) })

    const machines = useGameStore.getState().machines
    const tasks = machines.map(m => {
      let code
      if (m.routineId) {
        const routine = routines.find(r => r.id === m.routineId)
        if (!routine) return Promise.resolve()
        code = blocksToCode(routine.blocks)
      } else if (m.id === '1') {
        // Base drone with no routineId assigned → use main card blocks
        code = blocksToCode(mainBlocks)
      } else {
        return Promise.resolve() // no routine assigned, skip
      }
      return runMachine(m.id, code, userRoutines, m.type)
    })

    await Promise.all(tasks)

    useGameStore.getState().setRunning(false)
    runningRef.current = false
  }, [mainBlocks, routines, customDefs])

  const handleStop = useCallback(() => {
    runningRef.current = false
    useGameStore.getState().setRunning(false)
    useGameStore.getState().machines.forEach(m =>
      useGameStore.getState().setMachineAction(m.id, 'idle')
    )
    useGameStore.getState().appendLog('Stopped.', 'error')
  }, [])

  const addRoutine = () => {
    const idx = routines.length % CARD_COLORS.length
    const x = 400 + routines.length * 360
    setRoutines(prev => [...prev, makeRoutine(`routine_${nextId}`, CARD_COLORS[idx], Math.min(x, window.innerWidth - 360), 24)])
  }

  const updateRoutine = (id, patch) =>
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const deleteRoutine = (id) =>
    setRoutines(prev => prev.filter(r => r.id !== id))

  const addCustomDef = (def) =>
    setCustomDefs(prev => [...prev, { id: String(nextId++), ...def }])

  const { bag, running, log } = store

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GameScene />
      </div>

      {visible && (
        <>
          {/* Main card */}
          <RoutineCard
            routine={{ id: 'main', name: 'main', blocks: mainBlocks, pos: mainPos, color: CARD_COLORS[0] }}
            isMain
            running={running}
            onBlocksChange={setMainBlocks}
            onNameChange={() => {}}
            onRun={handleRun}
            onStop={handleStop}
            onDelete={() => {}}
            onMove={setMainPos}
            log={log}
            customDefs={[...customDefs, ...routines.map(r => ({ id: r.id, name: r.name, color: r.color, code: '' }))]}
            onAddCustomDef={addCustomDef}
          />

          {/* Routine cards */}
          {routines.map(r => (
            <RoutineCard
              key={r.id}
              routine={r}
              isMain={false}
              running={false}
              onBlocksChange={blocks => updateRoutine(r.id, { blocks })}
              onNameChange={name => updateRoutine(r.id, { name })}
              onRun={() => {}}
              onStop={() => {}}
              onDelete={() => deleteRoutine(r.id)}
              onMove={pos => updateRoutine(r.id, { pos })}
              log={[]}
              customDefs={customDefs}
              onAddCustomDef={addCustomDef}
            />
          ))}

          {/* Add routine button */}
          <button
            onClick={addRoutine}
            style={{
              position: 'absolute', bottom: 24, left: 24,
              zIndex: 90,
              background: 'rgba(255,255,255,0.9)',
              border: '1.5px dashed #cbd5e1',
              borderRadius: 10, padding: '7px 14px',
              color: '#94a3b8', fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            + routine card
          </button>
        </>
      )}

      {!visible && (
        <button onClick={() => setVisible(true)} style={{
          position: 'absolute', bottom: 24, left: 24,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 10, color: '#475569',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 13, fontWeight: 700,
          padding: '9px 16px', cursor: 'pointer', zIndex: 50,
        }}>{'</>'}</button>
      )}

      <RightSidebar bag={bag} routines={routines} />
    </div>
  )
}

// ─── Right Sidebar (bag + tile panel stacked) ─────────────────────────────────
function RightSidebar({ bag, routines }) {
  const { selectedTiles, tiles, machines } = useGameStore()
  const store = useGameStore()

  const canAfford = bag.wheat >= TILE_COST

  // Expandable edges for selected tiles
  const expandable = []
  const seen = new Set()
  selectedTiles.forEach(id => {
    const [c, r] = id.split(',').map(Number)
    for (const [dir, d] of Object.entries(DIR_DELTA)) {
      const nc = c + d.col, nr = r + d.row
      const key = `${c},${r},${dir}`
      if (!seen.has(key) && !tiles.find(t => t.col === nc && t.row === nr)) {
        seen.add(key)
        expandable.push({ col: c, row: r, dir })
      }
    }
  })

  const firstId = selectedTiles[0]
  const selCoords = firstId ? firstId.split(',').map(Number) : null
  const selTile = selCoords ? tiles.find(t => t.id === firstId) : null
  const selMachine = selCoords ? machines.find(m => m.col === selCoords[0] && m.row === selCoords[1]) : null

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 55, width: 200,
      fontFamily: "'SF Mono', 'Fira Code', monospace",
    }}>
      {/* Bag */}
      <div style={panel}>
        <div style={labelStyle}>BAG</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>
          {bag.wheat}
          <span style={{ fontSize: 12, fontWeight: 500, color: '#92400e', marginLeft: 5 }}>wheat</span>
        </div>
      </div>

      {/* Tile panel — shown when a tile is selected */}
      {selectedTiles.length > 0 && selCoords && (
        <>
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={labelStyle}>TILE ({selCoords[0]},{selCoords[1]})</div>
              <button
                onClick={() => store.clearSelection()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 0 }}
              >✕</button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{selTile?.stage}</div>

            {/* Machine section */}
            <div style={{ marginTop: 4 }}>
              <div style={labelStyle}>MACHINE</div>
              {selMachine ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#1e293b',
                      background: (MACHINE_TYPES.find(m => m.type === selMachine.type)?.color ?? '#64748b') + '22',
                      border: `1px solid ${(MACHINE_TYPES.find(m => m.type === selMachine.type)?.color ?? '#64748b')}44`,
                      borderRadius: 5, padding: '2px 6px',
                    }}>
                      {MACHINE_TYPES.find(m => m.type === selMachine.type)?.label ?? selMachine.type}
                    </span>
                    {selMachine.id !== '1' && (
                      <button
                        onClick={() => store.removeMachine(selMachine.id)}
                        style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', color: '#ef4444', fontSize: 10, padding: '2px 6px' }}
                      >remove</button>
                    )}
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 3 }}>ROUTINE</div>
                    <select
                      value={selMachine.routineId ?? ''}
                      onChange={e => store.setMachineRoutine(selMachine.id, e.target.value || null)}
                      style={{
                        width: '100%', fontSize: 11, padding: '3px 5px',
                        borderRadius: 5, border: '1px solid #e2e8f0',
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        background: '#f8fafc', color: '#334155',
                      }}
                    >
                      <option value="">{selMachine.id === '1' ? '— main card —' : '— none —'}</option>
                      {routines.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 700 }}>can: </span>
                    {(MACHINE_COMPAT[selMachine.type] ?? [])
                      .filter(c => !c.startsWith('move_'))
                      .join(', ')}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {MACHINE_TYPES.map(({ type, label, color }) => (
                    <button
                      key={type}
                      onClick={() => store.addMachine(type, selCoords[0], selCoords[1])}
                      style={{
                        fontSize: 10, padding: '3px 7px',
                        background: color + '18', border: `1px solid ${color}55`,
                        borderRadius: 5, color, fontWeight: 700,
                        cursor: 'pointer', fontFamily: "'SF Mono', 'Fira Code', monospace",
                      }}
                    >+ {label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expand farm */}
          {expandable.length > 0 && (
            <div style={{ ...panel, alignItems: 'center' }}>
              <div style={labelStyle}>EXPAND  ·  {TILE_COST} wheat</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                {expandable.map(({ col: c, row: r, dir }) => (
                  <button
                    key={`${c},${r},${dir}`}
                    onClick={() => canAfford && store.buyTile(c, r, dir)}
                    title={canAfford ? `Add tile ${dir} of (${c},${r})` : `Need ${TILE_COST} wheat`}
                    style={{
                      width: 32, height: 32,
                      background: canAfford ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${canAfford ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: 7, color: canAfford ? '#15803d' : '#cbd5e1',
                      fontSize: 16, fontWeight: 700, cursor: canAfford ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    {DIR_ARROWS[dir]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTiles.length === 1
            ? <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>shift+click to select more tiles</div>
            : <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center' }}>{selectedTiles.length} tiles selected</div>
          }
        </>
      )}
    </div>
  )
}

const panel = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  borderRadius: 12, padding: '12px 14px',
  display: 'flex', flexDirection: 'column', gap: 8,
}

const labelStyle = {
  fontSize: 9, color: '#94a3b8', letterSpacing: '0.14em', fontWeight: 700,
}
