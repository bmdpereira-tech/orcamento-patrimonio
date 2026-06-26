"use client";

import { Archive, ChevronDown, ChevronUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isHistoricalImpactActionResult,
  type HistoricalActionResult,
  type HistoricalImpactRequiredActionResult,
} from "@/domain/budget/historical-impact";
import { formatEditableEuroCents, formatEuroCents } from "@/domain/budget/money";
import { cn } from "@/lib/cn";
import type {
  InvestmentAssetOverview,
  InvestmentTimelineEntry,
  ManagedInvestmentAsset,
  ManagedInvestmentCashFlow,
  ManagedInvestmentValuation,
} from "@/server/budget/investments";
import {
  HistoricalImpactModal,
  type HistoricalImpactPrompt,
  withHistoricalImpactConfirmation,
} from "./historical-impact-modal";

type InvestmentActionResult =
  | HistoricalActionResult<{ status: string; asset: ManagedInvestmentAsset }>
  | HistoricalActionResult<{ status: string; cashFlow: ManagedInvestmentCashFlow }>
  | HistoricalActionResult<{ status: string; valuation: ManagedInvestmentValuation }>
  | HistoricalActionResult<{ status: string }>;

type InvestmentAction = (formData: FormData) => Promise<InvestmentActionResult>;

type InvestmentManagementProps = {
  overview: {
    asOfDate: string;
    assets: InvestmentAssetOverview[];
    globalMetrics: InvestmentAssetOverview["metrics"];
  };
  createAssetAction: InvestmentAction;
  updateAssetAction: InvestmentAction;
  archiveAssetAction: InvestmentAction;
  reactivateAssetAction: InvestmentAction;
  deleteAssetAction: InvestmentAction;
  createCashFlowAction: InvestmentAction;
  updateCashFlowAction: InvestmentAction;
  deleteCashFlowAction: InvestmentAction;
  createValuationAction: InvestmentAction;
  updateValuationAction: InvestmentAction;
  deleteValuationAction: InvestmentAction;
};

const statusMessages: Record<string, string> = {
  created: "Registo criado com sucesso.",
  updated: "Registo actualizado com sucesso.",
  archived: "Investimento arquivado com sucesso.",
  reactivated: "Investimento reactivado com sucesso.",
  deleted: "Registo eliminado com sucesso.",
  "delete-blocked": "O investimento tem fluxos ou valorizações e não foi eliminado. Podes arquivá-lo.",
};

