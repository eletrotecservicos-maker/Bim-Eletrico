"""
Engine de Cálculo IEEE Std 80 - 2013
=====================================
Referência principal: IEEE Guide for Safety in AC Substation Grounding

Este módulo implementa os algoritmos fundamentais da norma IEEE 80 para:
  - Resistência da malha de aterramento
  - Tensão de toque (touch voltage)
  - Tensão de passo (step voltage)
  - GPR - Ground Potential Rise
  - Corrente suportável pelo corpo humano
  - Verificações automáticas de segurança

FÓRMULAS PRINCIPAIS:
  Rg  = rho * [ 1/(4*sqrt(A)) + 1/Lt * (1 + 1/(1 + h*sqrt(20/A))) ]
  GPR = Ig * Rg
  Ib  = 0.116 / sqrt(t)    (corpo 50kg, IEC/IEEE 80)
  Et  = (rho_s * Cs * Ib)  * Km * Ki
  Es  = (rho_s * Cs * Ib)  * Ks * Ki
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class SoilModel:
    """Modelo de solo (homogêneo ou multicamada simplificado)."""
    rho: float          # Resistividade da camada principal (Ω·m)
    rho_surface: float  # Resistividade da camada superficial (Ω·m) — brita/cascalho
    depth_surface: float = 0.1  # Espessura da camada superficial (m)


@dataclass
class MeshGeometry:
    """Geometria da malha de aterramento."""
    area: float           # Área da malha (m²)
    total_length: float   # Comprimento total de condutores (m)
    depth: float          # Profundidade de enterramento (m)
    spacing_x: float      # Espaçamento horizontal X (m)
    spacing_y: float      # Espaçamento vertical Y (m)
    num_rods: int         # Número de hastes verticais
    rod_length: float     # Comprimento de cada haste (m)
    conductor_diameter: float = 0.0095  # Diâmetro do condutor (m) — 4/0 AWG ≈ 9,5mm
    n_parallel_x: int = 1  # Nº de condutores paralelos no eixo X
    n_parallel_y: int = 1  # Nº de condutores paralelos no eixo Y


@dataclass
class FaultConditions:
    """Condições da falta elétrica."""
    fault_current: float   # Corrente de falta simétrica (A)
    fault_duration: float  # Duração da falta (s)
    division_factor: float = 0.6   # Sf — fator de divisão de corrente
    decrement_factor: float = 1.0  # Df — fator de decremento (assimetria)


@dataclass
class IEEE80Results:
    """Resultados completos do cálculo IEEE 80."""
    # Resistência
    Rg: float           # Resistência da malha (Ω)

    # Correntes e GPR
    Ig: float           # Corrente de malha efetiva (A)
    GPR: float          # Ground Potential Rise (V)

    # Corrente corporal tolerável
    Ib_50kg: float      # Corrente tolerável — 50 kg (A)
    Ib_70kg: float      # Corrente tolerável — 70 kg (A)

    # Fator de redução de superfície (camada superficial)
    Cs: float           # Fator de redução superficial

    # Tensão de toque (touch voltage)
    Em: float           # Tensão de malha calculada (V)
    Etolerable: float   # Tensão de toque tolerável (V)
    touch_safe: bool    # Critério de segurança de toque

    # Tensão de passo (step voltage)
    Es: float           # Tensão de passo calculada (V)
    Estolerable: float  # Tensão de passo tolerável (V)
    step_safe: bool     # Critério de segurança de passo

    # Fatores geométricos
    Km: float           # Fator geométrico de espaçamento (toque)
    Ks: float           # Fator geométrico de passo
    Ki: float           # Fator de irregularidade

    # Comprimento efetivo
    Lm: float           # Comprimento efetivo para tensão de toque (m)
    Ls: float           # Comprimento efetivo para tensão de passo (m)

    # Status geral
    safe: bool


def calculate_Cs(rho: float, rho_surface: float, hs: float) -> float:
    """
    Calcula o fator de redução da camada superficial (Cs).
    IEEE 80 - Eq. (27): aproximação de Laurent e Niemann.

    Cs ≈ 1 - 0.09 * (1 - rho/rho_s) / (2*hs + 0.09)

    Args:
        rho:          resistividade do solo nativo (Ω·m)
        rho_surface:  resistividade da camada superficial (Ω·m)
        hs:           espessura da camada superficial (m)

    Returns:
        Cs: fator de redução (≤ 1.0)
    """
    if rho_surface <= 0 or hs <= 0:
        return 1.0

    Cs = 1.0 - (0.09 * (1.0 - rho / rho_surface)) / (2.0 * hs + 0.09)
    return max(0.0, min(1.0, Cs))


def calculate_body_current(t: float, weight_kg: float = 70.0) -> float:
    """
    Corrente de fibrilation ventricular tolerável (IEEE 80 - Eq. 1).

    Para 50 kg:  Ib = 0.116 / sqrt(t)
    Para 70 kg:  Ib = 0.157 / sqrt(t)

    Args:
        t:         duração da falta (s)
        weight_kg: peso corporal (50 ou 70 kg)

    Returns:
        Ib: corrente máxima tolerável (A)
    """
    if t <= 0:
        raise ValueError("Duração da falta deve ser positiva.")

    k = 0.116 if weight_kg <= 50 else 0.157
    return k / np.sqrt(t)


def calculate_Km(mesh: MeshGeometry, n: float) -> float:
    """
    Fator de espaçamento geométrico para tensão de toque (Km).
    IEEE 80 - Eq. (81).

    Km = 1/(2π) * [ln(D²/(16*h*d) + (D+2h)²/(8*D*d) - h/(4*d))
                   + Kii/Kh * ln(8/(π*(2n-1)))]

    Args:
        mesh: geometria da malha
        n:    número efetivo de condutores paralelos

    Returns:
        Km: fator geométrico (adimensional)
    """
    D = max(mesh.spacing_x, mesh.spacing_y)  # espaçamento entre condutores
    h = mesh.depth
    d = mesh.conductor_diameter

    # Fator de correção para hastes (Kii)
    # Kii = 1 para malhas sem hastes em vértices, Kii < 1 com hastes
    if mesh.num_rods > 0:
        Kii = 1.0 / (2.0 * n) ** (2.0 / n)
    else:
        Kii = 1.0

    # Fator de profundidade (Kh)
    Kh = np.sqrt(1.0 + h / 1.0)  # referência h0 = 1 m (IEEE 80)

    term1 = np.log(D**2 / (16.0 * h * d) + (D + 2.0 * h)**2 / (8.0 * D * d) - h / (4.0 * d))
    term2 = (Kii / Kh) * np.log(8.0 / (np.pi * (2.0 * n - 1.0)))

    Km = (1.0 / (2.0 * np.pi)) * (term1 + term2)
    return max(0.0, Km)


def calculate_Ks(mesh: MeshGeometry, n: float) -> float:
    """
    Fator de espaçamento geométrico para tensão de passo (Ks).
    IEEE 80 - Eq. (94).

    Ks = 1/π * [1/(2h) + 1/(D+h) + 1/D * (1 - 0.5^(n-2))]

    Args:
        mesh: geometria da malha
        n:    número efetivo de condutores paralelos

    Returns:
        Ks: fator geométrico de passo (adimensional)
    """
    D = max(mesh.spacing_x, mesh.spacing_y)
    h = mesh.depth

    term1 = 1.0 / (2.0 * h)
    term2 = 1.0 / (D + h)
    term3 = (1.0 / D) * (1.0 - 0.5 ** (n - 2.0))

    Ks = (1.0 / np.pi) * (term1 + term2 + term3)
    return max(0.0, Ks)


def calculate_Ki(n: float) -> float:
    """
    Fator de irregularidade da malha (Ki).
    IEEE 80 - Eq. (89).

    Ki = 0.644 + 0.148 * n

    Args:
        n: número efetivo de condutores paralelos

    Returns:
        Ki: fator de irregularidade (adimensional)
    """
    return 0.644 + 0.148 * n


def calculate_n_effective(mesh: MeshGeometry) -> float:
    """
    Número efetivo de condutores paralelos (n) — IEEE 80 Eq. (85–88).

    n = na * nb * nc * nd

    Para geometria retangular:
      na = 2*Lc / Lp
      nb = sqrt(Lp / (4*sqrt(A)))
      nc = [Lx*Ly/A]^(0.7*A/(Lx*Ly))
      nd = 1 (para D_m ≤ (Lx²+Ly²)^0.5)

    Args:
        mesh: geometria da malha

    Returns:
        n: número efetivo
    """
    A = mesh.area
    Lx = np.sqrt(A)  # estimativa para malha quadrada
    Ly = Lx
    Lp = 2.0 * (Lx + Ly)  # perímetro
    Lc = mesh.total_length  # comprimento total de condutores

    na = 2.0 * Lc / Lp
    nb = np.sqrt(Lp / (4.0 * np.sqrt(A)))

    # nc — fator de forma para malhas não-quadradas
    exp_nc = (0.7 * A) / (Lx * Ly) if (Lx * Ly) > 0 else 1.0
    nc = (Lx * Ly / A) ** exp_nc if A > 0 else 1.0

    nd = 1.0  # simplificação: diagonal ≈ máxima distância

    n = na * nb * nc * nd
    return max(1.0, n)


def calculate_Rg(soil: SoilModel, mesh: MeshGeometry) -> float:
    """
    Resistência da malha de aterramento (Rg).
    IEEE 80 - Eq. (52) de Sverak (1979).

    Rg = rho * [ 1/(4*sqrt(A)) + 1/Lt * (1 + 1/(1 + h*sqrt(20/A))) ]

    Esta é a equação mais utilizada na prática de engenharia.

    Args:
        soil: modelo de solo
        mesh: geometria da malha

    Returns:
        Rg: resistência da malha (Ω)
    """
    rho = soil.rho
    A = mesh.area
    h = mesh.depth
    Lt = mesh.total_length + mesh.num_rods * mesh.rod_length  # comprimento total incluindo hastes

    if A <= 0 or Lt <= 0:
        raise ValueError("Área e comprimento da malha devem ser positivos.")

    term1 = 1.0 / (4.0 * np.sqrt(A))
    term2 = (1.0 / Lt) * (1.0 + 1.0 / (1.0 + h * np.sqrt(20.0 / A)))

    Rg = rho * (term1 + term2)
    return Rg


def calculate_effective_lengths(mesh: MeshGeometry) -> tuple[float, float]:
    """
    Comprimentos efetivos para cálculo de tensão de toque e passo.
    IEEE 80 - Eq. (90) e (95).

    Lm = Lc + [1.55 + 1.22*(Lr/sqrt(Lx²+Ly²))] * Lr * Nr
    Ls = 0.75*Lc + 0.85*Lr*Nr

    Returns:
        (Lm, Ls): comprimentos efetivos (m)
    """
    Lc = mesh.total_length
    Lr = mesh.rod_length
    Nr = mesh.num_rods
    Lx = np.sqrt(mesh.area)
    Ly = Lx

    diag = np.sqrt(Lx**2 + Ly**2)
    Lr_factor = (Lr / diag) if diag > 0 else 0

    Lm = Lc + (1.55 + 1.22 * Lr_factor) * Lr * Nr
    Ls = 0.75 * Lc + 0.85 * Lr * Nr

    return max(Lc, Lm), max(Lc * 0.75, Ls)


def run_ieee80_calculation(
    soil: SoilModel,
    mesh: MeshGeometry,
    fault: FaultConditions,
) -> IEEE80Results:
    """
    Executa o cálculo completo de segurança da malha conforme IEEE 80.

    Fluxo de cálculo:
    1. Resistência da malha (Rg)
    2. Corrente efetiva de malha (Ig = Ig_total * Sf * Df)
    3. GPR = Ig * Rg
    4. Correntes corporais toleráveis (Ib)
    5. Fatores geométricos (Km, Ks, Ki)
    6. Tensões toleráveis de toque e passo
    7. Tensões calculadas de toque e passo
    8. Verificação de segurança

    Args:
        soil:  modelo de solo
        mesh:  geometria da malha
        fault: condições da falta

    Returns:
        IEEE80Results com todos os resultados
    """
    # 1. Resistência da malha
    Rg = calculate_Rg(soil, mesh)

    # 2. Corrente efetiva de malha
    Ig = fault.fault_current * fault.division_factor * fault.decrement_factor

    # 3. GPR
    GPR = Ig * Rg

    # 4. Corrente corporal tolerável
    Ib_50 = calculate_body_current(fault.fault_duration, weight_kg=50)
    Ib_70 = calculate_body_current(fault.fault_duration, weight_kg=70)

    # 5. Fator de redução da camada superficial
    Cs = calculate_Cs(soil.rho, soil.rho_surface, soil.depth_surface)

    # 6. Número efetivo de condutores
    n = calculate_n_effective(mesh)

    # 7. Fatores geométricos
    Km = calculate_Km(mesh, n)
    Ks = calculate_Ks(mesh, n)
    Ki = calculate_Ki(n)

    # 8. Comprimentos efetivos
    Lm, Ls = calculate_effective_lengths(mesh)

    # 9. Tensões toleráveis (IEEE 80 - Eq. 32 e 33)
    # Etolerable_touch = (1000 + 1.5 * Cs * rho_s) * Ib
    # Etolerable_step  = (1000 + 6.0 * Cs * rho_s) * Ib
    Etolerable = (1000.0 + 1.5 * Cs * soil.rho_surface) * Ib_50
    Estolerable = (1000.0 + 6.0 * Cs * soil.rho_surface) * Ib_50

    # 10. Tensão de malha (toque) — IEEE 80 Eq. (80)
    # Em = rho * Km * Ki * Ig / Lm
    Em = (soil.rho * Km * Ki * Ig) / Lm if Lm > 0 else 0.0

    # 11. Tensão de passo — IEEE 80 Eq. (92)
    # Es = rho * Ks * Ki * Ig / Ls
    Es = (soil.rho * Ks * Ki * Ig) / Ls if Ls > 0 else 0.0

    # 12. Verificação de segurança
    touch_safe = Em <= Etolerable
    step_safe = Es <= Estolerable
    safe = touch_safe and step_safe

    return IEEE80Results(
        Rg=Rg,
        Ig=Ig,
        GPR=GPR,
        Ib_50kg=Ib_50,
        Ib_70kg=Ib_70,
        Cs=Cs,
        Em=Em,
        Etolerable=Etolerable,
        touch_safe=touch_safe,
        Es=Es,
        Estolerable=Estolerable,
        step_safe=step_safe,
        Km=Km,
        Ks=Ks,
        Ki=Ki,
        Lm=Lm,
        Ls=Ls,
        safe=safe,
    )
