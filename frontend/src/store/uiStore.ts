/**
 * Store Zustand — Estado da interface (painéis, modos de visualização, etc.)
 */

import { create } from 'zustand';
import type { ViewMode, ActivePanel, HeatmapType } from '@/lib/types';

interface UiStore {
  // Painéis
  activePanel: ActivePanel;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  aiPanelOpen: boolean;
  setActivePanel: (panel: ActivePanel) => void;
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  toggleAiPanel: () => void;

  // Viewport
  viewMode: ViewMode;
  heatmapType: HeatmapType;
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  showSoilLayer: boolean;
  setViewMode: (mode: ViewMode) => void;
  setHeatmapType: (type: HeatmapType) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleLabels: () => void;
  toggleSoilLayer: () => void;

  // Modais
  newProjectModalOpen: boolean;
  importModalOpen: boolean;
  setNewProjectModalOpen: (v: boolean) => void;
  setImportModalOpen: (v: boolean) => void;

  // Câmera 3D
  cameraPreset: 'perspective' | 'top' | 'front' | 'side';
  setCameraPreset: (preset: UiStore['cameraPreset']) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activePanel: 'soil',
  leftSidebarOpen: true,
  rightPanelOpen: true,
  aiPanelOpen: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleLeftSidebar: () => set(s => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightPanel: () => set(s => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleAiPanel: () => set(s => ({ aiPanelOpen: !s.aiPanelOpen })),

  viewMode: '3d',
  heatmapType: 'potential',
  showGrid: true,
  showAxes: true,
  showLabels: true,
  showSoilLayer: true,
  setViewMode: (mode) => set({ viewMode: mode }),
  setHeatmapType: (type) => set({ heatmapType: type }),
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set(s => ({ showAxes: !s.showAxes })),
  toggleLabels: () => set(s => ({ showLabels: !s.showLabels })),
  toggleSoilLayer: () => set(s => ({ showSoilLayer: !s.showSoilLayer })),

  newProjectModalOpen: false,
  importModalOpen: false,
  setNewProjectModalOpen: (v) => set({ newProjectModalOpen: v }),
  setImportModalOpen: (v) => set({ importModalOpen: v }),

  cameraPreset: 'perspective',
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
}));
