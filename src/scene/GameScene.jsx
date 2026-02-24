import React, { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore, CROP_STAGES, TILE_COST } from '../game/store'

const TILE_SPACING = 2.5

// ─── Expansion arrows ─────────────────────────────────────────────────────────

const DIR_DELTA_3D = {
  up:    { dcol: 0,  drow: -1 },
  down:  { dcol: 0,  drow:  1 },
  left:  { dcol: -1, drow:  0 },
  right: { dcol: 1,  drow:  0 },
}

function getExpansionArrows(selectedTiles, allTiles) {
  if (!selectedTiles.length) return []
  const selected = selectedTiles.map(id => {
    const [col, row] = id.split(',').map(Number)
    return { col, row }
  })
  const minCol = Math.min(...selected.map(t => t.col))
  const maxCol = Math.max(...selected.map(t => t.col))
  const minRow = Math.min(...selected.map(t => t.row))
  const maxRow = Math.max(...selected.map(t => t.row))
  const midCol = Math.round((minCol + maxCol) / 2)
  const midRow = Math.round((minRow + maxRow) / 2)

  // One arrow per direction — anchored to the nearest real tile at the bounding-box edge
  const candidates = [
    { dir: 'up',    srcCol: midCol, srcRow: minRow },
    { dir: 'down',  srcCol: midCol, srcRow: maxRow },
    { dir: 'left',  srcCol: minCol, srcRow: midRow },
    { dir: 'right', srcCol: maxCol, srcRow: midRow },
  ]

  return candidates.filter(c => {
    if (!allTiles.find(t => t.col === c.srcCol && t.row === c.srcRow)) return false
    const { dcol, drow } = DIR_DELTA_3D[c.dir]
    return !allTiles.find(t => t.col === c.srcCol + dcol && t.row === c.srcRow + drow)
  }).map(c => {
    const { dcol, drow } = DIR_DELTA_3D[c.dir]
    // All selected tiles that can expand in this direction (no neighbor that way)
    const sources = selected.filter(s =>
      !allTiles.find(t => t.col === s.col + dcol && t.row === s.row + drow)
    )
    return {
      ...c,
      x: (c.srcCol + dcol) * TILE_SPACING,
      z: (c.srcRow + drow) * TILE_SPACING,
      sources, // [{col, row}] — all tiles that expand together
      multi: sources.length > 1,
    }
  })
}

