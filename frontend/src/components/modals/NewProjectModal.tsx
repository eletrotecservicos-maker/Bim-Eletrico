/**
 * Modal de criação de novo projeto.
 * Design industrial com campos obrigatórios e seleção de tipo.
 */
'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import type { ProjectType } from '@/lib/types';

const PROJECT_TYPES: { value: ProjectType; label: string; description: string }[] = [
  { value: 'substation', label: 'Subestação', description: 'SE de AT/MT — IEEE 80 / NBR 15751' },
  { value: 'spda', label: 'SPDA', description: 'Sistema de Proteção Contra Descargas Atmosféricas — NBR 5419' },
  { value: 'industrial', label: 'Industrial', description: 'Plantas industriais, fábricas — NBR 5410' },
  { value: 'transmission', label: 'Linha de Transmissão', description: 'Torres e cabos de guarda — IEC 61936' },
  { value: 'datacenter', label: 'Data Center', description: 'TIA-942 / NBR 5410' },
  { value: 'petrobras', label: 'Petróleo e Gás', description: 'NR-10 / API RP-2003' },
];

export default function NewProjectModal() {
  const { createProject, selectProject } = useProjectStore();
  const { setNewProjectModalOpen } = useUiStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    client: '',
    location: '',
    project_type: 'substation' as ProjectType,
    description: '',
    standard: 'IEEE80',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const project = await createProject(form);
      await selectProject(project);
      setNewProjectModalOpen(false);
    } catch {
      /* erro tratado */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-background-tertiary border border-background-border rounded-lg shadow-panel w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Novo Projeto</h2>
            <p className="text-xs text-text-muted mt-0.5">Análise de Malha de Aterramento</p>
          </div>
          <button
            onClick={() => setNewProjectModalOpen(false)}
            className="p-1.5 rounded hover:bg-background-surface text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">Nome do Projeto *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: SE Guarulhos 138/13,8 kV"
              required
              className="input-industrial w-full"
              autoFocus
            />
          </div>

          {/* Tipo de instalação */}
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1.5">Tipo de Instalação</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROJECT_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setForm({ ...form, project_type: pt.value })}
                  className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                    form.project_type === pt.value
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue-light'
                      : 'border-background-border text-text-muted hover:border-accent-blue/40 hover:text-text-primary'
                  }`}
                >
                  <div className="font-medium">{pt.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{pt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cliente e localização */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">Cliente</label>
              <input
                type="text"
                value={form.client}
                onChange={e => setForm({ ...form, client: e.target.value })}
                placeholder="Ex: CEMIG, Petrobras..."
                className="input-industrial w-full"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary font-medium block mb-1">Localização</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="Cidade, UF"
                className="input-industrial w-full"
              />
            </div>
          </div>

          {/* Norma */}
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1">Norma Principal</label>
            <select
              value={form.standard}
              onChange={e => setForm({ ...form, standard: e.target.value })}
              className="input-industrial w-full"
            >
              <option value="IEEE80">IEEE Std 80 - 2013</option>
              <option value="NBR15751">ABNT NBR 15751</option>
              <option value="IEC61936">IEC 61936</option>
            </select>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setNewProjectModalOpen(false)}
              className="flex-1 btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || loading}
              className="flex-1 btn-primary"
            >
              {loading ? 'Criando...' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
