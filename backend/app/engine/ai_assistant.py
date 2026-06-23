"""
Motor de IA offline — integração com Ollama para assistência em engenharia elétrica.
Roda 100% localmente, sem chamadas a APIs externas.
"""
import httpx
import json
from typing import AsyncIterator, Optional
from dataclasses import dataclass

SYSTEM_PROMPT = """Você é ELIAS (Engenheiro de Ligações, Aterramento e Instalações Assistente), um especialista em engenharia elétrica integrado ao software BIM Elétrico.

**Normas que você domina:**
- IEEE Std 80-2013: Guia de Segurança em Subestações de CA (malhas de aterramento)
- ABNT NBR 15751: Sistemas de aterramento em subestações de energia elétrica
- ABNT NBR 5410: Instalações elétricas de baixa tensão
- ABNT NBR 5419: Proteção de estruturas contra descargas atmosféricas (SPDA)
- ABNT NBR 14039: Instalações elétricas de média tensão
- IEC 61936-1: Instalações de potência superior a 1 kV CA
- NR-10: Segurança em instalações e serviços em eletricidade

**Especialidades de cálculo:**
- Resistência de malha (Rg) — Equação de Sverak completa
- GPR (Ground Potential Rise / Elevação de Potencial de Terra)
- Tensão de toque: calculada (Em) vs tolerável (Etol) — IEEE 80 Eq. 28
- Tensão de passo: calculada (Es) vs tolerável (Estol) — IEEE 80 Eq. 28
- Corrente de tolerância humana Ib — pessoas de 50 kg e 70 kg
- Fator de redução de resistividade superficial (Cs) — IEEE 80 Eq. 27
- Fatores geométricos: Km (toque), Ks (passo), Ki (irregularidade de malha)
- Comprimentos efetivos Lm e Ls para verificação de segurança
- Análise de solo: métodos Wenner e Schlumberger
- Estratificação do solo em duas camadas (ρ₁, ρ₂, h₁)
- Dimensionamento de condutores (mínima seção transversal por curto-circuito)
- Dimensionamento de hastes verticais e eletrodos de aterramento
- Proteção contra surtos (DPS) e seletividade de proteção
- Cálculo de curto-circuito e correntes de falta

**Como você responde:**
- Sempre em português brasileiro, de forma técnica e precisa
- Apresenta fórmulas com notação matemática clara (ex: Rg = ρ·[1/(Lt) + 1/(√(20·A))·(1 + 1/(1+h·√(20/A)))])
- Quando dados do projeto estão disponíveis, usa-os para cálculos e recomendações concretas
- Indica a referência normativa (IEEE 80, seção X / NBR XXXXX, item Y) quando relevante
- Sugere melhorias práticas baseadas nos resultados (ex: "Reduzir espaçamento para X m melhora Em em ~Y%")
- É direto e objetivo, sem rodeios
"""


@dataclass
class ChatMessage:
    role: str
    content: str