function ExpansionArrow({ x, z, srcCol, srcRow, dir, canAfford, multi, sources }) {
  const shaftRef = useRef()
  const t = useRef(Math.random() * Math.PI * 2) // stagger phases

  useFrame((_, delta) => {
    t.current += delta * 2.5
    if (shaftRef.current) {
      shaftRef.current.position.y = 0.55 + Math.sin(t.current) * 0.1
    }
  })

  // green = single tile can expand, red = multiple tiles share this direction
  const arrowColor = multi ? '#f87171' : '#4ade80'
  const color    = canAfford ? arrowColor : '#94a3b8'
  const emissive = canAfford ? (multi ? '#991b1b' : '#16a34a') : '#475569'
  const emInt    = canAfford ? 0.55 : 0.1

  function handleClick(e) {
    e.stopPropagation()
    if (!canAfford) return
    // Buy all tiles that expand together in this direction
    sources.forEach(s => useGameStore.getState().buyTile(s.col, s.row, dir))
  }

  function setCursor(on) {
    document.body.style.cursor = on && canAfford ? 'pointer' : 'default'
  }

  return (
    <group position={[x, 0, z]} onClick={handleClick}
      onPointerEnter={() => setCursor(true)}
      onPointerLeave={() => setCursor(false)}
    >
      {/* Glowing base pad — same footprint as a tile */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[2.35, 0.07, 2.35]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={emInt}
          transparent opacity={0.55} roughness={0.4}
        />
      </mesh>
      {/* Dashed border ring */}
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[2.42, 0.03, 2.42]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={emInt + 0.2}
          transparent opacity={0.7} wireframe
        />
      </mesh>

      {/* Floating arrow (shaft + head) */}
      <group ref={shaftRef} position={[0, 0.55, 0]}>
        {/* Shaft */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.13, 0.45, 0.13]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emInt + 0.1} roughness={0.3} />
        </mesh>
        {/* Arrowhead cone */}
        <mesh position={[0, 0.38, 0]}>
          <coneGeometry args={[0.24, 0.38, 6]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emInt + 0.3} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}

function AllExpansionArrows() {
  const selectedTiles = useGameStore(s => s.selectedTiles)
  const tiles         = useGameStore(s => s.tiles)
  const wheat         = useGameStore(s => s.bag.wheat)
  if (!selectedTiles.length) return null
  const arrows = getExpansionArrows(selectedTiles, tiles)
  return (
    <>
      {arrows.flatMap(a => {
        const { dcol, drow } = DIR_DELTA_3D[a.dir]
        const canAfford = wheat >= TILE_COST * a.sources.length
        // One indicator per source tile — shows exactly which tiles will be added
        return a.sources.map(s => (
          <ExpansionArrow
            key={`${a.dir}-${s.col}-${s.row}`}
            x={(s.col + dcol) * TILE_SPACING}
            z={(s.row + drow) * TILE_SPACING}
            srcCol={s.col}
            srcRow={s.row}
            dir={a.dir}
            canAfford={canAfford}
            multi={a.multi}
            sources={a.sources}
          />
        ))
      })}
    </>
  )
}

// ─── Crop visual ──────────────────────────────────────────────────────────────
const STAGE_COLORS = {
  [CROP_STAGES.EMPTY]:   '#8B6B4A',
  [CROP_STAGES.SEEDED]:  '#7A5C3A',
  [CROP_STAGES.GROWING]: '#4a7c59',
  [CROP_STAGES.READY]:   '#2d9e51',
}

function CropVisual({ stage }) {
  const meshRef = useRef()
  useFrame((_, delta) => {
    if (meshRef.current && stage === CROP_STAGES.READY)
      meshRef.current.rotation.y += delta * 1.2
  })
  if (stage === CROP_STAGES.EMPTY) return null
  const scales = {
    [CROP_STAGES.SEEDED]:  [0.08, 0.14, 0.08],
    [CROP_STAGES.GROWING]: [0.12, 0.48, 0.12],
    [CROP_STAGES.READY]:   [0.15, 0.75, 0.15],
  }
  const s = scales[stage] ?? [0, 0, 0]
  return (
    <mesh ref={meshRef} position={[0, s[1] / 2 + 0.12, 0]} castShadow>
      <cylinderGeometry args={[s[0], s[2] * 1.3, s[1], 6]} />
      <meshStandardMaterial
        color={stage === CROP_STAGES.READY ? '#86efac' : '#22c55e'}
        roughness={0.5}
        emissive={stage === CROP_STAGES.READY ? '#16a34a' : '#000'}
        emissiveIntensity={stage === CROP_STAGES.READY ? 0.5 : 0}
      />
    </mesh>
  )
}

// ─── Single farm tile ─────────────────────────────────────────────────────────
function FarmTile({ tile, selected, onTileClick }) {
  const color = STAGE_COLORS[tile.stage] ?? STAGE_COLORS[CROP_STAGES.EMPTY]
  const x = tile.col * TILE_SPACING
  const z = tile.row * TILE_SPACING
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[2.4, 0.22, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[2.5, 0.03, 2.5]} />
        <meshStandardMaterial color="#c8b89a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[2.42, 0.03, 2.42]} />
        <meshStandardMaterial color="#5a3e2b" roughness={1} />
      </mesh>
      <CropVisual stage={tile.stage} />
      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[2.5, 0.05, 2.5]} />
          <meshStandardMaterial
            color="#facc15" emissive="#fbbf24" emissiveIntensity={0.9}
            transparent opacity={0.75}
          />
        </mesh>
      )}
      {/* Invisible click plane */}
      <mesh
        position={[0, 0.25, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={e => { e.stopPropagation(); onTileClick(tile.col, tile.row, e.shiftKey) }}
      >
        <planeGeometry args={[2.4, 2.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

function AllTiles() {
  const tiles = useGameStore(s => s.tiles)
  const selectedTiles = useGameStore(s => s.selectedTiles)
  const selectTile = useGameStore(s => s.selectTile)
  const toggleTileSelection = useGameStore(s => s.toggleTileSelection)

  function onTileClick(col, row, shift) {
    if (shift) {
      toggleTileSelection(col, row)
    } else {
      selectTile(col, row)
    }
  }

  return (
    <>
      {tiles.map(tile => (
        <FarmTile
          key={tile.id}
          tile={tile}
          selected={selectedTiles.includes(tile.id)}
          onTileClick={onTileClick}
        />
      ))}
    </>
  )
}

// ─── Machine visuals ──────────────────────────────────────────────────────────

// Base drone: existing blue humanoid
function BaseDroneBody({ eyeColor }) {
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.7, 0.4]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.2} metalness={0.7}
          emissive="#1e40af" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.45, 0.38, 0.35]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0.18]}>
        <boxGeometry args={[0.28, 0.1, 0.05]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-0.15, -0.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.3, 0.15]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0.15, -0.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.3, 0.15]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} />
      </mesh>
    </>
  )
}

// Mower: flat green disc-like body with spinning blade indicator
function MowerBody({ eyeColor }) {
  return (
    <>
      {/* Main flat body */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.25, 0.9]} />
        <meshStandardMaterial color="#4ade80" roughness={0.3} metalness={0.5}
          emissive="#16a34a" emissiveIntensity={0.15} />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.42, 0.22, 8]} />
        <meshStandardMaterial color="#86efac" roughness={0.2} metalness={0.6} />
      </mesh>
      {/* Status light */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.5} />
      </mesh>
      {/* Wheels */}
      {[[-0.38, -0.16, 0.3], [0.38, -0.16, 0.3], [-0.38, -0.16, -0.3], [0.38, -0.16, -0.3]].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.08, 8]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
      ))}
    </>
  )
}

