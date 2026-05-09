"""API de Projetos — CRUD completo com suporte a cenários."""

import uuid
import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.project import Project, Scenario
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ScenarioCreate, ScenarioOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(**data.model_dump())
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projeto não encontrado")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: uuid.UUID, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projeto não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(project, k, v)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projeto não encontrado")
    await db.delete(project)


@router.post("/{project_id}/duplicate", response_model=ProjectOut, status_code=201)
async def duplicate_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Duplica um projeto com todos os cenários."""
    original = await db.get(Project, project_id)
    if not original:
        raise HTTPException(404, "Projeto não encontrado")

    new_project = Project(
        name=f"{original.name} (Cópia)",
        description=original.description,
        client=original.client,
        location=original.location,
        project_type=original.project_type,
        standard=original.standard,
    )
    db.add(new_project)
    await db.flush()

    # Duplicar cenários
    result = await db.execute(select(Scenario).where(Scenario.project_id == project_id))
    for scenario in result.scalars().all():
        new_scenario = Scenario(
            name=scenario.name,
            project_id=new_project.id,
            soil_data=scenario.soil_data,
            mesh_data=scenario.mesh_data,
            fault_data=scenario.fault_data,
            results=scenario.results,
        )
        db.add(new_scenario)

    await db.refresh(new_project)
    return new_project


@router.get("/{project_id}/export")
async def export_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Exporta projeto completo como JSON."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

    result = await db.execute(select(Scenario).where(Scenario.project_id == project_id))
    scenarios = result.scalars().all()

    return {
        "version": "1.0",
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "client": project.client,
            "location": project.location,
            "project_type": project.project_type,
            "standard": project.standard,
        },
        "scenarios": [
            {
                "id": str(s.id),
                "name": s.name,
                "soil_data": s.soil_data,
                "mesh_data": s.mesh_data,
                "fault_data": s.fault_data,
                "results": s.results,
            }
            for s in scenarios
        ],
    }


# ---- CENÁRIOS ----

@router.get("/{project_id}/scenarios", response_model=list[ScenarioOut])
async def list_scenarios(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.project_id == project_id))
    return result.scalars().all()


@router.post("/{project_id}/scenarios", response_model=ScenarioOut, status_code=201)
async def create_scenario(project_id: uuid.UUID, data: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    scenario = Scenario(
        name=data.name,
        project_id=project_id,
        soil_data=data.soil_data,
        mesh_data=data.mesh_data,
        fault_data=data.fault_data,
    )
    db.add(scenario)
    await db.flush()
    await db.refresh(scenario)
    return scenario


@router.put("/{project_id}/scenarios/{scenario_id}", response_model=ScenarioOut)
async def update_scenario(
    project_id: uuid.UUID, scenario_id: uuid.UUID,
    data: dict, db: AsyncSession = Depends(get_db)
):
    scenario = await db.get(Scenario, scenario_id)
    if not scenario or scenario.project_id != project_id:
        raise HTTPException(404, "Cenário não encontrado")
    for k, v in data.items():
        if hasattr(scenario, k):
            setattr(scenario, k, v)
    await db.flush()
    await db.refresh(scenario)
    return scenario
