/**
 * Barra de status inferior — exibe informações técnicas em tempo real.
 * Estilo SCADA industrial.
 */
'use client';

import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';

export default function StatusBar() {
  const { activeProject, activeScenario, calculationResult, isCalculating } = useProjectStore();
  const { viewMode } = useUiStore();

  return (
    <footer className="h-6 flex items-center border-t border-background-border bg-background-secondary px-3 gap-4 text-[10px] font-mono text-text-muted flex-shrink-0">
      {/* Status do sistema */}
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isCalculating ? 'bg-accent-cyan animate-pulse' : 'bg-status-safe'}`} />
        <span>{isCalculating ? 'CALCULANDO...' : 'PRONTO'}</span>
      </div>

      <div className="w-px h-3 bg-background-border" />

      {/* Projeto ativo */}
      {activeProject ? (
        <span>PROJ: <span className="text-text-secondary">{activeProject.name}</span></span>
      ) : (
        <span className="text-text-muted">Sem projeto ativo</span>
      )}

      {activeScenario && (
        <>
          <div className="w-px h-3 bg-background-border" />
          <span>CEN: <span className="text-text-secondary">{activeScenario.name}</span></span>
        </>
      )}

      {/* Parâmetros do cenário */}
      {activeScenario?.soil_data && (
        <>
          <div className="w-px h-3 bg-background-border" />
          <span>ρ={activeScenario.soil_data.rho} Ω·m</span>
        </>
      )}
      {activeScenario?.mesh_data && (
        <>
          <span>A={activeScenario.mesh_data.area} m²</span>
          <span>h={activeScenario.mesh_data.depth} m</span>
        </>
      )}

      {/* Resultados rápidos */}
      {calculationResult && (
        <>
          <div className="w-px h-3 bg-background-border" />
          <span className="text-text-secondary">Rg={calculationResult.Rg.toFixed(3)}Ω</span>
          <span className="text-text-secondary">GPR={calculationResult.GPR.toFixed(1)}V</span>
          <span className="text-text-secondary">Em={calculationResult.Em.toFixed(1)}V</span>
          <span className={calculationResult.safe ? 'text-status-safe-light font-semibold' : 'text-status-danger-light font-semibold'}>
            {calculationResult.safe ? '✓ APROVADO' : '✗ REPROVADO'} (IEEE 80)
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Info técnica */}
      <span className="text-text-muted">IEEE Std 80 · ABNT NBR 15751</span>
      <div className="w-px h-3 bg-background-border" />
      <span className="text-text-muted">MODO: {viewMode.toUpperCase()}</span>
      <div className="w-px h-3 bg-background-border" />
      <span className="text-text-muted">v1.0.0</span>
    </footer>
  );
}
