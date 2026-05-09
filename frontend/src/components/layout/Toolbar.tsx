/**
 * Toolbar — Barra de ferramentas superior estilo ETAP/Navisworks.
 * Controles de visualização, cálculo, exportação.
 */
'use client';

import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import type { ViewMode, ActivePanel } from '@/lib/types';

export default function Toolbar() {
  const { activeProject, activeScenario, isCalculating, runCalculation, calculationResult } = useProjectStore();
  const {
    viewMode, setViewMode, activePanel, setActivePanel,
    toggleLeftSidebar, leftSidebarOpen, rightPanelOpen, toggleRightPanel,
    setNewProjectModalOpen,
  } = useUiStore();

  const viewModes: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: '3d', label: '3D', icon: <Icon3D /> },
    { key: 'heatmap', label: 'Potencial', icon: <IconHeatmap /> },
    { key: 'step', label: 'Tensão Passo', icon: <IconStep /> },
  ];

  const panels: { key: ActivePanel; label: string }[] = [
    { key: 'soil', label: 'Solo' },
    { key: 'mesh', label: 'Malha' },
    { key: 'fault', label: 'Falta' },
    { key: 'results', label: 'Resultados' },
  ];

  return (
    <header className="h-11 flex items-center border-b border-background-border bg-background-secondary px-3 gap-1 flex-shrink-0">
      {/* Logo / App name */}
      <div className="flex items-center gap-2 mr-4 flex-shrink-0">
        <div className="w-6 h-6 rounded bg-accent-blue flex items-center justify-center">
          <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
            <polygon points="8,1 15,5 15,11 8,15 1,11 1,5" stroke="white" strokeWidth="0.5" fill="none"/>
            <polygon points="8,4 12,6.5 12,9.5 8,12 4,9.5 4,6.5" fill="rgba(255,255,255,0.3)"/>
          </svg>
        </div>
        <span className="text-xs font-semibold text-text-primary hidden xl:block">BIM Elétrico</span>
      </div>

      {/* Separador */}
      <div className="w-px h-6 bg-background-border mx-1" />

      {/* Sidebar toggle */}
      <ToolbarButton onClick={toggleLeftSidebar} active={leftSidebarOpen} title="Painel de Projetos">
        <IconSidebar />
      </ToolbarButton>

      {/* Novo projeto */}
      <ToolbarButton onClick={() => setNewProjectModalOpen(true)} title="Novo Projeto">
        <IconPlus />
      </ToolbarButton>

      <div className="w-px h-6 bg-background-border mx-1" />

      {/* Modos de visualização */}
      <div className="flex items-center gap-0.5 bg-background-primary rounded p-0.5">
        {viewModes.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            disabled={!activeProject}
            title={`Visualização: ${label}`}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${viewMode === key
                ? 'bg-accent-blue text-white shadow-glow-blue'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-surface'
              }
            `}
          >
            <span className="w-3.5 h-3.5">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-background-border mx-1" />

      {/* Módulos / painéis */}
      {activeProject && (
        <div className="flex items-center gap-0.5">
          {panels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActivePanel(key); if (!rightPanelOpen) toggleRightPanel(); }}
              className={`
                px-3 py-1 rounded text-xs font-medium transition-colors
                ${activePanel === key
                  ? 'bg-background-surface text-accent-blue-light border border-accent-blue/40'
                  : 'text-text-secondary hover:text-text-primary'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Projeto ativo */}
      {activeProject && (
        <div className="flex items-center gap-2 mr-3">
          <span className="text-xs text-text-muted">Projeto:</span>
          <span className="text-xs font-medium text-text-primary max-w-48 truncate">{activeProject.name}</span>
          {activeScenario && (
            <>
              <span className="text-xs text-text-muted">/</span>
              <span className="text-xs text-text-secondary">{activeScenario.name}</span>
            </>
          )}
        </div>
      )}

      {/* Resultado rápido */}
      {calculationResult && (
        <div className="flex items-center gap-2 mr-3">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono ${
            calculationResult.safe
              ? 'bg-status-safe/20 text-status-safe-light border border-status-safe/30'
              : 'bg-status-danger/20 text-status-danger-light border border-status-danger/30'
          }`}>
            {calculationResult.safe ? '✓ APROVADO' : '✗ REPROVADO'}
            <span className="text-text-muted ml-1">Rg={calculationResult.Rg.toFixed(2)}Ω</span>
          </div>
        </div>
      )}

      {/* Botão CALCULAR */}
      <button
        onClick={runCalculation}
        disabled={!activeProject || isCalculating}
        className={`
          flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold
          transition-all disabled:opacity-50 disabled:cursor-not-allowed
          ${isCalculating
            ? 'bg-accent-blue/60 text-white calculating'
            : 'bg-accent-blue hover:bg-accent-blue-bright text-white shadow-glow-blue'
          }
        `}
      >
        {isCalculating ? (
          <>
            <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
            Calculando...
          </>
        ) : (
          <>
            <IconPlay />
            Calcular
          </>
        )}
      </button>
    </header>
  );
}

function ToolbarButton({ children, onClick, active, title }: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        p-1.5 rounded transition-colors
        ${active ? 'text-accent-blue-light bg-background-surface' : 'text-text-muted hover:text-text-primary hover:bg-background-surface'}
      `}
    >
      <span className="w-4 h-4 block">{children}</span>
    </button>
  );
}

function Icon3D() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
      <path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z"/>
    </svg>
  );
}
function IconHeatmap() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
      <rect x="1" y="1" width="14" height="14" rx="1"/>
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeOpacity="0.7"/>
      <circle cx="8" cy="8" r="2"/>
    </svg>
  );
}
function IconStep() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
      <polyline points="1,13 5,8 9,11 15,3"/>
    </svg>
  );
}
function IconSidebar() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
      <rect x="1" y="1" width="14" height="14" rx="1"/>
      <line x1="5" y1="1" x2="5" y2="15"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <polygon points="3,2 13,8 3,14"/>
    </svg>
  );
}
