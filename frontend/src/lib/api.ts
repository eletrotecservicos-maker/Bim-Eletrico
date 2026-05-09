/**
 * Cliente API para comunicação com o backend FastAPI.
 * Centraliza todas as chamadas HTTP com tratamento de erros.
 */

import axios, { AxiosInstance } from 'axios';
import type {
  Project, ProjectCreate, Scenario,
  CalculationResult, SoilAnalysisResult,
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ---- PROJETOS ----

export const projectsApi = {
  list: () => api.get<Project[]>('/projects/').then(r => r.data),

  create: (data: ProjectCreate) =>
    api.post<Project>('/projects/', data).then(r => r.data),

  get: (id: string) =>
    api.get<Project>(`/projects/${id}`).then(r => r.data),

  update: (id: string, data: Partial<ProjectCreate>) =>
    api.put<Project>(`/projects/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/projects/${id}`),

  duplicate: (id: string) =>
    api.post<Project>(`/projects/${id}/duplicate`).then(r => r.data),

  export: (id: string) =>
    api.get(`/projects/${id}/export`).then(r => r.data),

  // Cenários
  listScenarios: (projectId: string) =>
    api.get<Scenario[]>(`/projects/${projectId}/scenarios`).then(r => r.data),

  createScenario: (projectId: string, data: Partial<Scenario>) =>
    api.post<Scenario>(`/projects/${projectId}/scenarios`, data).then(r => r.data),

  updateScenario: (projectId: string, scenarioId: string, data: Partial<Scenario>) =>
    api.put<Scenario>(`/projects/${projectId}/scenarios/${scenarioId}`, data).then(r => r.data),
};

// ---- CÁLCULO ----

export const calculationsApi = {
  run: (payload: {
    soil: object;
    mesh: object;
    fault: object;
    generate_heatmap?: boolean;
    heatmap_resolution?: number;
  }) => api.post<CalculationResult>('/calculations/run', payload).then(r => r.data),

  analyzeWenner: (measurements: Array<{ spacing: number; resistance: number }>) =>
    api.post<SoilAnalysisResult>('/calculations/soil/wenner', measurements).then(r => r.data),

  analyzeSchlumberger: (measurements: Array<{ L: number; a: number; resistance: number }>) =>
    api.post<SoilAnalysisResult>('/calculations/soil/schlumberger', measurements).then(r => r.data),
};

// ---- RELATÓRIOS ----

export const reportsApi = {
  generatePdf: (projectId: string, scenarioId: string): Promise<Blob> =>
    api.get(`/reports/${projectId}/${scenarioId}/pdf`, {
      responseType: 'blob',
    }).then(r => r.data),

  previewPdf: (data: object): Promise<Blob> =>
    api.post('/reports/preview', data, {
      responseType: 'blob',
    }).then(r => r.data),
};

export default api;
