/**
 * AppShell — Layout principal do software.
 * Estrutura: Toolbar (topo) + Sidebar (esq) + Viewport 3D (centro) + Painel (dir)
 * Inspirado em ETAP, CDEGS e Navisworks.
 */
'use client';

import dynamic from 'next/dynamic';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import SoilPanel from '@/components/panels/SoilPanel';
import MeshPanel from '@/components/panels/MeshPanel';
import FaultPanel from '@/components/panels/FaultPanel';
import ResultsPanel from '@/components/panels/ResultsPanel';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';

// Three.js só funciona no cliente (sem SSR)
const Viewport3D = dynamic(() => import('@/components/viewport/Viewport3D'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-background-primary">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-text-muted text-sm">Inicializando viewport 3D...</p>
      </div>
    </div>
  ),
});

const HeatmapView = dynamic(() => import('@/components/viewport/HeatmapView'), { ssr: false });

export default function AppShell() {
  const { activePanel, leftSidebarOpen, rightPanelOpen, viewMode } = useUiStore();
  const { activeProject } = useProjectStore();

  const renderRightPanel = () => {
    switch (activePanel) {
      case 'soil':   return <SoilPanel />;
      case 'mesh':   return <MeshPanel />;
      case 'fault':  return <FaultPanel />;
      case 'results': return <ResultsPanel />;
      default:       return <SoilPanel />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-primary select-none">
      {/* ── Toolbar topo ── */}
      <Toolbar />

      {/* ── Área de trabalho ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar esquerda (projetos + navegação) ── */}
        {leftSidebarOpen && (
          <div className="w-56 flex-shrink-0 border-r border-background-border flex flex-col bg-background-secondary">
            <Sidebar />
          </div>
        )}

        {/* ── Viewport central ── */}
        <div className="flex-1 relative overflow-hidden bg-background-primary">
          {!activeProject ? (
            <WelcomeScreen />
          ) : viewMode === 'heatmap' || viewMode === 'potential' || viewMode === 'step' ? (
            <HeatmapView />
          ) : (
            <Viewport3D />
          )}
        </div>

        {/* ── Painel direito (parâmetros + resultados) ── */}
        {rightPanelOpen && activeProject && (
          <div className="w-80 flex-shrink-0 border-l border-background-border bg-background-secondary overflow-y-auto">
            {renderRightPanel()}
          </div>
        )}
      </div>

      {/* ── Status bar rodapé ── */}
      <StatusBar />
    </div>
  );
}

function WelcomeScreen() {
  const { setNewProjectModalOpen } = useUiStore();
  const { projects, selectProject } = useProjectStore();

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-8">
      {/* Logo / título */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-accent-blue flex items-center justify-center shadow-glow-blue">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">BIM Elétrico</h1>
            <p className="text-xs text-text-muted uppercase tracking-widest">Analisador de Malhas de Aterramento</p>
          </div>
        </div>

        <p className="text-text-secondary text-sm max-w-md text-center leading-relaxed">
          Sistema profissional de análise, dimensionamento e visualização de malhas de aterramento
          conforme <span className="text-accent-blue-light">IEEE Std 80</span> e <span className="text-accent-blue-light">ABNT NBR 15751</span>.
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="flex gap-3">
        <button
          onClick={() => setNewProjectModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Projeto
        </button>
      </div>

      {/* Projetos recentes */}
      {projects.length > 0 && (
        <div className="w-full max-w-lg">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-3">Projetos Recentes</p>
          <div className="space-y-1.5">
            {projects.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => selectProject(p)}
                className="w-full text-left px-4 py-3 rounded bg-background-secondary border border-background-border
                           hover:border-accent-blue hover:bg-background-surface transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue-light">{p.name}</p>
                    <p className="text-xs text-text-muted">{p.client || 'Sem cliente'} · {p.project_type.toUpperCase()}</p>
                  </div>
                  <span className="text-xs text-text-muted">{new Date(p.updated_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Normas e badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        {['IEEE Std 80', 'ABNT NBR 15751', 'ABNT NBR 5410', 'ABNT NBR 5419', 'IEC 61936'].map(n => (
          <span key={n} className="text-xs px-2 py-1 rounded border border-background-border text-text-muted font-mono">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
