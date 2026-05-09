"""
Módulo de Análise de Solo
=========================
Estratificação de solo a partir de ensaios de campo:
  - Método de Wenner (4 eletrodos equidistantes)
  - Método de Schlumberger (eletrodos de corrente afastados)

Estratificação por otimização não-linear (scipy.optimize).
Modelo de Sunde para solo de 2 camadas.

FÓRMULA WENNER:
  rho_a = 2 * pi * a * R
  onde: a = espaçamento dos eletrodos, R = resistência medida

MODELO 2 CAMADAS (Sunde):
  rho_a(a) = rho1 * [1 + 4*sum_{n=1}^{inf} (k^n / sqrt(1+(2*n*h/a)^2) - k^n / sqrt(4+(2*n*h/a)^2))]
  onde: k = (rho2 - rho1)/(rho2 + rho1)  — coeficiente de reflexão
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional
from scipy.optimize import minimize, curve_fit
from scipy.stats import linregress


@dataclass
class WennerMeasurement:
    """Medição individual pelo método de Wenner."""
    spacing: float       # Espaçamento a (m)
    resistance: float    # Resistência medida R (Ω)

    @property
    def apparent_resistivity(self) -> float:
        """rho_a = 2π·a·R"""
        return 2.0 * np.pi * self.spacing * self.resistance


@dataclass
class SchlumbergerMeasurement:
    """Medição individual pelo método de Schlumberger."""
    L: float     # Meia-distância entre eletrodos de corrente (m)
    a: float     # Meia-distância entre eletrodos de potencial (m)
    resistance: float  # Resistência medida R (Ω)

    @property
    def apparent_resistivity(self) -> float:
        """rho_a = π*(L²-a²)/(2*a) * R"""
        return np.pi * (self.L**2 - self.a**2) / (2.0 * self.a) * self.resistance


@dataclass
class TwoLayerSoil:
    """Modelo de solo de 2 camadas."""
    rho1: float   # Resistividade da camada 1 (Ω·m)
    rho2: float   # Resistividade da camada 2 (Ω·m)
    h1: float     # Espessura da camada 1 (m)

    @property
    def k(self) -> float:
        """Coeficiente de reflexão entre camadas."""
        return (self.rho2 - self.rho1) / (self.rho2 + self.rho1)

    def equivalent_rho(self, depth: float = 0.5) -> float:
        """Resistividade equivalente para cálculo de malha rasa (IEEE 80)."""
        # Para malha a profundidade 'depth', usa rho1 se depth < h1, else rho2
        if depth <= self.h1:
            return self.rho1
        # Ponderação por profundidade
        w = self.h1 / depth
        return self.rho1 * w + self.rho2 * (1.0 - w)


def wenner_apparent_resistivity(measurements: list[WennerMeasurement]) -> tuple[list, list]:
    """Converte medições Wenner em curva de resistividade aparente."""
    spacings = [m.spacing for m in measurements]
    rhos = [m.apparent_resistivity for m in measurements]
    return spacings, rhos


def sunde_two_layer_model(a: float, rho1: float, rho2: float, h1: float, n_terms: int = 10) -> float:
    """
    Resistividade aparente pelo modelo de 2 camadas de Sunde.
    Série infinita truncada em n_terms termos.

    Args:
        a:       espaçamento do eletrodo (m)
        rho1:    resistividade camada 1 (Ω·m)
        rho2:    resistividade camada 2 (Ω·m)
        h1:      espessura camada 1 (m)
        n_terms: número de termos da série

    Returns:
        rho_a: resistividade aparente (Ω·m)
    """
    k = (rho2 - rho1) / (rho2 + rho1)

    soma = 0.0
    for n in range(1, n_terms + 1):
        kn = k ** n
        nh_a = (2.0 * n * h1) / a
        t1 = kn / np.sqrt(1.0 + nh_a**2)
        t2 = kn / np.sqrt(4.0 + nh_a**2)
        soma += (t1 - t2)

    return rho1 * (1.0 + 4.0 * soma)


def fit_two_layer_model(
    spacings: list[float],
    rho_apparent: list[float],
) -> TwoLayerSoil:
    """
    Ajusta modelo de 2 camadas aos dados de ensaio por mínimos quadrados.

    Usa scipy.optimize.minimize com método L-BFGS-B para garantir
    valores fisicamente plausíveis (positividade de rho1, rho2, h1).

    Args:
        spacings:     espaçamentos dos eletrodos (m)
        rho_apparent: resistividades aparentes medidas (Ω·m)

    Returns:
        TwoLayerSoil com parâmetros ajustados
    """
    spacings_arr = np.array(spacings)
    rho_arr = np.array(rho_apparent)

    # Estimativas iniciais heurísticas
    rho1_0 = rho_arr[0] if len(rho_arr) > 0 else 100.0
    rho2_0 = rho_arr[-1] if len(rho_arr) > 0 else 100.0
    h1_0 = spacings_arr[len(spacings_arr) // 2] if len(spacings_arr) > 0 else 2.0

    def residual(params):
        rho1, rho2, h1 = params
        if rho1 <= 0 or rho2 <= 0 or h1 <= 0:
            return 1e12
        predicted = np.array([sunde_two_layer_model(a, rho1, rho2, h1) for a in spacings_arr])
        return np.sum((np.log(predicted) - np.log(rho_arr))**2)

    result = minimize(
        residual,
        x0=[rho1_0, rho2_0, h1_0],
        method='L-BFGS-B',
        bounds=[(1.0, 100000.0), (1.0, 100000.0), (0.1, 100.0)],
        options={'maxiter': 1000, 'ftol': 1e-10},
    )

    rho1, rho2, h1 = result.x
    return TwoLayerSoil(rho1=rho1, rho2=rho2, h1=h1)


def analyze_wenner(measurements: list[dict]) -> dict:
    """
    Analisa ensaio Wenner completo.

    Args:
        measurements: lista de {'spacing': float, 'resistance': float}

    Returns:
        dict com curva, modelo ajustado e resistividade equivalente
    """
    wenner_list = [WennerMeasurement(**m) for m in measurements]
    spacings, rhos = wenner_apparent_resistivity(wenner_list)

    # Ajustar modelo de 2 camadas
    model = fit_two_layer_model(spacings, rhos)

    # Curva do modelo ajustado
    spacings_fine = np.linspace(min(spacings), max(spacings), 100)
    rhos_fitted = [sunde_two_layer_model(a, model.rho1, model.rho2, model.h1) for a in spacings_fine]

    # Resistividade equivalente para cálculo (usa camada 1 para malhas rasas)
    rho_equiv = model.rho1

    return {
        "spacings": spacings,
        "rho_apparent": rhos,
        "model": {
            "rho1": round(model.rho1, 2),
            "rho2": round(model.rho2, 2),
            "h1": round(model.h1, 3),
            "k": round(model.k, 4),
        },
        "fitted_curve": {
            "spacings": spacings_fine.tolist(),
            "rhos": rhos_fitted,
        },
        "rho_equivalent": round(rho_equiv, 2),
    }


def analyze_schlumberger(measurements: list[dict]) -> dict:
    """
    Analisa ensaio Schlumberger completo.

    Args:
        measurements: lista de {'L': float, 'a': float, 'resistance': float}

    Returns:
        dict com curva e modelo ajustado
    """
    schlumberger_list = [SchlumbergerMeasurement(**m) for m in measurements]
    Ls = [m.L for m in schlumberger_list]
    rhos = [m.apparent_resistivity for m in schlumberger_list]

    model = fit_two_layer_model(Ls, rhos)

    Ls_fine = np.linspace(min(Ls), max(Ls), 100)
    rhos_fitted = [sunde_two_layer_model(L, model.rho1, model.rho2, model.h1) for L in Ls_fine]

    return {
        "Ls": Ls,
        "rho_apparent": rhos,
        "model": {
            "rho1": round(model.rho1, 2),
            "rho2": round(model.rho2, 2),
            "h1": round(model.h1, 3),
            "k": round(model.k, 4),
        },
        "fitted_curve": {
            "Ls": Ls_fine.tolist(),
            "rhos": rhos_fitted,
        },
        "rho_equivalent": round(model.rho1, 2),
    }
