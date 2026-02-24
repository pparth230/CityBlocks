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

const INITIAL_STATE = {
  tiles: [makeTile(0, 0)],
  drone: { col: 0, row: 0, action: 'idle' },
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

  buyTile(dir) {
    const { bag, drone, tiles } = get()
    if (bag.wheat < TILE_COST) return false
    const d = DIR_DELTA[dir]
    if (!d) return false
    const col = drone.col + d.col
    const row = drone.row + d.row
    if (tiles.find(t => t.col === col && t.row === row)) return false // already exists
    set(s => ({
      tiles: [...s.tiles, makeTile(col, row)],
      bag: { ...s.bag, wheat: s.bag.wheat - TILE_COST },
    }))
    return true
  },

  canBuyInDir(dir) {
    const { bag, drone, tiles } = get()
    if (bag.wheat < TILE_COST) return false
    const d = DIR_DELTA[dir]
    const col = drone.col + d.col
    const row = drone.row + d.row
    return !tiles.find(t => t.col === col && t.row === row)
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

  // ── Drone ──
  setDroneAction(action) {
    set(s => ({ drone: { ...s.drone, action } }))
  },

  moveDrone(dir) {
    const { drone, tiles } = get()
    const d = DIR_DELTA[dir]
    if (!d) return false
    const col = drone.col + d.col
    const row = drone.row + d.row
    if (!tiles.find(t => t.col === col && t.row === row)) return false
    set(s => ({ drone: { ...s.drone, col, row } }))
    return true
  },

  moveDroneTo(col, row) {
    const { tiles } = get()
    if (!tiles.find(t => t.col === col && t.row === row)) return false
    set(s => ({ drone: { ...s.drone, col, row } }))
    return true
  },

  canMove(dir) {
    const { drone, tiles } = get()
    const d = DIR_DELTA[dir]
    if (!d) return false
    return !!tiles.find(t => t.col === drone.col + d.col && t.row === drone.row + d.row)
  },

  getCurrentTile() {
    const { drone } = get()
    return get().getTileAt(drone.col, drone.row)
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
