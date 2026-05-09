"""
Campo de Potencial na Superfície do Solo
=========================================
Calcula a distribuição de potencial na superfície para visualização em heatmap.

Método: Superposição de fontes pontuais (Green's function para semi-espaço).
Para cada segmento de condutor, trata como série de fontes de corrente
distribuídas ao longo do comprimento.

FÓRMULA BASE (potencial de fonte pontual no semi-espaço):
  V(r) = rho * I / (2 * pi * r)

Para distribuição ao longo de um condutor:
  V(x,y) = sum_i [rho * dI_i / (2 * pi * r_i)]
  onde r_i = distância do ponto de observação à i-ésima fonte

Esta é uma aproximação de campos próximos (near-field).
Para análise precisa, usar FEM (planejado para versão futura).
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class Conductor:
    """Condutor horizontal enterrado."""
    x1: float; y1: float   # Ponto inicial (m)
    x2: float; y2: float   # Ponto final (m)
    depth: float            # Profundidade (m)
    current: float = 0.0   # Corrente injetada (A) — distribuída


@dataclass
class Rod:
    """Haste vertical de aterramento."""
    x: float; y: float     # Posição horizontal (m)
    depth_top: float        # Profundidade do topo (m)
    length: float           # Comprimento total (m)
    current: float = 0.0   # Corrente injetada (A)


def potential_point_source(
    x_obs: float, y_obs: float,
    x_src: float, y_src: float, z_src: float,
    rho: float, current: float,
) -> float:
    """
    Potencial de fonte pontual de corrente em solo semi-infinito.
    V = rho * I / (2 * pi * r)

    Args:
        x_obs, y_obs: ponto de observação na superfície (m)
        x_src, y_src, z_src: posição da fonte (m), z_src > 0 (profundidade)
        rho: resistividade do solo (Ω·m)
        current: corrente injetada (A)

    Returns:
        V: potencial no ponto de observação (V)
    """
    r = np.sqrt((x_obs - x_src)**2 + (y_obs - y_src)**2 + z_src**2)
    if r < 1e-6:
        r = 1e-6  # evitar divisão por zero
    return rho * current / (2.0 * np.pi * r)


def compute_surface_potential(
    grid_x: np.ndarray,
    grid_y: np.ndarray,
    conductors: list[Conductor],
    rods: list[Rod],
    rho: float,
    total_current: float,
    n_segments: int = 20,
) -> np.ndarray:
    """
    Calcula o potencial na superfície do solo por superposição de fontes.

    A corrente total é distribuída uniformemente entre todos os segmentos
    de condutores e hastes (simplificação — distribuição real requer FEM).

    Args:
        grid_x, grid_y: grades de pontos de observação (m)
        conductors:      lista de condutores horizontais
        rods:            lista de hastes verticais
        rho:             resistividade do solo (Ω·m)
        total_current:   corrente total injetada na malha (A)
        n_segments:      número de subsegmentos por condutor

    Returns:
        V: matriz de potencial (V), mesmas dimensões de grid_x
    """
    V = np.zeros_like(grid_x, dtype=float)

    # Coletar todas as fontes pontuais
    sources = []  # (x, y, z, current)

    for cond in conductors:
        # Discretizar condutor em n_segments fontes pontuais
        xs = np.linspace(cond.x1, cond.x2, n_segments)
        ys = np.linspace(cond.y1, cond.y2, n_segments)
        I_seg = cond.current / n_segments if cond.current != 0 else 0.0
        for xi, yi in zip(xs, ys):
            sources.append((xi, yi, cond.depth, I_seg))

    for rod in rods:
        # Distribuir corrente ao longo da haste
        depths = np.linspace(rod.depth_top, rod.depth_top + rod.length, n_segments)
        I_seg = rod.current / n_segments if rod.current != 0 else 0.0
        for z in depths:
            sources.append((rod.x, rod.y, z, I_seg))

    # Se nenhuma fonte tem corrente definida, distribuir uniformemente
    total_source_current = sum(abs(s[3]) for s in sources)
    if total_source_current < 1e-10 and len(sources) > 0:
        I_per_source = total_current / len(sources)
        sources = [(x, y, z, I_per_source) for x, y, z, _ in sources]

    # Superposição: V(x,y) = sum V_i(x,y)
    for x_src, y_src, z_src, I_src in sources:
        r = np.sqrt((grid_x - x_src)**2 + (grid_y - y_src)**2 + z_src**2)
        r = np.maximum(r, 1e-6)
        V += rho * I_src / (2.0 * np.pi * r)

    return V


def compute_touch_voltage_map(
    V_surface: np.ndarray,
    GPR: float,
) -> np.ndarray:
    """
    Mapa de tensão de toque: diferença entre GPR e potencial local.
    Et(x,y) = GPR - V(x,y)

    Args:
        V_surface: potencial na superfície (V)
        GPR:       potencial na malha (V)

    Returns:
        Et: tensão de toque (V)
    """
    return np.abs(GPR - V_surface)


def compute_step_voltage_map(
    V_surface: np.ndarray,
    grid_x: np.ndarray,
    grid_y: np.ndarray,
    step_distance: float = 1.0,
) -> np.ndarray:
    """
    Mapa de tensão de passo: gradiente de potencial entre dois pontos a 1m.
    Es(x,y) ≈ |∇V| * step_distance

    Usa gradiente numérico centrado.

    Args:
        V_surface:     potencial na superfície (V)
        grid_x, grid_y: grades de coordenadas (m)
        step_distance: comprimento do passo (m) — padrão 1 m

    Returns:
        Es: tensão de passo (V)
    """
    # Gradiente numérico em x e y
    dy = grid_y[1, 0] - grid_y[0, 0] if grid_y.shape[0] > 1 else 1.0
    dx = grid_x[0, 1] - grid_x[0, 0] if grid_x.shape[1] > 1 else 1.0

    dVdy, dVdx = np.gradient(V_surface, dy, dx)
    grad_magnitude = np.sqrt(dVdx**2 + dVdy**2)

    return grad_magnitude * step_distance


def generate_heatmap_data(
    mesh_x_min: float, mesh_x_max: float,
    mesh_y_min: float, mesh_y_max: float,
    conductors: list[Conductor],
    rods: list[Rod],
    rho: float,
    GPR: float,
    total_current: float,
    grid_resolution: int = 50,
) -> dict:
    """
    Gera dados completos para heatmap 2D de potencial.

    Args:
        mesh_x_min/max, mesh_y_min/max: limites da área (m)
        conductors: condutores da malha
        rods: hastes de aterramento
        rho: resistividade do solo (Ω·m)
        GPR: potencial da malha (V)
        total_current: corrente total (A)
        grid_resolution: pontos por eixo

    Returns:
        dict com arrays para renderização do heatmap
    """
    # Expandir área de visualização 20%
    margin = max((mesh_x_max - mesh_x_min), (mesh_y_max - mesh_y_min)) * 0.2
    x_range = np.linspace(mesh_x_min - margin, mesh_x_max + margin, grid_resolution)
    y_range = np.linspace(mesh_y_min - margin, mesh_y_max + margin, grid_resolution)
    grid_x, grid_y = np.meshgrid(x_range, y_range)

    # Calcular potencial
    V = compute_surface_potential(grid_x, grid_y, conductors, rods, rho, total_current)

    # Normalizar pelo GPR
    V_norm = V / GPR if GPR > 0 else V

    # Tensão de toque e passo
    Et = compute_touch_voltage_map(V, GPR)
    Es = compute_step_voltage_map(V, grid_x, grid_y)

    return {
        "x": x_range.tolist(),
        "y": y_range.tolist(),
        "potential": V.tolist(),
        "potential_normalized": V_norm.tolist(),
        "touch_voltage": Et.tolist(),
        "step_voltage": Es.tolist(),
        "GPR": GPR,
        "V_max": float(V.max()),
        "V_min": float(V.min()),
        "Et_max": float(Et.max()),
        "Es_max": float(Es.max()),
    }
