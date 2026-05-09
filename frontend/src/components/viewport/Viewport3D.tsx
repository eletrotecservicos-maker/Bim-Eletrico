/**
 * Viewport 3D — Visualizador Three.js / React Three Fiber.
 * Exibe a malha de aterramento em 3D com controles de câmera CAD-like.
 *
 * Elementos renderizados:
 *   - Grid de solo
 *   - Condutores horizontais (cilindros)
 *   - Hastes verticais (cilindros finos)
 *   - Camada de solo semi-transparente
 *   - Eixos de referência
 *   - Labels de medidas
 */
'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import ViewportControls from './ViewportControls';

export default function Viewport3D() {
  const { showGrid, showAxes, showSoilLayer, cameraPreset } = useUiStore();

  // Posições de câmera por preset
  const cameraPositions = {
    perspective: [40, 30, 40] as [number, number, number],
    top:         [0, 60, 0.001] as [number, number, number],
    front:       [0, 10, 60] as [number, number, number],
    side:        [60, 10, 0] as [number, number, number],
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: cameraPositions[cameraPreset], fov: 45, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0A0E1A' }}
      >
        <Suspense fallback={null}>
          {/* Iluminação técnica */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[50, 80, 50]} intensity={0.8} castShadow />
          <pointLight position={[-30, 40, -30]} intensity={0.3} color="#1565C0" />

          {/* Grid de referência */}
          {showGrid && (
            <Grid
              args={[200, 200]}
              cellSize={5}
              cellThickness={0.5}
              cellColor="#1E2D45"
              sectionSize={25}
              sectionThickness={1}
              sectionColor="#1565C0"
              fadeDistance={150}
              fadeStrength={1}
              followCamera={false}
              position={[0, -0.01, 0]}
            />
          )}

          {/* Eixos */}
          {showAxes && <AxesHelper />}

          {/* Malha de aterramento */}
          <GroundingMesh />

          {/* Camada de solo */}
          {showSoilLayer && <SoilLayer />}

          {/* Controles de órbita */}
          <OrbitControls
            makeDefault
            dampingFactor={0.05}
            enableDamping
            minDistance={5}
            maxDistance={500}
            screenSpacePanning
          />
        </Suspense>
      </Canvas>

      {/* Controles de viewport sobrepostos */}
      <ViewportControls />

      {/* Legenda de câmera */}
      <div className="absolute bottom-8 left-3 text-[10px] font-mono text-text-muted space-y-0.5">
        <div className="flex items-center gap-1.5"><div className="w-3 h-px bg-red-500" /> X (E-W)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-px bg-green-500" /> Y (vertical)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-px bg-blue-500" /> Z (N-S)</div>
      </div>
    </div>
  );
}

