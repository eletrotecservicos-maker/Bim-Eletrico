/**
 * Painel de Configuração da Malha de Aterramento.
 * Geometria, condutores, hastes, materiais.
 */
'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';

const CONDUCTOR_MATERIALS = [
  { label: 'Cobre nu (4/0 AWG)', diameter: 0.0119 },
  { label: 'Cobre nu (2/0 AWG)', diameter: 0.0095 },
  { label: 'Cobre nu (1/0 AWG)', diameter: 0.0085 },
  { label: 'Aço cobreado (3/8")', diameter: 0.0095 },
  { label: 'Alumínio (4/0 AWG)', diameter: 0.0119 },
];

export default function MeshPanel() {
  const { activeScenario, updateMesh } = useProjectStore();
  const mesh = activeScenario?.mesh_data;

  const calculatedValues = useMemo(() => {
    if (!mesh) return null;
    const side = Math.sqrt(mesh.area);
    const nx = Math.max(2, Math.round(side / mesh.spacing_x) + 1);
    const ny = Math.max(2, Math.round(side / mesh.spacing_y) + 1);
    const conductors = (nx - 1) * ny + nx * (ny - 1);
    const totalLength = conductors * ((nx - 1) * mesh.spacing_x / (nx - 1) + (ny - 1) * mesh.spacing_y / (ny - 1));
    const estLength = (nx - 1) * ny * mesh.spacing_x + nx * (ny - 1) * mesh.spacing_y;
    return {
      side: side.toFixed(1),
      nx, ny,
      conductors,
      estLength: estLength.toFixed(1),
    };
  }, [mesh]);

  if (!mesh) {
    return <div className="p-4 text-text-muted text-sm text-center">Selecione um projeto.</div>;
  }

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Geometria principal */}
      <div className="panel-section">
        <p className="panel-section-title">Geometria da Malha</p>
        <div className="space-y-2">
          <FieldRow label="Área total" unit="m²" value={mesh.area}
            onChange={v => updateMesh({ area: v })} min={1} />
          <FieldRow label="Comprimento total (Lt)" unit="m" value={mesh.total_length}
            onChange={v => updateMesh({ total_length: v })} min={1} />
          <FieldRow label="Profundidade de ent." unit="m" value={mesh.depth}
            onChange={v => updateMesh({ depth: v })} min={0.3} max={5} step={0.1} />
        </div>

        {calculatedValues && (
          <div className="mt-2 p-2 bg-background-primary rounded text-[10px] text-text-muted font-mono space-y-0.5">
            <p>Lado ≈ {calculatedValues.side} m × {calculatedValues.side} m</p>
            <p>Colunas: {calculatedValues.nx} × Linhas: {calculatedValues.ny}</p>
            <p>Lt estimado: {calculatedValues.estLength} m</p>
          </div>
        )}
      </div>

      {/* Espaçamento */}
      <div className="panel-section">
        <p className="panel-section-title">Espaçamento entre Condutores</p>
        <div className="space-y-2">
          <FieldRow label="Espaçamento X (Dx)" unit="m" value={mesh.spacing_x}
            onChange={v => updateMesh({ spacing_x: v })} min={0.5} max={50} step={0.5} />
          <FieldRow label="Espaçamento Y (Dy)" unit="m" value={mesh.spacing_y}
            onChange={v => updateMesh({ spacing_y: v })} min={0.5} max={50} step={0.5} />
        </div>
      </div>

      {/* Hastes verticais */}
      <div className="panel-section">
        <p className="panel-section-title">Hastes Verticais (Ground Rods)</p>
        <div className="space-y-2">
          <FieldRow label="Número de hastes (Nr)" unit="un" value={mesh.num_rods}
            onChange={v => updateMesh({ num_rods: Math.round(v) })} min={0} max={200} step={1} />
          <FieldRow label="Comprimento (Lr)" unit="m" value={mesh.rod_length}
            onChange={v => updateMesh({ rod_length: v })} min={0.5} max={30} step={0.5} />
        </div>
      </div>

      {/* Condutor */}
      <div className="panel-section">
        <p className="panel-section-title">Condutor</p>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">Material / Bitola</label>
            <select
              className="input-industrial w-full text-xs"
              value={mesh.conductor_diameter}
              onChange={e => updateMesh({ conductor_diameter: parseFloat(e.target.value) })}
            >
              {CONDUCTOR_MATERIALS.map(m => (
                <option key={m.label} value={m.diameter}>{m.label}</option>
              ))}
            </select>
          </div>
          <FieldRow label="Diâmetro (d)" unit="mm" value={mesh.conductor_diameter * 1000}
            onChange={v => updateMesh({ conductor_diameter: v / 1000 })} min={3} max={50} step={0.1} />
        </div>
      </div>

      {/* Comprimentos efetivos estimados */}
      <div className="p-2 bg-background-primary rounded border border-background-border text-[10px] font-mono text-text-muted space-y-0.5">
        <p className="text-text-secondary font-semibold mb-1">Estimativas (IEEE 80):</p>
        <p>√A = {Math.sqrt(mesh.area).toFixed(2)} m</p>
        <p>Lm ≈ Lt + 1,55·Lr·Nr = {(mesh.total_length + 1.55 * mesh.rod_length * mesh.num_rods).toFixed(1)} m</p>
        <p>Ls ≈ 0,75·Lt + 0,85·Lr·Nr = {(0.75 * mesh.total_length + 0.85 * mesh.rod_length * mesh.num_rods).toFixed(1)} m</p>
      </div>

      <div className="p-2 bg-background-primary rounded border border-background-border text-[10px] text-text-muted">
        <p>Rg = ρ·[1/(4·√A) + 1/Lt·(1+1/(1+h·√(20/A)))]</p>
        <p className="mt-0.5">Norma: IEEE Std 80 - 2013, Eq. 52 (Sverak)</p>
      </div>
    </div>
  );
}

function FieldRow({
  label, unit, value, onChange, min, max, step = 1,
}: {
  label: string; unit: string; value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[10px] text-text-secondary flex-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 input-industrial text-right"
        />
        <span className="text-[10px] text-text-muted font-mono w-12">{unit}</span>
      </div>
    </div>
  );
}
