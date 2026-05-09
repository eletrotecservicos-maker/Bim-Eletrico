/**
 * Sidebar esquerda — Gerenciador de projetos e cenários.
 * Estilo SCADA industrial com árvore de projetos.
 */
'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import type { Project } from '@/lib/types';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  substation: 'Subestação',
  spda: 'SPDA',
  industrial: 'Industrial',
  transmission: 'Transmissão',
  datacenter: 'Data Center',
  petrobras: 'Petróleo/Gás',
};

export default function Sidebar() {
  const { projects, activeProject, scenarios, activeScenario, selectProject, selectScenario, deleteProject, duplicateProject } = useProjectStore();
  const { setNewProjectModalOpen } = useUiStore();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null);

  const handleProjectClick = (project: Project) => {
    if (activeProject?.id === project.id) {
      setExpandedProject(v => v === project.id ? null : project.id);
    } else {
      selectProject(project);
      setExpandedProject(project.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, projectId });
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-background-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Projetos</span>
        <button
          onClick={() => setNewProjectModalOpen(true)}
          className="p-1 rounded hover:bg-background-surface text-text-muted hover:text-accent-blue-light transition-colors"
          title="Novo Projeto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 16 16" strokeWidth="1.5">
            <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
          </svg>
        </button>
      </div>

      {/* Lista de projetos */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-text-muted">Nenhum projeto encontrado.</p>
            <button
              onClick={() => setNewProjectModalOpen(true)}
              className="mt-2 text-xs text-accent-blue-light hover:underline"
            >
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id}>
              <button
                className={`
                  w-full text-left px-3 py-2 flex items-center gap-2
                  hover:bg-background-surface transition-colors group
                  ${activeProject?.id === project.id ? 'bg-background-surface border-l-2 border-accent-blue' : 'border-l-2 border-transparent'}
                `}
                onClick={() => handleProjectClick(project)}
                onContextMenu={(e) => handleContextMenu(e, project.id)}
              >
                <span className="text-xs transition-transform" style={{
                  transform: expandedProject === project.id ? 'rotate(90deg)' : 'none',
                }}>▶</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${activeProject?.id === project.id ? 'text-accent-blue-light' : 'text-text-primary'}`}>
                    {project.name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                  </p>
                </div>
              </button>

              {/* Cenários do projeto */}
              {expandedProject === project.id && activeProject?.id === project.id && scenarios.length > 0 && (
                <div className="ml-4 border-l border-background-border">
                  {scenarios.map(scenario => (
                    <button
                      key={scenario.id}
                      onClick={() => selectScenario(scenario)}
                      className={`
                        w-full text-left px-3 py-1.5 flex items-center gap-2
                        hover:bg-background-surface transition-colors
                        ${activeScenario?.id === scenario.id ? 'text-accent-blue-light' : 'text-text-secondary'}
                      `}
                    >
                      <span className="text-[10px]">◆</span>
                      <span className="text-xs truncate">{scenario.name}</span>
                      {scenario.results && Object.keys(scenario.results).length > 0 && (
                        <span className={`ml-auto text-[9px] font-mono ${
                          (scenario.results as Record<string, unknown>).safe ? 'text-status-safe-light' : 'text-status-danger-light'
                        }`}>
                          {(scenario.results as Record<string, unknown>).safe ? '✓' : '✗'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Legenda de tipos */}
      <div className="border-t border-background-border p-2">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Normas</p>
        <div className="space-y-0.5">
          {['IEEE Std 80', 'NBR 15751'].map(n => (
            <div key={n} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
              <span className="text-[10px] text-text-muted font-mono">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-background-surface border border-background-border rounded shadow-panel py-1 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-1.5 text-xs text-text-secondary hover:bg-background-border hover:text-text-primary"
            onClick={() => { duplicateProject(contextMenu.projectId); setContextMenu(null); }}
          >
            Duplicar Projeto
          </button>
          <div className="border-t border-background-border my-1" />
          <button
            className="w-full text-left px-4 py-1.5 text-xs text-status-danger-light hover:bg-status-danger/10"
            onClick={() => { deleteProject(contextMenu.projectId); setContextMenu(null); }}
          >
            Excluir Projeto
          </button>
        </div>
      )}
    </div>
  );
}