function GroundingMesh() {
  const { activeScenario, calculationResult } = useProjectStore();
  if (!activeScenario?.mesh_data) return null;

  const mesh = activeScenario.mesh_data;
  const safe = calculationResult?.safe;

  // Cor dos condutores baseada na segurança
  const conductorColor = safe === undefined
    ? '#42A5F5'
    : safe ? '#4CAF50' : '#F44336';

  // Gerar malha reticulada automaticamente se não houver condutores explícitos
  const conductors = useMemo(() => {
    if (mesh.conductors && mesh.conductors.length > 0) return mesh.conductors;

    const side = Math.sqrt(mesh.area);
    const nx = Math.max(2, Math.round(side / mesh.spacing_x) + 1);
    const ny = Math.max(2, Math.round(side / mesh.spacing_y) + 1);
    const result = [];

    // Condutores horizontais (X)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        result.push({
          x1: i * mesh.spacing_x - side / 2,
          y1: j * mesh.spacing_y - side / 2,
          x2: (i + 1) * mesh.spacing_x - side / 2,
          y2: j * mesh.spacing_y - side / 2,
        });
      }
    }
    // Condutores verticais (Y)
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        result.push({
          x1: i * mesh.spacing_x - side / 2,
          y1: j * mesh.spacing_y - side / 2,
          x2: i * mesh.spacing_x - side / 2,
          y2: (j + 1) * mesh.spacing_y - side / 2,
        });
      }
    }
    return result;
  }, [mesh]);

  // Hastes verticais
  const rods = useMemo(() => {
    if (mesh.rods_positions && mesh.rods_positions.length > 0) return mesh.rods_positions;
    if (mesh.num_rods === 0) return [];

    const side = Math.sqrt(mesh.area);
    const nx = Math.max(2, Math.round(side / mesh.spacing_x) + 1);
    const ny = Math.max(2, Math.round(side / mesh.spacing_y) + 1);

    // Colocar hastes nos cantos e bordas
    const rodPositions = [];
    const step = Math.max(1, Math.floor((nx * ny) / mesh.num_rods));
    let count = 0;

    for (let j = 0; j < ny && count < mesh.num_rods; j += Math.max(1, Math.floor(ny / Math.sqrt(mesh.num_rods)))) {
      for (let i = 0; i < nx && count < mesh.num_rods; i += Math.max(1, Math.floor(nx / Math.sqrt(mesh.num_rods)))) {
        rodPositions.push({
          x: i * mesh.spacing_x - side / 2,
          y: j * mesh.spacing_y - side / 2,
        });
        count++;
      }
    }
    return rodPositions;
  }, [mesh]);

  const depth = mesh.depth;
  const rodLen = mesh.rod_length;

  return (
    <group position={[0, -depth, 0]}>
      {/* Condutores horizontais */}
      {conductors.map((c, i) => (
        <ConductorSegment
          key={i}
          x1={c.x1} z1={c.y1}
          x2={c.x2} z2={c.y2}
          color={conductorColor}
          diameter={mesh.conductor_diameter * 5 || 0.05}
        />
      ))}

      {/* Hastes verticais */}
      {rods.map((r, i) => (
        <mesh key={`rod-${i}`} position={[r.x, -rodLen / 2, r.y]}>
          <cylinderGeometry args={[0.04, 0.04, rodLen, 8]} />
          <meshStandardMaterial color="#FFB300" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Nós (junções) */}
      {rods.slice(0, 50).map((r, i) => (
        <mesh key={`node-${i}`} position={[r.x, 0, r.y]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#FFB300" metalness={0.9} roughness={0.1} emissive="#FFB300" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function ConductorSegment({ x1, z1, x2, z2, color, diameter }: {
  x1: number; z1: number; x2: number; z2: number;
  color: string; diameter: number;
}) {
  const start = new THREE.Vector3(x1, 0, z1);
  const end = new THREE.Vector3(x2, 0, z2);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[diameter / 2, diameter / 2, length, 6]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.15} />
    </mesh>
  );
}

function SoilLayer() {
  const { activeScenario } = useProjectStore();
  const area = activeScenario?.mesh_data?.area || 2500;
  const side = Math.sqrt(area) + 10;
  const depth = activeScenario?.mesh_data?.depth || 0.5;

  return (
    <mesh position={[0, -depth / 2 - 0.5, 0]} receiveShadow>
      <boxGeometry args={[side * 1.5, 1, side * 1.5]} />
      <meshStandardMaterial
        color="#3E2723"
        transparent
        opacity={0.35}
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

function AxesHelper() {
  const len = 15;
  return (
    <group>
      {/* X = vermelho */}
      <Line points={[[0,0,0],[len,0,0]]} color="#F44336" lineWidth={1.5} />
      {/* Y = verde */}
      <Line points={[[0,0,0],[0,len,0]]} color="#4CAF50" lineWidth={1.5} />
      {/* Z = azul */}
      <Line points={[[0,0,0],[0,0,len]]} color="#2196F3" lineWidth={1.5} />
      <Text position={[len+1,0,0]} fontSize={0.8} color="#F44336">X</Text>
      <Text position={[0,len+1,0]} fontSize={0.8} color="#4CAF50">Y</Text>
      <Text position={[0,0,len+1]} fontSize={0.8} color="#2196F3">Z</Text>
    </group>
  );
}
