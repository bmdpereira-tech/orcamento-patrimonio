"use client";

import type { HistoricalImpactRequiredActionResult } from "@/domain/budget/historical-impact";

export type HistoricalImpactPrompt = Pick<
  HistoricalImpactRequiredActionResult,
  "firstAffectedMonth" | "message"
> & {
  isApplying?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function cloneFormData(formData: FormData) {
  const nextFormData = new FormData();

  for (const [key, value] of formData.entries()) {
    nextFormData.append(key, value);
  }

  return nextFormData;
}

export function withHistoricalImpactConfirmation(formData: FormData) {
  const nextFormData = cloneFormData(formData);
  nextFormData.set("confirmHistoricalImpact", "true");

  return nextFormData;
}

export function HistoricalImpactModal({ prompt }: { prompt: HistoricalImpactPrompt | null }) {
  if (!prompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="historical-impact-title"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="historical-impact-title" className="text-base font-semibold text-slate-950">
          Confirmar alteração histórica
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{prompt.message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={prompt.isApplying}
            onClick={prompt.onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={prompt.isApplying}
            onClick={prompt.onConfirm}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
          >
            {prompt.isApplying ? "A aplicar..." : "Aplicar alteração"}
          </button>
        </div>
      </section>
    </div>
  );
}
