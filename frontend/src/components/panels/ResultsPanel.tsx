/**
 * Painel de Resultados — Exibe todos os resultados do cálculo IEEE 80.
 * Com indicadores visuais de segurança, tabelas e alertas.
 */
'use client';

import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { reportsApi } from '@/lib/api';

export default function ResultsPanel() {
  const { calculationResult, activeProject, activeScenario, isCalculating, runCalculation } = useProjectStore();
  const { setViewMode } = useUiStore();

  if (isCalculating) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full gap-3">
        <div className="w-10 h-10 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-muted calculating">Executando análise IEEE 80...</p>
      </div>
    );
  }

  if (!calculationResult) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-background-border flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-text-secondary">Nenhum resultado disponível.</p>
          <p className="text-xs text-text-muted mt-1">Configure solo e malha, depois clique em Calcular.</p>
        </div>
        <button onClick={runCalculation} className="btn-primary text-sm">
          Calcular Agora
        </button>
      </div>
    );
  }

  const r = calculationResult;

  const handleDownloadPdf = async () => {
    if (!activeProject || !activeScenario) return;
    try {
      const blob = await reportsApi.generatePdf(activeProject.id, activeScenario.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aterramento_${activeProject.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // toast error
    }
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Status geral */}
      <div className={`rounded-lg p-3 border ${
        r.safe
          ? 'bg-status-safe/10 border-status-safe/40'
          : 'bg-status-danger/10 border-status-danger/40'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2.5 h-2.5 rounded-full ${r.safe ? 'bg-status-safe-light' : 'bg-status-danger-light'}`} />
          <span className={`text-sm font-bold ${r.safe ? 'text-status-safe-light' : 'text-status-danger-light'}`}>
            {r.safe ? 'MALHA APROVADA' : 'MALHA REPROVADA'}
          </span>
        </div>
        <p className="text-[10px] text-text-muted">
          Verificação conforme IEEE Std 80 - 2013
        </p>
      </div>

      {/* Resultados principais */}
      <div className="panel-section">
        <p className="panel-section-title">Resultados Principais</p>
        <div className="space-y-1.5">
          <ResultRow label="Rg — Resistência da Malha" value={r.Rg} unit="Ω" decimals={4} />
          <ResultRow label="Ig — Corrente Efetiva" value={r.Ig} unit="A" decimals={1} />
          <ResultRow label="GPR — Ground Potential Rise" value={r.GPR} unit="V" decimals={1} accent />
        </div>
      </div>

      {/* Tensão de toque */}
      <div className="panel-section">
        <p className="panel-section-title">Tensão de Toque</p>
        <div className="space-y-1.5">
          <ResultRow label="Em (calculada)" value={r.Em} unit="V" decimals={2} />
          <ResultRow label="Etol (tolerável)" value={r.Etolerable} unit="V" decimals={2} />
          <div className={`flex items-center justify-between p-2 rounded text-xs font-semibold ${
            r.touch_safe
              ? 'bg-status-safe/10 text-status-safe-light'
              : 'bg-status-danger/10 text-status-danger-light'
          }`}>
            <span>Em ≤ Etol?</span>
            <span>{r.touch_safe ? `✓ ${r.Em.toFixed(1)} ≤ ${r.Etolerable.toFixed(1)} V` : `✗ ${r.Em.toFixed(1)} > ${r.Etolerable.toFixed(1)} V`}</span>
          </div>
        </div>
      </div>

      {/* Tensão de passo */}
      <div className="panel-section">
        <p className="panel-section-title">Tensão de Passo</p>
        <div className="space-y-1.5">
          <ResultRow label="Es (calculada)" value={r.Es} unit="V" decimals={2} />
          <ResultRow label="Estol (tolerável)" value={r.Estolerable} unit="V" decimals={2} />
          <div className={`flex items-center justify-between p-2 rounded text-xs font-semibold ${
            r.step_safe
              ? 'bg-status-safe/10 text-status-safe-light'
              : 'bg-status-danger/10 text-status-danger-light'
          }`}>
            <span>Es ≤ Estol?</span>
            <span>{r.step_safe ? `✓ ${r.Es.toFixed(1)} ≤ ${r.Estolerable.toFixed(1)} V` : `✗ ${r.Es.toFixed(1)} > ${r.Estolerable.toFixed(1)} V`}</span>
          </div>
        </div>
      </div>

      {/* Fatores geométricos */}
      <div className="panel-section">
        <p className="panel-section-title">Fatores Geométricos (IEEE 80)</p>
        <div className="space-y-1.5">
          <ResultRow label="Km (toque)" value={r.Km} unit="" decimals={4} />
          <ResultRow label="Ks (passo)" value={r.Ks} unit="" decimals={4} />
          <ResultRow label="Ki (irregularidade)" value={r.Ki} unit="" decimals={4} />
          <ResultRow label="Cs (redução superficial)" value={r.Cs} unit="" decimals={4} />
          <ResultRow label="Lm efetivo" value={r.Lm} unit="m" decimals={2} />
          <ResultRow label="Ls efetivo" value={r.Ls} unit="m" decimals={2} />
        </div>
      </div>

      {/* Correntes corporais */}
      <div className="panel-section">
        <p className="panel-section-title">Corrente Corporal Tolerável</p>
        <div className="space-y-1.5">
          <ResultRow label="Ib (50 kg)" value={r.Ib_50kg * 1000} unit="mA" decimals={2} />
          <ResultRow label="Ib (70 kg)" value={r.Ib_70kg * 1000} unit="mA" decimals={2} />
        </div>
      </div>

      {/* Alertas */}
      {!r.safe && (
        <div className="p-3 bg-status-warning/10 border border-status-warning/40 rounded space-y-1.5">
          <p className="text-xs font-semibold text-status-warning-light">Recomendações de Adequação:</p>
          <ul className="text-[10px] text-text-secondary space-y-1 list-disc list-inside">
            {!r.touch_safe && <li>Reduzir espaçamento entre condutores (Dx, Dy)</li>}
            {!r.touch_safe && <li>Aumentar área da malha</li>}
            {!r.step_safe && <li>Adicionar hastes verticais nas bordas</li>}
            <li>Usar brita na camada superficial (ρs ≥ 3000 Ω·m)</li>
            <li>Revisar fator de divisão de corrente (Sf)</li>
          </ul>
        </div>
      )}

      {/* Botões de ação */}
      <div className="space-y-2">
        <button
          onClick={() => setViewMode('heatmap')}
          className="w-full btn-secondary text-xs py-2"
        >
          Ver Heatmap de Potencial
        </button>
        <button
          onClick={handleDownloadPdf}
          className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar Relatório PDF
        </button>
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, decimals, accent }: {
  label: string; value: number; unit: string; decimals: number; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-secondary">{label}</span>
      <span className={`text-xs font-mono ${accent ? 'text-accent-blue-light font-semibold' : 'text-text-primary'}`}>
        {value.toFixed(decimals)} {unit}
      </span>
    </div>
  );
}
