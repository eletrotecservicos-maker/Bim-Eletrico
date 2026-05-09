"""
API de Cálculo - IEEE 80
Endpoint principal de análise de malhas de aterramento.
"""

from fastapi import APIRouter, HTTPException
from app.schemas.project import CalculationRequest, CalculationResult
from app.engine.ieee80 import (
    run_ieee80_calculation,
    SoilModel as EngineSoilModel,
    MeshGeometry as EngineMesh,
    FaultConditions as EngineFault,
)
from app.engine.potential_field import generate_heatmap_data, Conductor, Rod
from app.engine.soil_analysis import analyze_wenner, analyze_schlumberger

router = APIRouter(prefix="/calculations", tags=["calculations"])


@router.post("/run", response_model=CalculationResult, summary="Executar análise IEEE 80 completa")
async def run_calculation(req: CalculationRequest):
    """
    Executa cálculo completo de segurança de malha de aterramento conforme IEEE 80.

    Retorna:
    - Resistência da malha (Rg)
    - GPR — Ground Potential Rise
    - Tensão de toque e passo (calculada e tolerável)
    - Indicadores de segurança
    - Heatmap de potencial (opcional)
    """
    try:
        soil = EngineSoilModel(
            rho=req.soil.rho,
            rho_surface=req.soil.rho_surface,
            depth_surface=req.soil.depth_surface,
        )

        mesh = EngineMesh(
            area=req.mesh.area,
            total_length=req.mesh.total_length,
            depth=req.mesh.depth,
            spacing_x=req.mesh.spacing_x,
            spacing_y=req.mesh.spacing_y,
            num_rods=req.mesh.num_rods,
            rod_length=req.mesh.rod_length,
            conductor_diameter=req.mesh.conductor_diameter,
        )

        fault = EngineFault(
            fault_current=req.fault.fault_current,
            fault_duration=req.fault.fault_duration,
            division_factor=req.fault.division_factor,
            decrement_factor=req.fault.decrement_factor,
        )

        results = run_ieee80_calculation(soil, mesh, fault)

        heatmap = None
        if req.generate_heatmap:
            # Gerar condutores automáticos se não fornecidos
            conductors, rods = _build_conductors_from_mesh(req.mesh, results.Ig)
            side = import_math_sqrt(req.mesh.area)
            heatmap = generate_heatmap_data(
                mesh_x_min=0.0, mesh_x_max=side,
                mesh_y_min=0.0, mesh_y_max=side,
                conductors=conductors,
                rods=rods,
                rho=req.soil.rho,
                GPR=results.GPR,
                total_current=results.Ig,
                grid_resolution=req.heatmap_resolution,
            )

        return CalculationResult(
            Rg=round(results.Rg, 4),
            Ig=round(results.Ig, 2),
            GPR=round(results.GPR, 2),
            Ib_50kg=round(results.Ib_50kg, 4),
            Ib_70kg=round(results.Ib_70kg, 4),
            Cs=round(results.Cs, 4),
            Em=round(results.Em, 2),
            Etolerable=round(results.Etolerable, 2),
            touch_safe=results.touch_safe,
            Es=round(results.Es, 2),
            Estolerable=round(results.Estolerable, 2),
            step_safe=results.step_safe,
            Km=round(results.Km, 4),
            Ks=round(results.Ks, 4),
            Ki=round(results.Ki, 4),
            Lm=round(results.Lm, 2),
            Ls=round(results.Ls, 2),
            safe=results.safe,
            heatmap=heatmap,
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no cálculo: {str(e)}")


@router.post("/soil/wenner", summary="Analisar ensaio Wenner")
async def analyze_wenner_endpoint(measurements: list[dict]):
    """Analisa ensaio de campo pelo método de Wenner e retorna modelo de 2 camadas."""
    try:
        return analyze_wenner(measurements)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/soil/schlumberger", summary="Analisar ensaio Schlumberger")
async def analyze_schlumberger_endpoint(measurements: list[dict]):
    """Analisa ensaio de campo pelo método de Schlumberger."""
    try:
        return analyze_schlumberger(measurements)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


def import_math_sqrt(x: float) -> float:
    import math
    return math.sqrt(x)


def _build_conductors_from_mesh(mesh_data, total_current: float) -> tuple:
    """Constrói lista de condutores a partir dos dados de malha para o heatmap."""
    import math

    conductors = []
    rods_list = []

    if mesh_data.conductors:
        # Usar condutores fornecidos explicitamente
        for c in mesh_data.conductors:
            conductors.append(Conductor(
                x1=c.get('x1', 0), y1=c.get('y1', 0),
                x2=c.get('x2', 0), y2=c.get('y2', 0),
                depth=mesh_data.depth,
                current=total_current / max(len(mesh_data.conductors), 1),
            ))
    else:
        # Gerar malha reticulada automática
        side = math.sqrt(mesh_data.area)
        nx = max(2, int(side / mesh_data.spacing_x) + 1)
        ny = max(2, int(side / mesh_data.spacing_y) + 1)
        n_cond = (nx - 1) * ny + nx * (ny - 1)
        I_per = total_current / max(n_cond, 1)

        for i in range(ny):
            for j in range(nx - 1):
                x1 = j * mesh_data.spacing_x
                x2 = (j + 1) * mesh_data.spacing_x
                y = i * mesh_data.spacing_y
                conductors.append(Conductor(x1=x1, y1=y, x2=x2, y2=y, depth=mesh_data.depth, current=I_per))

        for i in range(ny - 1):
            for j in range(nx):
                x = j * mesh_data.spacing_x
                y1 = i * mesh_data.spacing_y
                y2 = (i + 1) * mesh_data.spacing_y
                conductors.append(Conductor(x1=x, y1=y1, x2=x, y2=y2, depth=mesh_data.depth, current=I_per))

    if mesh_data.rods_positions:
        for r in mesh_data.rods_positions:
            rods_list.append(Rod(
                x=r.get('x', 0), y=r.get('y', 0),
                depth_top=mesh_data.depth,
                length=mesh_data.rod_length,
                current=total_current / max(len(mesh_data.rods_positions), 1),
            ))

    return conductors, rods_list