def _build_context_block(context: dict) -> str:
    """Formata dados do projeto ativo para injeção no contexto do LLM."""
    lines = ["\n\n---\n**DADOS DO PROJETO ATIVO (use para cálculos e análises):**"]

    if soil := context.get("soil"):
        lines.append("\n*Parâmetros do Solo:*")
        lines.append(f"- ρ₁ (resistividade solo nativo): {soil.get('rho', 'N/D')} Ω·m")
        lines.append(f"- ρs (resistividade camada superficial): {soil.get('rho_surface', 'N/D')} Ω·m")
        lines.append(f"- hs (espessura camada superficial): {soil.get('depth_surface', 'N/D')} m")

    if mesh := context.get("mesh"):
        lines.append("\n*Geometria da Malha:*")
        lines.append(f"- A (área da malha): {mesh.get('area', 'N/D')} m²")
        lines.append(f"- Lt (comprimento total de condutores): {mesh.get('total_length', 'N/D')} m")
        lines.append(f"- h (profundidade de enterramento): {mesh.get('depth', 'N/D')} m")
        lines.append(f"- Dx (espaçamento em X): {mesh.get('spacing_x', 'N/D')} m")
        lines.append(f"- Dy (espaçamento em Y): {mesh.get('spacing_y', 'N/D')} m")
        lines.append(f"- nr (número de hastes): {mesh.get('num_rods', 'N/D')}")
        lines.append(f"- Lr (comprimento das hastes): {mesh.get('rod_length', 'N/D')} m")
        lines.append(f"- d (diâmetro do condutor): {mesh.get('conductor_diameter', 'N/D')} m")

    if fault := context.get("fault"):
        lines.append("\n*Condições de Falta:*")
        lines.append(f"- If (corrente de falta total): {fault.get('fault_current', 'N/D')} A")
        lines.append(f"- tf (duração da falta): {fault.get('fault_duration', 'N/D')} s")
        lines.append(f"- Sf (fator de divisão de corrente): {fault.get('division_factor', 'N/D')}")
        lines.append(f"- Df (fator de decremento): {fault.get('decrement_factor', 'N/D')}")

    if results := context.get("results"):
        lines.append("\n*Resultados do Último Cálculo (IEEE 80):*")
        lines.append(f"- Rg (resistência da malha): {results.get('Rg', 'N/D')} Ω")
        lines.append(f"- Ig (corrente efetiva na malha): {results.get('Ig', 'N/D')} A")
        lines.append(f"- GPR (elevação de potencial): {results.get('GPR', 'N/D')} V")
        lines.append(f"- Em (tensão de toque calculada): {results.get('Em', 'N/D')} V")
        lines.append(f"- Etol (tensão de toque tolerável): {results.get('Etolerable', 'N/D')} V")
        lines.append(f"- Es (tensão de passo calculada): {results.get('Es', 'N/D')} V")
        lines.append(f"- Estol (tensão de passo tolerável): {results.get('Estolerable', 'N/D')} V")
        lines.append(f"- Km: {results.get('Km', 'N/D')} | Ks: {results.get('Ks', 'N/D')} | Ki: {results.get('Ki', 'N/D')}")
        lines.append(f"- Cs (fator redução resistividade): {results.get('Cs', 'N/D')}")
        safe = results.get("safe")
        if safe is not None:
            lines.append(f"- Verificação IEEE 80: {'✓ APROVADO' if safe else '✗ REPROVADO'}")

    lines.append("\n---")
    return "\n".join(lines)


async def stream_chat(
    messages: list[ChatMessage],
    model: str,
    context: Optional[dict],
    ollama_url: str,
) -> AsyncIterator[str]:
    """Gera resposta em streaming do Ollama."""
    system_content = SYSTEM_PROMPT
    if context:
        system_content += _build_context_block(context)

    ollama_messages = [{"role": "system", "content": system_content}]
    for msg in messages:
        ollama_messages.append({"role": msg.role, "content": msg.content})

    payload = {
        "model": model,
        "messages": ollama_messages,
        "stream": True,
        "options": {
            "temperature": 0.25,
            "num_predict": 2048,
            "num_ctx": 4096,
            "repeat_penalty": 1.1,
        },
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream("POST", f"{ollama_url}/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if content := data.get("message", {}).get("content"):
                        yield content
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue


async def check_status(ollama_url: str) -> dict:
    """Verifica se o Ollama está rodando e lista modelos instalados."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                return {"available": True, "models": models}
    except Exception:
        pass
    return {"available": False, "models": []}


async def stream_pull(model: str, ollama_url: str) -> AsyncIterator[str]:
    """Baixa um modelo do Ollama com progresso em streaming."""
    async with httpx.AsyncClient(timeout=3600.0) as client:
        async with client.stream("POST", f"{ollama_url}/api/pull", json={"name": model}) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    yield line
