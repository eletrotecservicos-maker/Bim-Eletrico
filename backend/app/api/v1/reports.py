"""API de Geração de Relatórios PDF."""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.project import Project, Scenario
from app.services.report_service import generate_pdf_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{project_id}/{scenario_id}/pdf", summary="Gerar relatório PDF técnico")
async def generate_report(
    project_id: uuid.UUID,
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Gera relatório PDF técnico completo para um cenário de projeto.
    Retorna o PDF como resposta binária para download direto.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

    scenario = await db.get(Scenario, scenario_id)
    if not scenario or scenario.project_id != project_id:
        raise HTTPException(404, "Cenário não encontrado")

    if not scenario.results:
        raise HTTPException(422, "Cenário sem resultados calculados. Execute o cálculo primeiro.")

    try:
        pdf_bytes = generate_pdf_report(
            project_data={
                "name": project.name,
                "client": project.client or "N/D",
                "location": project.location or "N/D",
                "project_type": project.project_type,
                "standard": project.standard,
            },
            scenario_data={
                "name": scenario.name,
                "soil_data": scenario.soil_data,
                "mesh_data": scenario.mesh_data,
                "fault_data": scenario.fault_data,
            },
            results=scenario.results,
        )

        filename = f"aterramento_{project.name.replace(' ', '_')}_{scenario.name.replace(' ', '_')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(500, f"Erro ao gerar relatório: {str(e)}")


@router.post("/preview", summary="Gerar PDF de preview sem salvar no banco")
async def preview_report(data: dict):
    """Gera PDF a partir de dados fornecidos diretamente (sem banco)."""
    try:
        pdf_bytes = generate_pdf_report(
            project_data=data.get("project", {}),
            scenario_data=data.get("scenario", {}),
            results=data.get("results", {}),
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="preview_aterramento.pdf"'},
        )
    except Exception as e:
        raise HTTPException(500, f"Erro ao gerar relatório: {str(e)}")
