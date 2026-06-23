/**
 * Tipos TypeScript centralizados para o BIM Elétrico.
 * Espelham os schemas do backend FastAPI/Pydantic.
 */

// ---- PROJETO ----

export type ProjectType =
  | 'substation'
  | 'spda'
  | 'industrial'
  | 'transmission'
  | 'datacenter'
  | 'petrobras';

export interface Project {
  id: string;
  name: string;
  description?: string;
  client?: string;
  location?: string;
  project_type: ProjectType;
  standard: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  client?: string;
  location?: string;
  project_type: ProjectType;
  standard?: string;
}

// ---- SOLO ----

export interface WennerMeasurement {
  spacing: number;   // Espaçamento dos eletrodos (m)
  resistance: number; // Resistência medida (Ω)
}

export interface SoilData {
  rho: number;                // Resistividade solo nativo (Ω·m)
  rho_surface: number;        // Resistividade camada superficial (Ω·m)
  depth_surface: number;      // Espessura camada superficial (m)
  model_type: 'homogeneous' | 'two_layer';
  rho2?: number;
  h1?: number;
  wenner_measurements?: WennerMeasurement[];
}

// ---- MALHA ----

export interface ConductorSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  id?: string;
  label?: string;
}

export interface RodPosition {
  x: number; y: number;
  id?: string;
}

export interface MeshData {
  area: number;                        // m²
  total_length: number;                // m
  depth: number;                       // m
  spacing_x: number;                   // m
  spacing_y: number;                   // m
  num_rods: number;
  rod_length: number;                  // m
  conductor_diameter: number;          // m
  conductors?: ConductorSegment[];
  rods_positions?: RodPosition[];
}

// ---- FALTA ----

export interface FaultData {
  fault_current: number;    // A
  fault_duration: number;   // s
  division_factor: number;  // Sf (0–1)
  decrement_factor: number; // Df
}

// ---- RESULTADOS ----

export interface HeatmapData {
  x: number[];
  y: number[];
  potential: number[][];
  potential_normalized: number[][];
  touch_voltage: number[][];
  step_voltage: number[][];
  GPR: number;
  V_max: number;
  V_min: number;
  Et_max: number;
  Es_max: number;
}

export interface CalculationResult {
  Rg: number;
  Ig: number;
  GPR: number;
  Ib_50kg: number;
  Ib_70kg: number;
  Cs: number;
  Em: number;
  Etolerable: number;
  touch_safe: boolean;
  Es: number;
  Estolerable: number;
  step_safe: boolean;
  Km: number;
  Ks: number;
  Ki: number;
  Lm: number;
  Ls: number;
  safe: boolean;
  heatmap?: HeatmapData;
}

// ---- CENÁRIO ----

export interface Scenario {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  soil_data: SoilData;
  mesh_data: MeshData;
  fault_data: FaultData;
  results: CalculationResult | Record<string, never>;
}

// ---- ANÁLISE DE SOLO ----

export interface SoilAnalysisResult {
  spacings?: number[];
  Ls?: number[];
  rho_apparent: number[];
  model: {
    rho1: number;
    rho2: number;
    h1: number;
    k: number;
  };
  fitted_curve: {
    spacings?: number[];
    Ls?: number[];
    rhos: number[];
  };
  rho_equivalent: number;
}

// ---- UI ----

export type ViewMode = '3d' | 'heatmap' | 'potential' | 'step';
export type ActivePanel = 'soil' | 'mesh' | 'fault' | 'results' | 'report' | 'ai';
export type HeatmapType = 'potential' | 'touch' | 'step';

export interface AppNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}
