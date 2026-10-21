import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbState } from './ErfanWorld';

const FALLBACK_PARTICLES = Array.from({ length: 220 }, (_, index) => {
  const angle = index * 2.399963229728653;
  const radius = 5 + Math.sqrt((index + 0.5) / 220) * 48;
  return {
    cx: 70 + Math.cos(angle) * radius,
    cy: 70 + Math.sin(angle) * radius,
    r: index % 13 === 0 ? 1.65 : index % 4 === 0 ? 1.05 : 0.7,
    opacity: 0.28 + ((index * 17) % 66) / 100,
  };
});

class RendererErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StaticParticleCore({ state }: { state: OrbState }) {
  return (
    <svg
      className={`core-particle-fallback state-${state}`}
      viewBox="0 0 140 140"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="core-glow">
          <stop offset="0" stopColor="#00e5ff" stopOpacity=".38" />
          <stop offset=".55" stopColor="#00b9dc" stopOpacity=".12" />
          <stop offset="1" stopColor="#00b9dc" stopOpacity="0" />
        </radialGradient>
        <filter id="core-particle-blur">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      <circle cx="70" cy="70" r="52" fill="url(#core-glow)" />
      <g className="core-fallback-halo" filter="url(#core-particle-blur)">
        {FALLBACK_PARTICLES.map((particle, index) => (
          <circle
            key={index}
            cx={particle.cx}
            cy={particle.cy}
            r={particle.r}
            fill="#00e5ff"
            opacity={particle.opacity}
          />
        ))}
      </g>
      <g className="core-fallback-dots">
        {FALLBACK_PARTICLES.map((particle, index) => (
          <circle
            key={index}
            cx={particle.cx}
            cy={particle.cy}
            r={particle.r * 0.68}
            fill="#aaf8ff"
            opacity={particle.opacity}
          />
        ))}
      </g>
      <circle cx="70" cy="70" r="2.4" fill="#d7fdff" />
    </svg>
  );
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function Particles({ state }: { state: OrbState }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1200;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = .12 + Math.pow(Math.random(), .62) * .78;
      array[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      array[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
      array[i * 3 + 2] = Math.cos(phi) * radius;
    }
    return array;
  }, []);
  const phases = useMemo(() => Float32Array.from({ length: 1200 }, () => Math.random() * Math.PI * 2), []);
  const group = useRef<THREE.Group>(null);
  const orbitRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }, delta) => {
    if (!points.current || !group.current) return;
    const time = clock.elapsedTime;
    const targetScale = state === 'idle' ? .68 : state === 'speaking' ? 1.05 : .94;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), .045);
    group.current.rotation.y += delta * (state === 'idle' ? .07 : .22);
    orbitRefs.current.forEach((orbit, index) => {
      if (orbit) orbit.rotation.y += delta * [.55, -.4, .3][index];
    });
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const src = positions;
    for (let i = 0; i < phases.length; i++) {
      const offset = i * 3;
      const magnitude = state === 'idle' ? .018 : state === 'speaking' ? .08 : .055;
      const wobble = Math.sin(time * (1.05 + (i % 8) * .08) + phases[i]) * magnitude;
      attr.array[offset] = src[offset] * (1 + wobble);
      attr.array[offset + 1] = src[offset + 1] * (1 + wobble);
      attr.array[offset + 2] = src[offset + 2] * (1 + wobble);
    }
    attr.needsUpdate = true;
  });
  return (
    <group ref={group} rotation={[.3, 0, 0]}>
      <points ref={points}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial color="#00e5ff" size={state === 'idle' ? .026 : .021} transparent opacity={.94} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {[{ r: .77, tilt: [.5, .2, 0] }, { r: 1.02, tilt: [-.6, .5, .3] }, { r: 1.28, tilt: [.3, -.5, .6] }].map((ring, index) => (
        <group key={ring.r} ref={(el) => { orbitRefs.current[index] = el; }} rotation={ring.tilt as [number, number, number]}>
          <mesh>
            <torusGeometry args={[ring.r, .009, 8, 120]} />
            <meshBasicMaterial color="#f5a623" transparent opacity={.52} />
          </mesh>
          <mesh position={[ring.r, 0, 0]}>
            <sphereGeometry args={[.035, 12, 12]} />
            <meshBasicMaterial color="#c8f7ff" />
          </mesh>
        </group>
      ))}
      <mesh rotation={[.5, 0, 0]}>
        <torusGeometry args={[.78, .018, 8, 80]} />
        <meshBasicMaterial color="#ffb733" transparent opacity={.8} />
      </mesh>
      <mesh position={[.77, 0, 0]}>
        <sphereGeometry args={[.045, 12, 12]} />
        <meshBasicMaterial color="#c8f7ff" />
      </mesh>
    </group>
  );
}

export default function OrbParticleCore({ state, reducedMotion }: { state: OrbState; reducedMotion: boolean }) {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setWebglSupported(supportsWebGL());
  }, []);

  if (reducedMotion) return null;
  if (webglSupported !== true) return <StaticParticleCore state={state} />;
  return (
    <RendererErrorBoundary fallback={<StaticParticleCore state={state} />}>
      <Canvas
        camera={{ position: [0, 0, 4.8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        fallback={<StaticParticleCore state={state} />}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}
      >
        <Particles state={state} />
        <EffectComposer><Bloom intensity={1.8} luminanceThreshold={.15} luminanceSmoothing={.9} mipmapBlur radius={.62} /></EffectComposer>
      </Canvas>
    </RendererErrorBoundary>
  );
}
