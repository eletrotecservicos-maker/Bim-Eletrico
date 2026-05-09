"""Engine de cálculo: IEEE 80, análise de solo, campo de potencial."""
from .ieee80 import run_ieee80_calculation, SoilModel, MeshGeometry, FaultConditions
from .soil_analysis import analyze_wenner, analyze_schlumberger
from .potential_field import generate_heatmap_data