// Planter: orange upright with downward arm
function PlanterBody({ eyeColor }) {
  return (
    <>
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.65, 0.45]} />
        <meshStandardMaterial color="#fb923c" roughness={0.3} metalness={0.5}
          emissive="#c2410c" emissiveIntensity={0.15} />
      </mesh>
      {/* Seed hopper on top */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.35, 0.3, 0.35]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Planting arm (pointing down-front) */}
      <mesh position={[0, -0.5, 0.15]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.45, 6]} />
        <meshStandardMaterial color="#9a3412" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Status light */}
      <mesh position={[0, 0.2, 0.24]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.5} />
      </mesh>
    </>
  )
}

// Harvester: red with front scoop/claw
function HarvesterBody({ eyeColor }) {
  return (
    <>
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.6, 0.5]} />
        <meshStandardMaterial color="#f87171" roughness={0.3} metalness={0.5}
          emissive="#991b1b" emissiveIntensity={0.15} />
      </mesh>
      {/* Front scoop */}
      <mesh position={[0, -0.15, 0.38]} castShadow>
        <boxGeometry args={[0.65, 0.15, 0.18]} />
        <meshStandardMaterial color="#fca5a5" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Scoop teeth */}
      {[-0.22, 0, 0.22].map((x, i) => (
        <mesh key={i} position={[x, -0.22, 0.48]} castShadow>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
        </mesh>
      ))}
      {/* Status light */}
      <mesh position={[0, 0.22, 0.27]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.5} />
      </mesh>
    </>
  )
}

const MACHINE_BASE_Y = {
  base_drone: 1.6,
  mower:      0.55,
  planter:    1.4,
  harvester:  1.4,
}

const ACTION_EYE_COLOR = {
  idle:       '#93c5fd',
  planting:   '#fbbf24',
  harvesting: '#4ade80',
  moving:     '#a78bfa',
}

function MachineVisual({ machine }) {
  const groupRef = useRef()
  const t = useRef(0)

  useFrame((_, delta) => {
    t.current += delta * 2
    if (!groupRef.current) return
    const tx = machine.col * TILE_SPACING
    const tz = machine.row * TILE_SPACING
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, tx, delta * 6)
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, tz, delta * 6)

    const baseY = MACHINE_BASE_Y[machine.type] ?? 1.4
    const isActive = machine.action === 'planting' || machine.action === 'harvesting'
    const hover = machine.type === 'base_drone'
      ? (isActive ? 1.3 + Math.sin(t.current * 6) * 0.1 : baseY + Math.sin(t.current * 1.5) * 0.06)
      : baseY + (isActive ? Math.sin(t.current * 4) * 0.04 : 0)
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, hover, delta * 8)
  })

  const eyeColor = ACTION_EYE_COLOR[machine.action] ?? '#93c5fd'
  const initY = MACHINE_BASE_Y[machine.type] ?? 1.4

  return (
    <group
      ref={groupRef}
      position={[machine.col * TILE_SPACING, initY, machine.row * TILE_SPACING]}
    >
      {machine.type === 'base_drone' && <BaseDroneBody eyeColor={eyeColor} />}
      {machine.type === 'mower'      && <MowerBody eyeColor={eyeColor} />}
      {machine.type === 'planter'    && <PlanterBody eyeColor={eyeColor} />}
      {machine.type === 'harvester'  && <HarvesterBody eyeColor={eyeColor} />}
    </group>
  )
}

function AllMachines() {
  const machines = useGameStore(s => s.machines)
  return <>{machines.map(m => <MachineVisual key={m.id} machine={m} />)}</>
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export default function GameScene() {
  const clearSelection = useGameStore(s => s.clearSelection)

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff' }}>
      <Canvas
        camera={{ position: [0, 10, 7], fov: 45, near: 0.1, far: 300 }}
        shadows
        gl={{ antialias: true }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={1.2} color="#fff8f0" />
        <directionalLight position={[8, 16, 8]} intensity={2.0} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20} shadow-camera-right={20}
          shadow-camera-top={20} shadow-camera-bottom={-20}
          color="#fffbe8" />
        <hemisphereLight skyColor="#c9e8ff" groundColor="#a0855a" intensity={0.6} />

        <Suspense fallback={null}>
          <AllTiles />
          <AllMachines />
          <AllExpansionArrows />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          enableRotate={false}
          enablePan={true}
          enableZoom={true}
          minDistance={5}
          maxDistance={40}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 4}
          mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 2 }}
        />
      </Canvas>
    </div>
  )
}
