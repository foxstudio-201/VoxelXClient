import { useRef, useEffect, useState, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Preload cả 2 model
useGLTF.preload('/models/wide.glb')
useGLTF.preload('/models/slim.glb')

// ─── Skin URL — username trước, UUID sau ─────────────────────────────────────

// ─── Player model với skin texture ───────────────────────────────────────────
function PlayerMesh({ modelPath, skinUrl }) {
  const group = useRef()
  const { scene, animations } = useGLTF(modelPath)

  // Clone scene để tránh share state giữa wide/slim
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    // Ẩn hitbox ngay khi clone
    clone.traverse(obj => {
      if (obj.isMesh && obj.name === 'hitbox') obj.visible = false
    })
    return clone
  }, [scene])

  // useAnimations cần ref trỏ đến group chứa clonedScene
  const { actions, names } = useAnimations(animations, group)

  // Play idle animation
  useEffect(() => {
    const idle = actions['idle'] ?? actions[names[0]]
    if (idle) {
      idle.reset().fadeIn(0.2).play()
      return () => { try { idle.stop() } catch {} }
    }
  }, [actions, names])

  // Apply skin texture
  useEffect(() => {
    if (!skinUrl) return
    let cancelled = false

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(skinUrl, (tex) => {
      if (cancelled) return
      tex.magFilter  = THREE.NearestFilter
      tex.minFilter  = THREE.NearestFilter
      tex.flipY      = false
      tex.colorSpace = THREE.SRGBColorSpace

      clonedScene.traverse((obj) => {
        if (obj.isMesh && obj.name !== 'hitbox') {
          obj.material = new THREE.MeshLambertMaterial({
            map: tex, transparent: true, alphaTest: 0.1,
          })
        }
      })
    }, undefined, (err) => console.warn('Skin load failed:', skinUrl, err))

    return () => { cancelled = true }
  }, [skinUrl, clonedScene])

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.4
  })

  return (
    <group ref={group}>
      <primitive object={clonedScene} scale={0.85} position={[0, -1.15, 0]} />
    </group>
  )
}

// ─── Wrapper xử lý fallback skin URL ─────────────────────────────────────────
const FALLBACK_URLS = (uuid, username) => [
  username ? `https://minotar.net/skin/${username}`   : null,
  username ? `https://crafthead.net/skin/${username}` : null,
  uuid     ? `https://crafthead.net/skin/${uuid}`     : null,
  uuid     ? `https://minotar.net/skin/${uuid}`       : null,
].filter(Boolean)

function PlayerWithFallback({ uuid, username, modelPath }) {
  const urls = useMemo(() => FALLBACK_URLS(uuid, username), [uuid, username])
  const [idx, setIdx] = useState(0)

  useEffect(() => { setIdx(0) }, [uuid, username])

  const skinUrl = urls[idx] ?? null

  return (
    <PlayerMesh
      key={`${modelPath}-${idx}`}
      modelPath={modelPath}
      skinUrl={skinUrl}
    />
  )
}

// ─── Loading placeholder ──────────────────────────────────────────────────────
function LoadingBox() {
  const ref = useRef()
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 1.2 })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshLambertMaterial color="#1a3a1a" wireframe />
    </mesh>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PlayerModel3D({ uuid, username, slim = false, className = '' }) {
  const modelPath = slim ? '/models/slim.glb' : '/models/wide.glb'

  return (
    <div className={`w-full h-full ${className}`} style={{ minWidth: 0, minHeight: 0 }}>
      <Canvas
        camera={{ position: [0, 0.5, 7.5], fov: 26 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 3]}  intensity={1.1} castShadow />
        <directionalLight position={[-2, 2, -2]} intensity={0.3} />

        <Suspense fallback={<LoadingBox />}>
          <PlayerWithFallback
            key={modelPath}
            uuid={uuid}
            username={username}
            modelPath={modelPath}
          />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.6}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}
