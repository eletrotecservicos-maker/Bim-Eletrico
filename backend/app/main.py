"""
BIM Elétrico — Analisador de Malhas de Aterramento
====================================================
Aplicação FastAPI principal.

Arquitetura:
  /api/v1/projects     — CRUD de projetos e cenários
  /api/v1/calculations — Engine de cálculo IEEE 80
  /api/v1/reports      — Geração de PDF técnico

Pronto para escala:
  - Assíncrono (asyncpg + SQLAlchemy async)
  - CORS configurável
  - Documentação automática via OpenAPI
  - Preparado para FEM futuro (módulo engine/fem.py)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import calculations, projects, reports, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida: inicializa banco na subida."""
    try:
        await init_db()
    except Exception as e:
        print(f"[WARN] Banco indisponível: {e} — rodando sem persistência.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## BIM Elétrico — Análise Profissional de Malhas de Aterramento

Sistema de engenharia para dimensionamento de malhas de aterramento conforme:
- **IEEE Std 80 - 2013** — Segurança em subestações CA
- **ABNT NBR 15751** — Aterramento em subestações
- **ABNT NBR 5410 / 5419** — Instalações elétricas e SPDA

### Módulos Disponíveis
- **Projetos**: CRUD completo, cenários, exportação JSON
- **Cálculo**: IEEE 80 completo (Rg, GPR, Et, Es)
- **Solo**: Análise Wenner e Schlumberger, estratificação
- **Heatmap**: Campo de potencial na superfície
- **Relatório**: PDF técnico profissional
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS para o frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(projects.router, prefix="/api/v1")
app.include_router(calculations.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")


@app.get("/", tags=["health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
