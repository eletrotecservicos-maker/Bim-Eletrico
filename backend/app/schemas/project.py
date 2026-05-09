"""Schemas Pydantic para validação e serialização de projetos."""

from pydantic import BaseModel, Field, UUID4
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class ProjectType(str, Enum):
    substation = "substation"
    spda = "spda"
    industrial = "industrial"
    transmission = "transmission"
    datacenter = "datacenter"
    petrobras = "petrobras"


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    client: Optional[str] = None
    location: Optional[str] = None
    project_type: ProjectType = ProjectType.substation
    standard: str = "IEEE80"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    client: Optional[str] = None
    location: Optional[str] = None
    project_type: Optional[ProjectType] = None


class ProjectOut(BaseModel):
    id: UUID4
    name: str
    description: Optional[str]
    client: Optional[str]
    location: Optional[str]
    project_type: str
    standard: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- SOLO ----

class WennerMeasurementIn(BaseModel):
    spacing: float = Field(..., gt=0, description="Espaçamento entre eletrodos (m)")
    resistance: float = Field(..., gt=0, description="Resistência medida (Ω)")


class SoilDataIn(BaseModel):
    rho: float = Field(..., gt=0, description="Resistividade do solo nativo (Ω·m)")
    rho_surface: float = Field(3000.0, gt=0, description="Resistividade camada superficial (Ω·m)")
    depth_surface: float = Field(0.1, gt=0, description="Espessura camada superficial (m)")
    model_type: str = Field("homogeneous", description="homogeneous | two_layer")
    rho2: Optional[float] = Field(None, description="Resistividade camada 2 (Ω·m) — solo bicamada")
    h1: Optional[float] = Field(None, description="Espessura camada 1 (m) — solo bicamada")
    wenner_measurements: Optional[list[WennerMeasurementIn]] = None


# ---- MALHA ----

class MeshDataIn(BaseModel):
    area: float = Field(..., gt=0, description="Área da malha (m²)")
    total_length: float = Field(..., gt=0, description="Comprimento total de condutores (m)")
    depth: float = Field(0.5, gt=0, description="Profundidade de enterramento (m)")
    spacing_x: float = Field(5.0, gt=0, description="Espaçamento horizontal X (m)")
    spacing_y: float = Field(5.0, gt=0, description="Espaçamento vertical Y (m)")
    num_rods: int = Field(0, ge=0, description="Número de hastes verticais")
    rod_length: float = Field(3.0, gt=0, description="Comprimento de cada haste (m)")
    conductor_diameter: float = Field(0.0095, gt=0, description="Diâmetro do condutor (m)")
    # Geometria explícita dos condutores para visualização 3D
    conductors: Optional[list[dict]] = None
    rods_positions: Optional[list[dict]] = None


# ---- FALTA ----

class FaultDataIn(BaseModel):
    fault_current: float = Field(..., gt=0, description="Corrente de falta simétrica (A)")
    fault_duration: float = Field(..., gt=0, description="Duração da falta (s)")
    division_factor: float = Field(0.6, gt=0, le=1.0, description="Fator de divisão de corrente Sf")
    decrement_factor: float = Field(1.0, gt=0, description="Fator de decremento Df")


# ---- CÁLCULO ----

class CalculationRequest(BaseModel):
    soil: SoilDataIn
    mesh: MeshDataIn
    fault: FaultDataIn
    generate_heatmap: bool = True
    heatmap_resolution: int = Field(50, ge=20, le=200)


class CalculationResult(BaseModel):
    Rg: float
    Ig: float
    GPR: float
    Ib_50kg: float
    Ib_70kg: float
    Cs: float
    Em: float
    Etolerable: float
    touch_safe: bool
    Es: float
    Estolerable: float
    step_safe: bool
    Km: float
    Ks: float
    Ki: float
    Lm: float
    Ls: float
    safe: bool
    heatmap: Optional[dict] = None


# ---- CENÁRIO ----

class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    project_id: UUID4
    soil_data: dict = Field(default_factory=dict)
    mesh_data: dict = Field(default_factory=dict)
    fault_data: dict = Field(default_factory=dict)


class ScenarioOut(BaseModel):
    id: UUID4
    name: str
    project_id: UUID4
    created_at: datetime
    soil_data: dict
    mesh_data: dict
    fault_data: dict
    results: dict

    class Config:
        from_attributes = True
