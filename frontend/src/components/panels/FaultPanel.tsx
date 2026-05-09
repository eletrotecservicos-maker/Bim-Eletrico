/**
 * Painel de Condições de Falta.
 * Corrente de falta, duração, fatores de decremento e divisão.
 */
'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';

const FAULT_PRESETS = [
  { label: 'Subestação 138 kV', fault_current: 20000, fault_duration: 0.5, division_factor: 0.6 },
  { label: 'Subestação 69 kV', fault_current: 10000, fault_duration: 0.5, division_factor: 0.6 },
  { label: 'Subestação 13,8 kV', fault_current: 5000, fault_duration: 0.5, division_factor: 0.7 },
  { label: 'Industrial (média tensão)', fault_current: 3000, fault_duration: 1.0, division_factor: 0.8 },
  { label: 'BT / SPDA', fault_current: 1000, fault_duration: 0.2, division_factor: 1.0 },
];

export default function FaultPanel() {
  const { activeScenario, updateFault } = useProjectStore();
  const fault = activeScenario?.fault_data;
  const soil = activeScenario?.soil_data;
  const mesh = activeScenario?.mesh_data;

  const estimates = useMemo(() => {
    if (!fault || !soil || !mesh) return null;
    const Ig = fault.fault_current * fault.division_factor * fault.decrement_factor;
    const Ib50 = 0.116 / Math.sqrt(fault.fault_duration);
    const Ib70 = 0.157 / Math.sqrt(fault.fault_duration);
    const A = mesh.area;
    const Lt = mesh.total_length + mesh.num_rods * mesh.rod_length;
    const h = mesh.depth;
    const Rg_est = soil.rho * (1 / (4 * Math.sqrt(A)) + (1 / Lt) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));
    const GPR_est = Ig * Rg_est;
    return { Ig: Ig.toFixed(0), Rg: Rg_est.toFixed(3), GPR: GPR_est.toFixed(0), Ib50: (Ib50 * 1000).toFixed(1), Ib70: (Ib70 * 1000).toFixed(1) };
  }, [fault, soil, mesh]);

  if (!fault) return <div className="p-4 text-text-muted text-sm text-center">Selecione um projeto.</div>;

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Presets */}
      <div className="panel-section">
        <p className="panel-section-title">Presets de Instalação</p>
        <div className="space-y-1">
          {FAULT_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => updateFault(preset)}
              className="w-full text-left px-2 py-1.5 rounded text-[10px] text-text-muted hover:bg-background-surface hover:text-text-primary transition-colors border border-transparent hover:border-background-border"
            >
              {preset.label}
              <span className="ml-2 text-text-muted font-mono">{preset.fault_current.toLocaleString()} A</span>
            </button>
          ))}
        </div>
      </div>

      {/* Parâmetros */}
      <div className="panel-section">
        <p className="panel-section-title">Corrente de Falta</p>
        <div className="space-y-2">
          <FieldRow label="Corrente simétrica (If)" unit="A" value={fault.fault_current}
            onChange={v => updateFault({ fault_current: v })} min={1} max={100000} step={100} />
          <FieldRow label="Duração da falta (tf)" unit="s" value={fault.fault_duration}
            onChange={v => updateFault({ fault_duration: v })} min={0.05} max={5} step={0.05} />
        </div>
      </div>

      <div className="panel-section">
        <p className="panel-section-title">Fatores de Correção</p>
        <div className="space-y-2">
          <FieldRow label="Fator de divisão (Sf)" unit="" value={fault.division_factor}
            onChange={v => updateFault({ division_factor: v })} min={0.1} max={1} step={0.05} />
          <FieldRow label="Fator de decremento (Df)" unit="" value={fault.decrement_factor}
            onChange={v => updateFault({ decrement_factor: v })} min={1} max={1.3} step={0.01} />
        </div>
        <div className="mt-2 p-2 bg-background-primary rounded text-[10px] text-text-muted space-y-0.5">
          <p>Sf: fração da corrente que flui pela malha (0,5–0,8 típico)</p>
          <p>Df: fator assimetria — IEEE 80 Tabela 10 (1,0–1,15)</p>
        </div>
      </div>

      {/* Estimativas calculadas */}
      {estimates && (
        <div className="panel-section">
          <p className="panel-section-title">Estimativas Rápidas</p>
          <div className="space-y-1.5">
            <EstimateRow label="Ig = If·Sf·Df" value={`${estimates.Ig} A`} />
            <EstimateRow label="Rg (Sverak)" value={`${estimates.Rg} Ω`} />
            <EstimateRow label="GPR = Ig·Rg" value={`${estimates.GPR} V`} accent />
            <div className="border-t border-background-border pt-1.5 mt-1">
              <EstimateRow label="Ib (50 kg, IEEE 80)" value={`${estimates.Ib50} mA`} />
              <EstimateRow label="Ib (70 kg, IEEE 80)" value={`${estimates.Ib70} mA`} />
            </div>
          </div>
          <p className="text-[10px] text-text-muted mt-2">Ib = 0,116/√tf (50 kg) · 0,157/√tf (70 kg)</p>
        </div>
      )}

      <div className="p-2 bg-background-primary rounded border border-background-border text-[10px] text-text-muted">
        <p>Ig = If · Sf · Df</p>
        <p>GPR = Ig · Rg</p>
        <p>Norma: IEEE Std 80 - 2013, Seção 15</p>
      </div>
    </div>
  );
}

function FieldRow({ label, unit, value, onChange, min, max, step = 1 }: {
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
          min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 input-industrial text-right"
        />
        <span className="text-[10px] text-text-muted font-mono w-8">{unit}</span>
      </div>
    </div>
  );
}

function EstimateRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center text-[10px] font-mono">
      <span className="text-text-muted">{label}</span>
      <span className={accent ? 'text-accent-blue-light font-semibold' : 'text-text-secondary'}>{value}</span>
    </div>
  );
}
