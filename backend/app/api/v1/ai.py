"""
API do Assistente de IA — chat offline via Ollama.
Todos os cálculos e respostas rodam localmente, sem internet.
"""
import json
import os
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engine.ai_assistant import (
    stream_chat,
    check_status,
    stream_pull,
    ChatMessage,
)

router = APIRouter(prefix="/ai", tags=["ai"])

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
DEFAULT_MODEL = os.getenv("AI_MODEL", "llama3.2:3b")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    model: Optional[str] = None
    context: Optional[dict] = None


@router.get("/status", summary="Status do Ollama e modelos disponíveis")
async def ai_status():
    """Verifica se o Ollama está rodando e quais modelos estão instalados."""
    status = await check_status(OLLAMA_URL)
    status["default_model"] = DEFAULT_MODEL
    return status


@router.post("/chat", summary="Chat com o assistente de IA (streaming SSE)")
async def chat(req: ChatRequest):
    """
    Envia mensagem ao assistente ELIAS e recebe resposta em streaming (SSE).

    O contexto opcional inclui dados do projeto ativo (solo, malha, falta, resultados),
    permitindo análises e recomendações baseadas nos parâmetros reais.
    """
    model = req.model or DEFAULT_MODEL
    messages = [ChatMessage(role=m.role, content=m.content) for m in req.messages]

    async def generate():
        try:
            async for chunk in stream_chat(messages, model, req.context, OLLAMA_URL):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except Exception as e:
            error_msg = str(e)
            if "Connect" in error_msg or "connect" in error_msg:
                error_msg = "Ollama não está disponível. Verifique se o serviço está rodando (docker-compose up ollama)."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/pull/{model_name:path}", summary="Baixar modelo do Ollama")
async def pull_model(model_name: str):
    """Baixa um modelo do repositório Ollama com progresso em streaming."""

    async def generate():
        try:
            async for chunk in stream_pull(model_name, OLLAMA_URL):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/models", summary="Lista de modelos recomendados")
async def list_recommended_models():
    """Retorna lista de modelos recomendados para engenharia elétrica."""
    return {
        "recommended": [
            {
                "name": "llama3.2:3b",
                "size": "~2 GB",
                "description": "Leve e rápido, bom suporte a português",
                "default": True,
            },
            {
                "name": "qwen2.5:3b",
                "size": "~2 GB",
                "description": "Excelente multilíngue, ótimo em português",
            },
            {
                "name": "mistral:7b",
                "size": "~4 GB",
                "description": "Melhor qualidade técnica, requer mais memória",
            },
            {
                "name": "phi3:mini",
                "size": "~2.3 GB",
                "description": "Microsoft Phi-3, eficiente em raciocínio técnico",
            },
        ]
    }
