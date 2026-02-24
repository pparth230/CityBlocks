import React, { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore, CROP_STAGES } from '../game/store'

const TILE_SPACING = 2.5

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
function FarmTile({ tile }) {
  const color = STAGE_COLORS[tile.stage] ?? STAGE_COLORS[CROP_STAGES.EMPTY]
  const x = tile.col * TILE_SPACING
  const z = tile.row * TILE_SPACING
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[2.4, 0.22, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Rim with thin border acting as divider */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[2.5, 0.03, 2.5]} />
        <meshStandardMaterial color="#c8b89a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[2.42, 0.03, 2.42]} />
        <meshStandardMaterial color="#5a3e2b" roughness={1} />
      </mesh>
      <CropVisual stage={tile.stage} />
    </group>
  )
}

function AllTiles() {
  const tiles = useGameStore(s => s.tiles)
  return <>{tiles.map(tile => <FarmTile key={tile.id} tile={tile} />)}</>
}

// ─── Drone ────────────────────────────────────────────────────────────────────
function Drone() {
  const drone    = useGameStore(s => s.drone)
  const groupRef = useRef()
  const t        = useRef(0)

  useFrame((_, delta) => {
    t.current += delta * 2
    if (!groupRef.current) return
    const tx = drone.col * TILE_SPACING
    const tz = drone.row * TILE_SPACING
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, tx, delta * 6)
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, tz, delta * 6)
    const hover = Math.sin(t.current * 1.5) * 0.06
    const baseY = drone.action === 'planting' || drone.action === 'harvesting'
      ? 1.3 + Math.sin(t.current * 6) * 0.1
      : 1.6 + hover
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, baseY, delta * 8)
  })

  const eyeColor = drone.action === 'harvesting' ? '#4ade80'
                 : drone.action === 'planting'   ? '#fbbf24'
                 : '#93c5fd'

  return (
    <group ref={groupRef} position={[0, 1.6, 0]}>
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
    </group>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export default function GameScene() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff' }}>
      <Canvas
        camera={{ position: [0, 10, 7], fov: 45, near: 0.1, far: 300 }}
        shadows
        gl={{ antialias: true }}
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
          <Drone />
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