function inputClassName(className = "") {
  return `h-8 min-h-8 w-full rounded-md border-slate-300 px-2 py-1 text-sm leading-5 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function compactInputClassName(className = "") {
  return `h-7 min-h-7 w-full rounded-md border-slate-300 px-2 py-0.5 text-sm leading-5 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function compactSelectClassName(className = "") {
  return `h-8 min-h-8 w-full rounded-md border-slate-300 px-2 py-1 text-sm leading-5 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function actionButtonClassName(tone: "primary" | "muted" | "danger" = "muted") {
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    muted: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };

  return `inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold shadow-sm disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`;
}

function compactActionButtonClassName(tone: "primary" | "muted" | "danger" = "muted") {
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    muted: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };

  return `inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold shadow-sm disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("pt-PT", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNullableEuroCents(value: number | null) {
  return value === null ? "–" : formatEuroCents(value);
}

function formatDateLabel(date: string | null | undefined) {
  if (!date) {
    return "–";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function simpleFormData(id: string) {
  const formData = new FormData();
  formData.set("id", id);

  return formData;
}

function metricItems(metrics: InvestmentAssetOverview["metrics"]) {
  return [
    ["Entregue", formatEuroCents(metrics.totalContributedCents)],
    ["Resgatado", formatEuroCents(metrics.totalRedeemedCents)],
    ["Capital líquido", formatEuroCents(metrics.netInvestedCents)],
    ["Valor mercado", formatNullableEuroCents(metrics.marketValueCents)],
    ["Ganho/perda", formatNullableEuroCents(metrics.gainLossCents)],
    ["Rentabilidade", formatPercent(metrics.simpleReturn)],
    ["XIRR", formatPercent(metrics.xirr)],
  ] as const;
}

function MetricsGrid({ metrics }: { metrics: InvestmentAssetOverview["metrics"] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {metricItems(metrics).map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TimelineKindLabel({ entry }: { entry: InvestmentTimelineEntry }) {
  if (entry.kind === "valuation") {
    return <span className="font-medium text-brand-700">Valorização</span>;
  }

  return (
    <span className={entry.flowType === "contribution" ? "font-medium text-red-700" : "font-medium text-emerald-700"}>
      {entry.flowType === "contribution" ? "Entrega" : "Resgate"}
    </span>
  );
}

export function InvestmentManagement({
  overview,
  createAssetAction,
  updateAssetAction,
  archiveAssetAction,
  reactivateAssetAction,
  deleteAssetAction,
  createCashFlowAction,
  updateCashFlowAction,
  deleteCashFlowAction,
  createValuationAction,
  updateValuationAction,
  deleteValuationAction,
}: InvestmentManagementProps) {
  const router = useRouter();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historicalPrompt, setHistoricalPrompt] = useState<HistoricalImpactPrompt | null>(null);
  const [expandedAssetIds, setExpandedAssetIds] = useState<ReadonlySet<string>>(() => new Set());
  const nextSortOrder =
    overview.assets.length > 0
      ? Math.max(...overview.assets.map((asset) => asset.sortOrder)) + 10
      : 10;

  const finishSuccessfulAction = useCallback(
    (status: string) => {
      setMessage(statusMessages[status] ?? "Alteração guardada com sucesso.");
      setError(null);
      setPendingActionId(null);
      router.refresh();
    },
    [router],
  );

  const openHistoricalConfirmation = useCallback(
    (
      impact: HistoricalImpactRequiredActionResult,
      handlers: {
        onCancel: () => void;
        onConfirm: () => Promise<void>;
      },
    ) => {
      setHistoricalPrompt({
        firstAffectedMonth: impact.firstAffectedMonth,
        message: impact.message,
        onCancel: () => {
          handlers.onCancel();
          setHistoricalPrompt(null);
        },
        onConfirm: () => {
          setHistoricalPrompt((current) => (current ? { ...current, isApplying: true } : current));
          void handlers.onConfirm().finally(() => {
            setHistoricalPrompt(null);
          });
        },
      });
    },
    [],
  );

  const runInvestmentAction = useCallback(
    async ({
      action,
      formData,
      pendingId,
      form,
    }: {
      action: InvestmentAction;
      formData: FormData;
      pendingId: string;
      form?: HTMLFormElement;
    }) => {
      setPendingActionId(pendingId);
      setMessage(null);
      setError(null);

      const result = await action(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setPendingActionId(null);
            router.refresh();
          },
          onConfirm: async () => {
            setPendingActionId(pendingId);
            const confirmedResult = await action(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setError(confirmedResult.message);
              setPendingActionId(null);
              router.refresh();
              return;
            }

            if (!confirmedResult.ok) {
              setError(confirmedResult.error);
              setPendingActionId(null);
              router.refresh();
              return;
            }

            form?.reset();
            finishSuccessfulAction(confirmedResult.status);
          },
        });
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setPendingActionId(null);
        return;
      }

      form?.reset();
      finishSuccessfulAction(result.status);
    },
    [finishSuccessfulAction, openHistoricalConfirmation, router],
  );

  const submitFormAction = useCallback(
    (event: React.FormEvent<HTMLFormElement>, action: InvestmentAction, pendingId: string, resetOnSuccess = false) => {
      event.preventDefault();
      const form = event.currentTarget;

      void runInvestmentAction({
        action,
        formData: new FormData(form),
        pendingId,
        form: resetOnSuccess ? form : undefined,
      });
    },
    [runInvestmentAction],
  );

  const runSimpleAction = useCallback(
    (id: string, action: InvestmentAction, pendingId: string) => {
      void runInvestmentAction({
        action,
        formData: simpleFormData(id),
        pendingId,
      });
    },
    [runInvestmentAction],
  );

  const toggleAssetDetail = useCallback((assetId: string) => {
    setExpandedAssetIds((current) => {
      const next = new Set(current);

      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }

      return next;
    });
  }, []);

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Resumo global</h2>
            <p className="text-xs text-slate-500">Valores elegíveis até {formatDateLabel(overview.asOfDate)}</p>
          </div>
        </div>
        <MetricsGrid metrics={overview.globalMetrics} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(event) => submitFormAction(event, createAssetAction, "asset:new", true)}
          className="grid gap-3 lg:grid-cols-[1fr_1.4fr_0.45fr_0.35fr_auto] lg:items-end"
        >
          <div>
            <label htmlFor="new-investment-name" className="text-xs font-semibold uppercase text-slate-500">
              Nome
            </label>
            <input id="new-investment-name" name="name" required className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-investment-description" className="text-xs font-semibold uppercase text-slate-500">
              Descrição
            </label>
            <input id="new-investment-description" name="description" className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-investment-start-month" className="text-xs font-semibold uppercase text-slate-500">
              Início
            </label>
            <input
              id="new-investment-start-month"
              name="startMonth"
              type="month"
              defaultValue={overview.asOfDate.slice(0, 7)}
              required
              className={inputClassName("mt-1")}
            />
          </div>
          <div>
            <label htmlFor="new-investment-order" className="text-xs font-semibold uppercase text-slate-500">
              Ordem
            </label>
            <input
              id="new-investment-order"
              name="sortOrder"
              type="number"
              defaultValue={nextSortOrder}
              className={inputClassName("mt-1")}
            />
          </div>
          <button
            type="submit"
            disabled={pendingActionId === "asset:new"}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar investimento
          </button>
        </form>
      </section>

      {overview.assets.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          Ainda não existem investimentos.
        </section>
      ) : (
        overview.assets.map((asset) => {
          const assetPending = pendingActionId?.startsWith(asset.id);
          const latestValuation = asset.metrics.latestValuation;
          const assetFormId = `investment-asset-${asset.id}`;
          const detailId = `investment-detail-${asset.id}`;
          const detailExpanded = expandedAssetIds.has(asset.id);

          return (
            <section key={asset.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{asset.name}</h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          asset.archivedFromMonth
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {asset.archivedFromMonth ? "Arquivado" : "Activo"}
                      </span>
                    </div>
                    {asset.description ? (
                      <p className="mt-1 max-w-3xl text-sm text-slate-600">{asset.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Última valorização: {formatNullableEuroCents(latestValuation?.marketValueCents ?? null)} em{" "}
                      {formatDateLabel(latestValuation?.valuationDate)}
                    </p>
                  </div>
                  <form
                    id={assetFormId}
                    onSubmit={(event) => submitFormAction(event, updateAssetAction, `${asset.id}:asset`)}
                    className="grid w-full gap-2 md:grid-cols-[1fr_1.4fr_0.35fr_auto] xl:max-w-4xl"
                  >
                    <input type="hidden" name="id" value={asset.id} />
                    <input type="hidden" name="startMonth" value={asset.startMonth} />
                    <input
                      name="name"
                      required
                      defaultValue={asset.name}
                      aria-label={`Nome de ${asset.name}`}
                      className={inputClassName()}
                    />
                    <input
                      name="description"
                      defaultValue={asset.description ?? ""}
                      aria-label={`Descrição de ${asset.name}`}
                      className={inputClassName()}
                    />
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={asset.sortOrder}
                      aria-label={`Ordem de ${asset.name}`}
                      className={inputClassName()}
                    />
                    <button
                      type="submit"
                      disabled={assetPending}
                      className={actionButtonClassName("primary")}
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      Guardar
                    </button>
                  </form>
                </div>
                <div className="mt-3">
                  <MetricsGrid metrics={asset.metrics} />
                </div>
              </div>

              <div className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[1fr_1fr_auto]">
                <form
                  onSubmit={(event) =>
                    submitFormAction(event, createCashFlowAction, `${asset.id}:cash-flow:new`, true)
                  }
                  className="grid gap-2 sm:grid-cols-[0.75fr_0.8fr_0.8fr_auto] sm:items-end"
                >
                  <input type="hidden" name="investmentAssetId" value={asset.id} />
                  <div>
                    <label
                      htmlFor={`new-flow-type-${asset.id}`}
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Fluxo
                    </label>
                    <select id={`new-flow-type-${asset.id}`} name="flowType" className={inputClassName("mt-1")}>
                      <option value="contribution">Entrega</option>
                      <option value="redemption">Resgate</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`new-flow-date-${asset.id}`}
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Data
                    </label>
                    <input
                      id={`new-flow-date-${asset.id}`}
                      name="flowDate"
                      type="date"
                      required
                      defaultValue={overview.asOfDate}
                      className={inputClassName("mt-1")}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`new-flow-amount-${asset.id}`}
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Valor
                    </label>
                    <input
                      id={`new-flow-amount-${asset.id}`}
                      name="amount"
                      inputMode="decimal"
                      required
                      className={inputClassName("mt-1 text-right tabular-nums")}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pendingActionId === `${asset.id}:cash-flow:new`}
                    className={actionButtonClassName("primary")}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Fluxo
                  </button>
                </form>

                <form
                  onSubmit={(event) =>
                    submitFormAction(event, createValuationAction, `${asset.id}:valuation:new`, true)
                  }
                  className="grid gap-2 sm:grid-cols-[0.8fr_0.8fr_auto] sm:items-end"
                >
                  <input type="hidden" name="investmentAssetId" value={asset.id} />
                  <div>
                    <label
                      htmlFor={`new-valuation-date-${asset.id}`}
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Data
                    </label>
                    <input
                      id={`new-valuation-date-${asset.id}`}
                      name="valuationDate"
                      type="date"
                      required
                      defaultValue={overview.asOfDate}
                      className={inputClassName("mt-1")}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`new-valuation-amount-${asset.id}`}
                      className="text-xs font-semibold uppercase text-slate-500"
                    >
                      Valor
                    </label>
                    <input
                      id={`new-valuation-amount-${asset.id}`}
                      name="amount"
                      inputMode="decimal"
                      required
                      className={inputClassName("mt-1 text-right tabular-nums")}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pendingActionId === `${asset.id}:valuation:new`}
                    className={actionButtonClassName("primary")}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Valorização
                  </button>
                </form>

                <div className="flex flex-wrap items-end justify-start gap-2 xl:justify-end">
                  {asset.archivedFromMonth ? (
                    <button
                      type="button"
                      disabled={assetPending}
                      onClick={() => runSimpleAction(asset.id, reactivateAssetAction, `${asset.id}:reactivate`)}
                      className={actionButtonClassName("primary")}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Reactivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={assetPending}
                      onClick={() => runSimpleAction(asset.id, archiveAssetAction, `${asset.id}:archive`)}
                      className={actionButtonClassName()}
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      Arquivar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={assetPending}
                    onClick={() => runSimpleAction(asset.id, deleteAssetAction, `${asset.id}:delete`)}
                    className={actionButtonClassName("danger")}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-200 px-4 py-2">
                <button
                  type="button"
                  aria-expanded={detailExpanded}
                  aria-controls={detailId}
                  onClick={() => toggleAssetDetail(asset.id)}
                  className={actionButtonClassName()}
                >
                  {detailExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {detailExpanded ? "Ocultar detalhe" : "Ver detalhe"}
                  <span className="sr-only"> de {asset.name}</span>
                </button>
              </div>

              {detailExpanded ? (
                <div id={detailId} className="overflow-x-auto">
                  {asset.timeline.length === 0 ? (
                    <p className="p-4 text-sm text-slate-700">Ainda não existem registos neste investimento.</p>
                  ) : (
                    <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-2 py-1">Data</th>
                          <th className="px-2 py-1">Tipo</th>
                          <th className="px-2 py-1 text-right">Valor</th>
                          <th className="px-2 py-1 text-right">Acções</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {asset.timeline.map((entry) => {
                          const formId = `${entry.kind}-${entry.id}`;
                          const recordPending = pendingActionId === formId;

                          if (entry.kind === "cash-flow") {
                            return (
                              <tr key={formId} className="hover:bg-slate-50">
                                <td className="px-2 py-1">
                                  <form
                                    id={formId}
                                    onSubmit={(event) =>
                                      submitFormAction(event, updateCashFlowAction, formId)
                                    }
                                  />
                                  <input form={formId} type="hidden" name="id" value={entry.id} />
                                  <input
                                    form={formId}
                                    type="hidden"
                                    name="investmentAssetId"
                                    value={entry.investmentAssetId}
                                  />
                                  <input
                                    form={formId}
                                    name="flowDate"
                                    type="date"
                                    required
                                    defaultValue={entry.date}
                                    aria-label={`Data do fluxo ${formatDateLabel(entry.date)}`}
                                    className={compactInputClassName("w-36")}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <select
                                    form={formId}
                                    name="flowType"
                                    defaultValue={entry.flowType}
                                    aria-label={`Tipo do fluxo ${formatDateLabel(entry.date)}`}
                                    className={compactSelectClassName("w-36")}
                                  >
                                    <option value="contribution">Entrega</option>
                                    <option value="redemption">Resgate</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    form={formId}
                                    name="amount"
                                    inputMode="decimal"
                                    required
                                    defaultValue={formatEditableEuroCents(entry.amountCents)}
                                    aria-label={`Valor do fluxo ${formatDateLabel(entry.date)}`}
                                    className={compactInputClassName("ml-auto w-32 text-right tabular-nums")}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    <button
                                      form={formId}
                                      type="submit"
                                      disabled={recordPending}
                                      className={compactActionButtonClassName("primary")}
                                    >
                                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={recordPending}
                                      onClick={() => runSimpleAction(entry.id, deleteCashFlowAction, formId)}
                                      className={compactActionButtonClassName("danger")}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={formId} className="hover:bg-slate-50">
                              <td className="px-2 py-1">
                                <form
                                  id={formId}
                                  onSubmit={(event) => submitFormAction(event, updateValuationAction, formId)}
                                />
                                <input form={formId} type="hidden" name="id" value={entry.id} />
                                <input
                                  form={formId}
                                  type="hidden"
                                  name="investmentAssetId"
                                  value={entry.investmentAssetId}
                                />
                                <input
                                  form={formId}
                                  name="valuationDate"
                                  type="date"
                                  required
                                  defaultValue={entry.date}
                                  aria-label={`Data da valorização ${formatDateLabel(entry.date)}`}
                                  className={compactInputClassName("w-36")}
                                />
                              </td>
                              <td className="px-2 py-1">
                                <TimelineKindLabel entry={entry} />
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  form={formId}
                                  name="amount"
                                  inputMode="decimal"
                                  required
                                  defaultValue={formatEditableEuroCents(entry.marketValueCents)}
                                  aria-label={`Valor da valorização ${formatDateLabel(entry.date)}`}
                                  className={compactInputClassName("ml-auto w-32 text-right tabular-nums")}
                                />
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  <button
                                    form={formId}
                                    type="submit"
                                    disabled={recordPending}
                                    className={compactActionButtonClassName("primary")}
                                  >
                                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={recordPending}
                                    onClick={() => runSimpleAction(entry.id, deleteValuationAction, formId)}
                                    className={compactActionButtonClassName("danger")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </section>
          );
        })
      )}

      <HistoricalImpactModal prompt={historicalPrompt} />
    </div>
  );
}
