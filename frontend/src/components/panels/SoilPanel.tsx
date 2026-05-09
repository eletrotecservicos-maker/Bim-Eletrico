/**
 * Painel de Configuração do Solo.
 * Resistividade, modelo (homogêneo / 2 camadas), ensaios de campo.
 */
'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { calculationsApi } from '@/lib/api';
import type { SoilAnalysisResult } from '@/lib/types';

export default function SoilPanel() {
  const { activeScenario, updateSoil } = useProjectStore();
  const soil = activeScenario?.soil_data;
  const [analysisResult, setAnalysisResult] = useState<SoilAnalysisResult | null>(null);
  const [wennerRows, setWennerRows] = useState([
    { spacing: 1, resistance: 30 },
    { spacing: 2, resistance: 22 },
    { spacing: 4, resistance: 18 },
    { spacing: 8, resistance: 15 },
    { spacing: 16, resistance: 14 },
  ]);
  const [analyzing, setAnalyzing] = useState(false);

  if (!soil) {
    return (
      <div className="p-4 text-text-muted text-sm text-center">Selecione um projeto.</div>
    );
  }

  const handleAnalyzeWenner = async () => {
    setAnalyzing(true);
    try {
      const result = await calculationsApi.analyzeWenner(wennerRows);
      setAnalysisResult(result);
      if (result.model?.rho1) {
        updateSoil({ rho: result.rho_equivalent });
      }
    } catch {
      /* erros tratados no toast */
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      <div className="panel-section">
        <p className="panel-section-title">Modelo de Solo</p>
        <div className="grid grid-cols-2 gap-2">
          {['homogeneous', 'two_layer'].map(t => (
            <button
              key={t}
              onClick={() => updateSoil({ model_type: t as 'homogeneous' | 'two_layer' })}
              className={`py-1.5 px-2 rounded text-xs border transition-colors ${
                soil.model_type === t
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue-light'
                  : 'border-background-border text-text-muted hover:border-accent-blue/50'
              }`}
            >
              {t === 'homogeneous' ? 'Homogêneo' : '2 Camadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Parâmetros principais */}
      <div className="panel-section">
        <p className="panel-section-title">Resistividades</p>
        <div className="space-y-2">
          <FieldRow
            label="ρ solo nativo"
            unit="Ω·m"
            value={soil.rho}
            onChange={v => updateSoil({ rho: v })}
            min={1} max={100000}
          />
          <FieldRow
            label="ρ camada superficial"
            unit="Ω·m"
            value={soil.rho_surface}
            onChange={v => updateSoil({ rho_surface: v })}
            min={1} max={100000}
            tooltip="Ex: brita = 3000 Ω·m"
          />
          <FieldRow
            label="Espessura superficial"
            unit="m"
            value={soil.depth_surface}
            onChange={v => updateSoil({ depth_surface: v })}
            min={0.01} max={1} step={0.01}
          />
        </div>
      </div>

      {/* Solo 2 camadas */}
      {soil.model_type === 'two_layer' && (
        <div className="panel-section">
          <p className="panel-section-title">2ª Camada (Sunde)</p>
          <div className="space-y-2">
            <FieldRow
              label="ρ camada 2"
              unit="Ω·m"
              value={soil.rho2 ?? 500}
              onChange={v => updateSoil({ rho2: v })}
              min={1} max={100000}
            />
            <FieldRow
              label="Espessura camada 1"
              unit="m"
              value={soil.h1 ?? 2}
              onChange={v => updateSoil({ h1: v })}
              min={0.1} max={50}
            />
          </div>

          {/* Coeficiente de reflexão */}
          {soil.rho && soil.rho2 && (
            <div className="mt-2 p-2 bg-background-primary rounded">
              <p className="text-[10px] text-text-muted">
                k = (ρ₂-ρ₁)/(ρ₂+ρ₁) = <span className="font-mono text-accent-blue-light">
                  {((soil.rho2 - soil.rho) / (soil.rho2 + soil.rho)).toFixed(3)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ensaio de Wenner */}
      <div className="panel-section">
        <p className="panel-section-title">Ensaio Wenner (opcional)</p>
        <p className="text-[10px] text-text-muted mb-2">ρa = 2π·a·R</p>

        <div className="border border-background-border rounded overflow-hidden mb-2">
          <div className="grid grid-cols-3 gap-0 bg-background-primary px-2 py-1">
            <span className="text-[10px] text-text-muted">a (m)</span>
            <span className="text-[10px] text-text-muted">R (Ω)</span>
            <span className="text-[10px] text-text-muted">ρa (Ω·m)</span>
          </div>
          {wennerRows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-0 border-t border-background-border">
              <input
                type="number"
                value={row.spacing}
                onChange={e => {
                  const rows = [...wennerRows];
                  rows[i] = { ...rows[i], spacing: parseFloat(e.target.value) || 0 };
                  setWennerRows(rows);
                }}
                className="px-2 py-1 text-xs font-mono bg-transparent text-text-secondary border-r border-background-border focus:outline-none focus:bg-background-surface"
              />
              <input
                type="number"
                value={row.resistance}
                onChange={e => {
                  const rows = [...wennerRows];
                  rows[i] = { ...rows[i], resistance: parseFloat(e.target.value) || 0 };
                  setWennerRows(rows);
                }}
                className="px-2 py-1 text-xs font-mono bg-transparent text-text-secondary border-r border-background-border focus:outline-none focus:bg-background-surface"
              />
              <span className="px-2 py-1 text-xs font-mono text-accent-blue-light">
                {(2 * Math.PI * row.spacing * row.resistance).toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setWennerRows([...wennerRows, { spacing: 0, resistance: 0 }])}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            + Linha
          </button>
          <button
            onClick={handleAnalyzeWenner}
            disabled={analyzing}
            className="flex-1 btn-secondary text-xs py-1"
          >
            {analyzing ? 'Analisando...' : 'Analisar e Ajustar Modelo'}
          </button>
        </div>

        {analysisResult && (
          <div className="mt-2 p-2 bg-background-primary rounded border border-accent-blue/20 space-y-1">
            <p className="text-[10px] text-text-muted font-semibold">Resultado do Ajuste (2 Camadas):</p>
            <p className="text-[10px] font-mono text-text-secondary">ρ₁ = {analysisResult.model.rho1.toFixed(1)} Ω·m</p>
            <p className="text-[10px] font-mono text-text-secondary">ρ₂ = {analysisResult.model.rho2.toFixed(1)} Ω·m</p>
            <p className="text-[10px] font-mono text-text-secondary">h₁ = {analysisResult.model.h1.toFixed(2)} m</p>
            <p className="text-[10px] font-mono text-accent-blue-light">ρ equiv. = {analysisResult.rho_equivalent.toFixed(1)} Ω·m</p>
          </div>
        )}
      </div>

      {/* Info técnica */}
      <div className="p-2 bg-background-primary rounded border border-background-border text-[10px] text-text-muted space-y-0.5">
        <p>Norma: IEEE 80 / ABNT NBR 15751</p>
        <p>Modelo: {soil.model_type === 'two_layer' ? 'Sunde (2 camadas)' : 'Solo homogêneo'}</p>
        <p>Cs = 1 - 0,09·(1-ρ/ρs)/(2hs+0,09)</p>
      </div>
    </div>
  );
}

function FieldRow({
  label, unit, value, onChange, min, max, step = 1, tooltip,
}: {
  label: string; unit: string; value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number; tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[10px] text-text-secondary flex-1" title={tooltip}>
        {label}
        {tooltip && <span className="ml-1 text-text-muted">ⓘ</span>}
      </label>
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
