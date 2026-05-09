/**
 * Store Zustand — Estado global de projetos e cenários.
 * Persiste dados em memória durante a sessão.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Project, Scenario, SoilData, MeshData, FaultData, CalculationResult,
} from '@/lib/types';
import { projectsApi, calculationsApi } from '@/lib/api';

interface ProjectStore {
  // Estado
  projects: Project[];
  activeProject: Project | null;
  activeScenario: Scenario | null;
  scenarios: Scenario[];
  calculationResult: CalculationResult | null;
  isCalculating: boolean;
  error: string | null;

  // Ações de projeto
  loadProjects: () => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;

  // Ações de cenário
  selectScenario: (scenario: Scenario) => void;
  updateSoil: (soil: Partial<SoilData>) => void;
  updateMesh: (mesh: Partial<MeshData>) => void;
  updateFault: (fault: Partial<FaultData>) => void;
  saveScenario: () => Promise<void>;

  // Cálculo
  runCalculation: () => Promise<void>;
  clearResults: () => void;
}

const DEFAULT_SOIL: SoilData = {
  rho: 150,
  rho_surface: 3000,
  depth_surface: 0.1,
  model_type: 'homogeneous',
};

const DEFAULT_MESH: MeshData = {
  area: 2500,       // 50m x 50m
  total_length: 600,
  depth: 0.5,
  spacing_x: 5,
  spacing_y: 5,
  num_rods: 20,
  rod_length: 3.0,
  conductor_diameter: 0.0095,
};

const DEFAULT_FAULT: FaultData = {
  fault_current: 10000,
  fault_duration: 0.5,
  division_factor: 0.6,
  decrement_factor: 1.0,
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      projects: [],
      activeProject: null,
      activeScenario: null,
      scenarios: [],
      calculationResult: null,
      isCalculating: false,
      error: null,

      loadProjects: async () => {
        try {
          const projects = await projectsApi.list();
          set({ projects, error: null });
        } catch {
          set({ error: 'Erro ao carregar projetos' });
        }
      },

      selectProject: async (project) => {
        set({ activeProject: project, activeScenario: null, calculationResult: null });
        try {
          const scenarios = await projectsApi.listScenarios(project.id);
          set({ scenarios });
          if (scenarios.length > 0) {
            set({ activeScenario: scenarios[0] });
          } else {
            // Criar cenário padrão
            const newScenario = await projectsApi.createScenario(project.id, {
              name: 'Cenário 1',
              soil_data: DEFAULT_SOIL as unknown as SoilData,
              mesh_data: DEFAULT_MESH as unknown as MeshData,
              fault_data: DEFAULT_FAULT as unknown as FaultData,
            });
            set({ scenarios: [newScenario], activeScenario: newScenario });
          }
        } catch {
          set({ error: 'Erro ao carregar cenários' });
        }
      },

      createProject: async (data) => {
        const project = await projectsApi.create(data as Project);
        set(state => ({ projects: [project, ...state.projects] }));
        return project;
      },

      deleteProject: async (id) => {
        await projectsApi.delete(id);
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          activeProject: state.activeProject?.id === id ? null : state.activeProject,
        }));
      },

      duplicateProject: async (id) => {
        const copy = await projectsApi.duplicate(id);
        set(state => ({ projects: [copy, ...state.projects] }));
      },

      selectScenario: (scenario) => {
        set({ activeScenario: scenario, calculationResult: null });
      },

      updateSoil: (soil) => {
        set(state => ({
          activeScenario: state.activeScenario
            ? { ...state.activeScenario, soil_data: { ...state.activeScenario.soil_data, ...soil } }
            : null,
        }));
      },

      updateMesh: (mesh) => {
        set(state => ({
          activeScenario: state.activeScenario
            ? { ...state.activeScenario, mesh_data: { ...state.activeScenario.mesh_data, ...mesh } }
            : null,
        }));
      },

      updateFault: (fault) => {
        set(state => ({
          activeScenario: state.activeScenario
            ? { ...state.activeScenario, fault_data: { ...state.activeScenario.fault_data, ...fault } }
            : null,
        }));
      },

      saveScenario: async () => {
        const { activeProject, activeScenario } = get();
        if (!activeProject || !activeScenario) return;
        try {
          await projectsApi.updateScenario(activeProject.id, activeScenario.id, {
            soil_data: activeScenario.soil_data,
            mesh_data: activeScenario.mesh_data,
            fault_data: activeScenario.fault_data,
            results: activeScenario.results,
          } as unknown as Scenario);
        } catch {
          set({ error: 'Erro ao salvar cenário' });
        }
      },

      runCalculation: async () => {
        const { activeScenario } = get();
        if (!activeScenario) return;

        set({ isCalculating: true, error: null });
        try {
          const result = await calculationsApi.run({
            soil: activeScenario.soil_data,
            mesh: activeScenario.mesh_data,
            fault: activeScenario.fault_data,
            generate_heatmap: true,
            heatmap_resolution: 60,
          });

          set({
            calculationResult: result,
            isCalculating: false,
            activeScenario: {
              ...activeScenario,
              results: result as unknown as CalculationResult,
            },
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro no cálculo';
          set({ isCalculating: false, error: msg });
        }
      },

      clearResults: () => {
        set({ calculationResult: null });
      },
    }),
    { name: 'BimEletricoStore' }
  )
);
