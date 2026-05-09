/**
 * Visualização de Heatmap 2D — Campo de potencial na superfície do solo.
 * Renderiza usando Canvas 2D com gradiente de cores técnico.
 *
 * Paleta de cores:
 *   Azul escuro (baixo potencial) → Cyan → Verde → Amarelo → Laranja → Vermelho (alto)
 */
'use client';

import { useRef, useEffect, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import type { HeatmapData } from '@/lib/types';

// Mapa de cores técnico (azul → vermelho)
const COLORMAP = [
  [10, 35, 100],    // azul escuro
  [21, 101, 192],   // azul
  [0, 188, 212],    // cyan
  [76, 175, 80],    // verde
  [255, 235, 59],   // amarelo
  [255, 152, 0],    // laranja
  [244, 67, 54],    // vermelho
  [183, 28, 28],    // vermelho escuro
];

function interpolateColor(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (COLORMAP.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const c1 = COLORMAP[Math.min(i, COLORMAP.length - 1)];
  const c2 = COLORMAP[Math.min(i + 1, COLORMAP.length - 1)];
  return [
    Math.round(c1[0] + f * (c2[0] - c1[0])),
    Math.round(c1[1] + f * (c2[1] - c1[1])),
    Math.round(c1[2] + f * (c2[2] - c1[2])),
  ];
}

export default function HeatmapView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { calculationResult } = useProjectStore();
  const { heatmapType, setHeatmapType } = useUiStore();
  const [hoveredValue, setHoveredValue] = useState<{ x: number; y: number; v: number } | null>(null);

  const heatmap = calculationResult?.heatmap;

  useEffect(() => {
    if (!heatmap || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    canvas.width = W;
    canvas.height = H;

    // Selecionar dados baseado no tipo
    let data: number[][];
    let dataMax: number;
    let dataMin = 0;

    if (heatmapType === 'potential') {
      data = heatmap.potential as unknown as number[][];
      dataMax = heatmap.V_max;
      dataMin = heatmap.V_min;
    } else if (heatmapType === 'touch') {
      data = heatmap.touch_voltage as unknown as number[][];
      dataMax = heatmap.Et_max;
    } else {
      data = heatmap.step_voltage as unknown as number[][];
      dataMax = heatmap.Es_max;
    }

    const rows = data.length;
    const cols = data[0]?.length || 0;
    if (rows === 0 || cols === 0) return;

    // Renderizar pixel a pixel com interpolação bilinear
    const cellW = W / cols;
    const cellH = H / rows;

    const imageData = ctx.createImageData(W, H);
    const pixels = imageData.data;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const col = Math.min(Math.floor(px / cellW), cols - 1);
        const row = Math.min(Math.floor((H - py) / cellH), rows - 1); // Y invertido

        const v = data[row]?.[col] ?? 0;
        const t = dataMax > dataMin ? (v - dataMin) / (dataMax - dataMin) : 0;
        const [r, g, b] = interpolateColor(t);

        const i = (py * W + px) * 4;
        pixels[i]     = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 220;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Desenhar curvas equipotenciais (contornos)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    const nContours = 10;
    for (let k = 1; k < nContours; k++) {
      const threshold = dataMin + (dataMax - dataMin) * (k / nContours);
      // Contornos simples por comparação de vizinhos
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          const v00 = data[row]?.[col] ?? 0;
          const v01 = data[row]?.[col + 1] ?? 0;
          const v10 = data[row + 1]?.[col] ?? 0;
          if ((v00 < threshold) !== (v01 < threshold) || (v00 < threshold) !== (v10 < threshold)) {
            const px = (col + 0.5) * cellW;
            const py = H - (row + 0.5) * cellH;
            ctx.beginPath();
            ctx.arc(px, py, 1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // Label de GPR
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`GPR: ${heatmap.GPR.toFixed(1)} V`, 12, 20);
    ctx.fillText(`Máx: ${dataMax.toFixed(1)} V`, 12, 34);
    ctx.fillText(`Mín: ${dataMin.toFixed(1)} V`, 12, 48);

  }, [heatmap, heatmapType]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!heatmap || !containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = 1 - (e.clientY - rect.top) / rect.height;

    let data: number[][];
    if (heatmapType === 'potential') data = heatmap.potential as unknown as number[][];
    else if (heatmapType === 'touch') data = heatmap.touch_voltage as unknown as number[][];
    else data = heatmap.step_voltage as unknown as number[][];

    const rows = data.length;
    const cols = data[0]?.length || 0;
    const col = Math.min(Math.floor(px * cols), cols - 1);
    const row = Math.min(Math.floor(py * rows), rows - 1);
    const v = data[row]?.[col] ?? 0;

    const xs = heatmap.x as unknown as number[];
    const ys = heatmap.y as unknown as number[];

    setHoveredValue({
      x: xs[col] ?? 0,
      y: ys[row] ?? 0,
      v,
    });
  };

  if (!calculationResult) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl opacity-20">🌡</div>
          <p className="text-text-muted text-sm">Execute o cálculo para visualizar o heatmap de potencial.</p>
        </div>
      </div>
    );
  }

  if (!heatmap) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-text-muted text-sm">Heatmap não disponível. Reexecute o cálculo com geração de heatmap ativada.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-background-primary">
      {/* Canvas principal */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredValue(null)}
      />

      {/* Seletor de tipo de heatmap */}
      <div className="absolute top-3 left-3 flex gap-1 bg-background-secondary/90 border border-background-border rounded p-1">
        {([
          { key: 'potential', label: 'Potencial (V)' },
          { key: 'touch', label: 'V. Toque (V)' },
          { key: 'step', label: 'V. Passo (V)' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setHeatmapType(key)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              heatmapType === key
                ? 'bg-accent-blue text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legenda de escala de cores */}
      <div className="absolute bottom-8 right-4 w-5 flex flex-col items-center gap-1">
        <span className="text-[9px] font-mono text-text-muted">
          {heatmapType === 'potential' ? heatmap.V_max.toFixed(0)
           : heatmapType === 'touch' ? heatmap.Et_max.toFixed(0)
           : heatmap.Es_max.toFixed(0)}V
        </span>
        <div className="w-4 h-32 rounded" style={{
          background: 'linear-gradient(to bottom, #B71C1C, #FF9800, #FFEB3B, #4CAF50, #00BCD4, #1565C0, #0A237E)',
        }} />
        <span className="text-[9px] font-mono text-text-muted">0V</span>
      </div>

      {/* Tooltip ao hover */}
      {hoveredValue && (
        <div className="absolute top-3 right-3 bg-background-secondary/95 border border-background-border rounded px-3 py-2 text-xs font-mono space-y-1">
          <div className="text-text-muted">Posição</div>
          <div>X: <span className="text-text-primary">{hoveredValue.x.toFixed(1)} m</span></div>
          <div>Y: <span className="text-text-primary">{hoveredValue.y.toFixed(1)} m</span></div>
          <div className="border-t border-background-border pt-1 mt-1">
            Valor: <span className="text-accent-blue-light font-semibold">{hoveredValue.v.toFixed(2)} V</span>
          </div>
        </div>
      )}
    </div>
  );
}
