/**
 * Controles sobrepostos no viewport 3D — botões de câmera, camadas, etc.
 */
'use client';

import { useUiStore } from '@/store/uiStore';

export default function ViewportControls() {
  const {
    showGrid, toggleGrid,
    showAxes, toggleAxes,
    showSoilLayer, toggleSoilLayer,
    showLabels, toggleLabels,
    cameraPreset, setCameraPreset,
  } = useUiStore();

  return (
    <>
      {/* Controles de câmera — canto superior direito */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <div className="bg-background-secondary/90 border border-background-border rounded overflow-hidden">
          {(['perspective', 'top', 'front', 'side'] as const).map(preset => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              className={`
                block w-full px-3 py-1 text-[10px] font-mono text-left transition-colors
                ${cameraPreset === preset
                  ? 'bg-accent-blue text-white'
                  : 'text-text-muted hover:bg-background-surface hover:text-text-primary'
                }
              `}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Controles de camadas — canto inferior direito */}
      <div className="absolute bottom-8 right-3 flex flex-col gap-1">
        <div className="bg-background-secondary/90 border border-background-border rounded p-2 space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-1">Camadas</p>
          {[
            { label: 'Grid', value: showGrid, toggle: toggleGrid },
            { label: 'Eixos', value: showAxes, toggle: toggleAxes },
            { label: 'Solo', value: showSoilLayer, toggle: toggleSoilLayer },
          ].map(({ label, value, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className="flex items-center gap-2 w-full text-[10px] text-text-secondary hover:text-text-primary transition-colors"
            >
              <div className={`w-3 h-3 rounded-sm border transition-colors ${value ? 'bg-accent-blue border-accent-blue' : 'border-background-border'}`} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
