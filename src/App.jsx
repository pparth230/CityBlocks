import React, { useState, useRef, useCallback, useEffect } from 'react'
import GameScene from './scene/GameScene'
import RoutineCard, { CARD_COLORS } from './ui/RoutineCard'
import { useGameStore, CROP_STAGES, TILE_COST } from './game/store'
import { interpret } from './game/lang/interpreter'
import { blocksToCode } from './game/lang/blocksToCode'

const STEP_MS = 400
let nextId = 1

function makeRoutine(name, color, x, y, blocks = []) {
  return { id: String(nextId++), name, color, pos: { x, y }, blocks }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function App() {
  const store = useGameStore()
  const [visible, setVisible] = useState(true)

  // Main card blocks
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

  // Custom block definitions (user-created)
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

  const handleRun = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    store.setRunning(true)
    store.clearLog()

    // Convert custom defs to userRoutines dict
    const userRoutines = {}
    customDefs.forEach(d => { userRoutines[d.name] = d.code })

    // Convert routine cards to userRoutines dict (blocks → code)
    routines.forEach(r => {
      userRoutines[r.name] = blocksToCode(r.blocks)
    })

    const mainCode = blocksToCode(mainBlocks)
    const gen = interpret(mainCode, useGameStore.getState, userRoutines)

    for await (const step of gen) {
      if (!runningRef.current) break
      switch (step.type) {
        case 'plant': {
          const { drone } = useGameStore.getState()
          useGameStore.getState().setTileStage(drone.col, drone.row, CROP_STAGES.SEEDED)
          useGameStore.getState().setDroneAction('planting')
          await sleep(STEP_MS)
          useGameStore.getState().setDroneAction('idle')
          break
        }
        case 'harvest': {
          useGameStore.getState().setDroneAction('harvesting')
          await sleep(STEP_MS)
          const { drone } = useGameStore.getState()
          useGameStore.getState().setTileStage(drone.col, drone.row, CROP_STAGES.EMPTY)
          useGameStore.getState().addToBag('wheat', 1)
          useGameStore.getState().setDroneAction('idle')
          break
        }
        case 'move_dir': {
          useGameStore.getState().moveDrone(step.dir)
          await sleep(STEP_MS)
          break
        }
        case 'wait':  { await sleep(STEP_MS); break }
        case 'poll':  { await sleep(250); break }
        case 'tick':  { await sleep(0); break }
        case 'log':   { useGameStore.getState().appendLog(step.msg, step.logType); break }
        case 'done':  { useGameStore.getState().appendLog('Done.', 'success'); break }
      }
    }

    useGameStore.getState().setDroneAction('idle')
    useGameStore.getState().setRunning(false)
    runningRef.current = false
  }, [mainBlocks, routines, customDefs])

  const handleStop = useCallback(() => {
    runningRef.current = false
    useGameStore.getState().setRunning(false)
    useGameStore.getState().setDroneAction('idle')
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

  const { tiles, drone, bag, running, log } = store

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

      <HUD bag={bag} />
    </div>
  )
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
const DIR_ARROWS = { up: '↑', down: '↓', left: '←', right: '→' }

function HUD({ bag }) {
  const canAfford = bag.wheat >= TILE_COST

  function DirButton({ dir }) {
    const canBuy = useGameStore(s => s.canBuyInDir(dir))
    const enabled = canAfford && canBuy
    return (
      <button
        onClick={() => enabled && useGameStore.getState().buyTile(dir)}
        title={enabled ? `Add tile ${dir} (${TILE_COST} wheat)` : !canAfford ? 'Need more wheat' : 'Tile already exists'}
        style={{
          width: 32, height: 32,
          background: enabled ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${enabled ? '#86efac' : '#e2e8f0'}`,
          borderRadius: 7, color: enabled ? '#15803d' : '#cbd5e1',
          fontSize: 16, fontWeight: 700, cursor: enabled ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
      >
        {DIR_ARROWS[dir]}
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 10,
      zIndex: 50, minWidth: 160,
      fontFamily: "'SF Mono', 'Fira Code', monospace",
    }}>
      <div style={panel}>
        <div style={labelStyle}>BAG</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>
          {bag.wheat}
          <span style={{ fontSize: 12, fontWeight: 500, color: '#92400e', marginLeft: 5 }}>wheat</span>
        </div>
      </div>

      <div style={{ ...panel, alignItems: 'center', gap: 6 }}>
        <div style={labelStyle}>NEW TILE  ·  {TILE_COST} wheat</div>
        <DirButton dir="up" />
        <div style={{ display: 'flex', gap: 6 }}>
          <DirButton dir="left" />
          <div style={{
            width: 32, height: 32, borderRadius: 7,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#94a3b8',
          }}>●</div>
          <DirButton dir="right" />
        </div>
        <DirButton dir="down" />
      </div>
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
