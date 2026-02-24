import { create } from 'zustand'

export const CROP_STAGES = {
  EMPTY: 'empty', SEEDED: 'seeded', GROWING: 'growing', READY: 'ready',
}

const CROP_TICK_MAX = { seeded: 1, growing: 1 }
export const TILE_COST = 3

const DIR_DELTA = {
  right: { col: 1,  row: 0  },
  left:  { col: -1, row: 0  },
  up:    { col: 0,  row: -1 },
  down:  { col: 0,  row: 1  },
}

function makeTile(col, row) {
  return { id: `${col},${row}`, col, row, stage: CROP_STAGES.EMPTY, ticksLeft: 0 }
}

let machineIdCounter = 2

const INITIAL_STATE = {
  tiles: [makeTile(0, 0)],
  machines: [{ id: '1', type: 'base_drone', col: 0, row: 0, action: 'idle', routineId: null }],
  selectedTiles: [],
  bag: { wheat: 0 },
  running: false,
  tickCount: 0,
  log: [],
}

export const useGameStore = create((set, get) => ({
  ...INITIAL_STATE,

  // ── Tiles ──
  getTileAt(col, row) {
    return get().tiles.find(t => t.col === col && t.row === row) ?? null
  },

  setTileStage(col, row, stage) {
    set(s => ({
      tiles: s.tiles.map(t =>
        t.col === col && t.row === row ? { ...t, stage, ticksLeft: 0 } : t
      ),
    }))
  },

  buyTile(col, row, dir) {
    const { bag, tiles } = get()
    if (bag.wheat < TILE_COST) return false
    const d = DIR_DELTA[dir]
    if (!d) return false
    const nc = col + d.col
    const nr = row + d.row
    if (tiles.find(t => t.col === nc && t.row === nr)) return false
    set(s => ({
      tiles: [...s.tiles, makeTile(nc, nr)],
      bag: { ...s.bag, wheat: s.bag.wheat - TILE_COST },
    }))
    return true
  },

  canBuyInDir(col, row, dir) {
    const { bag, tiles } = get()
    if (bag.wheat < TILE_COST) return false
    const d = DIR_DELTA[dir]
    if (!d) return false
    const nc = col + d.col
    const nr = row + d.row
    return !tiles.find(t => t.col === nc && t.row === nr)
  },

  tickCrops() {
    set(s => ({
      tiles: s.tiles.map(t => {
        if (t.stage === CROP_STAGES.SEEDED) {
          const ticks = t.ticksLeft + 1
          return ticks >= CROP_TICK_MAX.seeded
            ? { ...t, stage: CROP_STAGES.GROWING, ticksLeft: 0 }
            : { ...t, ticksLeft: ticks }
        }
        if (t.stage === CROP_STAGES.GROWING) {
          const ticks = t.ticksLeft + 1
          return ticks >= CROP_TICK_MAX.growing
            ? { ...t, stage: CROP_STAGES.READY, ticksLeft: 0 }
            : { ...t, ticksLeft: ticks }
        }
        return t
      }),
      tickCount: s.tickCount + 1,
    }))
  },

  // ── Machines ──
  addMachine(type, col, row) {
    const id = String(machineIdCounter++)
    set(s => ({
      machines: [...s.machines, { id, type, col, row, action: 'idle', routineId: null }],
    }))
    return id
  },

  removeMachine(id) {
    set(s => ({ machines: s.machines.filter(m => m.id !== id) }))
  },

  setMachineAction(id, action) {
    set(s => ({
      machines: s.machines.map(m => m.id === id ? { ...m, action } : m),
    }))
  },

  moveMachineDir(id, dir) {
    const { machines, tiles } = get()
    const machine = machines.find(m => m.id === id)
    if (!machine) return false
    const d = DIR_DELTA[dir]
    if (!d) return false
    const col = machine.col + d.col
    const row = machine.row + d.row
    if (!tiles.find(t => t.col === col && t.row === row)) return false
    set(s => ({
      machines: s.machines.map(m => m.id === id ? { ...m, col, row } : m),
    }))
    return true
  },

  canMachineMove(id, dir) {
    const { machines, tiles } = get()
    const machine = machines.find(m => m.id === id)
    if (!machine) return false
    const d = DIR_DELTA[dir]
    if (!d) return false
    return !!tiles.find(t => t.col === machine.col + d.col && t.row === machine.row + d.row)
  },

  getMachineAt(col, row) {
    return get().machines.find(m => m.col === col && m.row === row) ?? null
  },

  setMachineRoutine(id, routineId) {
    set(s => ({
      machines: s.machines.map(m => m.id === id ? { ...m, routineId } : m),
    }))
  },

  // ── Tile selection ──
  selectTile(col, row) {
    set({ selectedTiles: [`${col},${row}`] })
  },

  toggleTileSelection(col, row) {
    const id = `${col},${row}`
    set(s => ({
      selectedTiles: s.selectedTiles.includes(id)
        ? s.selectedTiles.filter(t => t !== id)
        : [...s.selectedTiles, id],
    }))
  },

  clearSelection() {
    set({ selectedTiles: [] })
  },

  // ── Bag ──
  addToBag(crop, amount) {
    set(s => ({ bag: { ...s.bag, [crop]: (s.bag[crop] ?? 0) + amount } }))
  },

  // ── Log ──
  appendLog(msg, type = 'info') {
    set(s => ({ log: [...s.log.slice(-50), { msg, type, t: Date.now() }] }))
  },
  clearLog() { set({ log: [] }) },

  setRunning(v) { set({ running: v }) },
  resetGame()   { set({ ...INITIAL_STATE, log: [] }) },
}))
