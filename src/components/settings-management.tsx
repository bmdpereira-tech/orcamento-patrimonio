"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccountDisplayName } from "@/domain/budget/accounts";
import {
  isHistoricalImpactActionResult,
  type HistoricalActionResult,
  type HistoricalImpactRequiredActionResult,
} from "@/domain/budget/historical-impact";
import { formatEditableEuroCents, formatEuroCents } from "@/domain/budget/money";
import { FIRST_MONTH, formatMonthLabel } from "@/domain/budget/months";
import type { DailyBudgetVersion } from "@/domain/budget/daily-budget";
import type { SalaryVersion } from "@/domain/budget/salary";
import type { ManagedAccount } from "@/server/budget/accounts";
import {
  HistoricalImpactModal,
  type HistoricalImpactPrompt,
  withHistoricalImpactConfirmation,
} from "./historical-impact-modal";

type SettingsAction = (formData: FormData) => Promise<HistoricalActionResult>;

type SettingsManagementProps = {
  accounts: ManagedAccount[];
  dailyVersions: DailyBudgetVersion[];
  salaryVersions: SalaryVersion[];
  initialMessage?: string;
  initialError?: string;
  saveDailyBudgetVersionAction: SettingsAction;
  saveSalaryVersionAction: SettingsAction;
};

const statusMessages: Record<string, string> = {
  "daily-budget-saved": "Configuração Day to day guardada com sucesso.",
  "salary-saved": "Configuração de salário guardada com sucesso.",
};

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const label = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, index, 1)));

  return {
    value: month,
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
});

function inputClassName() {
  return "mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600";
}

export function SettingsManagement({
  accounts,
  dailyVersions,
  salaryVersions,
  initialMessage,
  initialError,
  saveDailyBudgetVersionAction,
  saveSalaryVersionAction,
}: SettingsManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pendingForm, setPendingForm] = useState<"salary" | "daily" | null>(null);
  const [historicalPrompt, setHistoricalPrompt] = useState<HistoricalImpactPrompt | null>(null);
  const activeAccounts = accounts.filter((account) => !account.archivedFromMonth);
  const salaryAccounts = activeAccounts.filter((account) => !account.isCreditCard && account.showInBudget !== false);
  const accountNameById = new Map(accounts.map((account) => [account.id, getAccountDisplayName(account)]));
  const latestDailyVersion = dailyVersions[0];
  const latestSalaryVersion = salaryVersions[0];

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

  const runSettingsAction = useCallback(
    async ({
      formData,
      action,
      formKey,
      successStatus,
    }: {
      formData: FormData;
      action: SettingsAction;
      formKey: "salary" | "daily";
      successStatus: keyof typeof statusMessages;
    }) => {
      setPendingForm(formKey);
      setMessage(null);
      setError(null);

      const result = await action(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setPendingForm(null);
          },
          onConfirm: async () => {
            setPendingForm(formKey);
            const confirmedResult = await action(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setError(confirmedResult.message);
              setPendingForm(null);
              return;
            }

            if (!confirmedResult.ok) {
              setError(confirmedResult.error);
              setPendingForm(null);
              return;
            }

            setMessage(statusMessages[successStatus]);
            setError(null);
            setPendingForm(null);
            router.refresh();
          },
        });
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setPendingForm(null);
        return;
      }

      setMessage(statusMessages[successStatus]);
      setError(null);
      setPendingForm(null);
      router.refresh();
    },
    [openHistoricalConfirmation, router],
  );

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.6fr_1.6fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Primeiro mês</h2>
          <p className="mt-2 text-sm text-slate-700">{formatMonthLabel(FIRST_MONTH)}</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="font-semibold text-slate-950">Salário</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSettingsAction({
                formData: new FormData(event.currentTarget),
                action: saveSalaryVersionAction,
                formKey: "salary",
                successStatus: "salary-saved",
              });
            }}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="salary-amount" className="text-xs font-semibold uppercase text-slate-500">
                Salário mensal
              </label>
              <input
                id="salary-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestSalaryVersion?.amountCents ?? 0)}
                className={inputClassName()}
              />
            </div>
            <div>
              <label htmlFor="salary-account" className="text-xs font-semibold uppercase text-slate-500">
                Conta de recebimento
              </label>
              <select
                id="salary-account"
                name="accountId"
                defaultValue={latestSalaryVersion?.accountId ?? ""}
                required
                className={inputClassName()}
              >
                <option value="">Seleccionar</option>
                {salaryAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="salary-vacation-bonus" className="text-xs font-semibold uppercase text-slate-500">
                Subsídio de férias
              </label>
              <input
                id="salary-vacation-bonus"
                name="vacationBonus"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestSalaryVersion?.vacationBonusCents ?? 0)}
                className={inputClassName()}
              />
            </div>
            <div>
              <label htmlFor="salary-vacation-month" className="text-xs font-semibold uppercase text-slate-500">
                Mês férias
              </label>
              <select
                id="salary-vacation-month"
                name="vacationBonusMonth"
                defaultValue={latestSalaryVersion?.vacationBonusMonth ?? 7}
                required
                className={inputClassName()}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="salary-christmas-bonus" className="text-xs font-semibold uppercase text-slate-500">
                Subsídio de Natal
              </label>
              <input
                id="salary-christmas-bonus"
                name="christmasBonus"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestSalaryVersion?.christmasBonusCents ?? 0)}
                className={inputClassName()}
              />
            </div>
            <div>
              <label htmlFor="salary-christmas-month" className="text-xs font-semibold uppercase text-slate-500">
                Mês Natal
              </label>
              <select
                id="salary-christmas-month"
                name="christmasBonusMonth"
                defaultValue={latestSalaryVersion?.christmasBonusMonth ?? 12}
                required
                className={inputClassName()}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="salary-effective-month" className="text-xs font-semibold uppercase text-slate-500">
                Vigência
              </label>
              <input
                id="salary-effective-month"
                name="effectiveFromMonth"
                type="month"
                min={FIRST_MONTH}
                defaultValue={latestSalaryVersion?.effectiveFromMonth ?? FIRST_MONTH}
                required
                className={inputClassName()}
              />
            </div>
            <div className="flex items-end">
              <button
                disabled={pendingForm === "salary"}
                className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
              >
                {pendingForm === "salary" ? "A guardar..." : "Guardar salário"}
              </button>
            </div>
          </form>
          {salaryVersions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-700">Sem versão configurada.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Conta</th>
                    <th className="px-3 py-2 text-right">Normal</th>
                    <th className="px-3 py-2 text-right">Férias</th>
                    <th className="px-3 py-2 text-right">Natal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryVersions.map((version) => (
                    <tr key={version.id ?? version.effectiveFromMonth}>
                      <td className="px-3 py-2">{formatMonthLabel(version.effectiveFromMonth)}</td>
                      <td className="px-3 py-2">{accountNameById.get(version.accountId) ?? "Conta arquivada"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatEuroCents(version.amountCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuroCents(version.vacationBonusCents)}
                        <span className="ml-1 text-xs text-slate-500">
                          {monthOptions.find((month) => month.value === version.vacationBonusMonth)?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuroCents(version.christmasBonusCents)}
                        <span className="ml-1 text-xs text-slate-500">
                          {monthOptions.find((month) => month.value === version.christmasBonusMonth)?.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="font-semibold text-slate-950">Day to day</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSettingsAction({
                formData: new FormData(event.currentTarget),
                action: saveDailyBudgetVersionAction,
                formKey: "daily",
                successStatus: "daily-budget-saved",
              });
            }}
            className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1"
          >
            <div>
              <label htmlFor="daily-budget-amount" className="text-xs font-semibold uppercase text-slate-500">
                Plafond diário
              </label>
              <input
                id="daily-budget-amount"
                name="dailyAmount"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestDailyVersion?.dailyAmountCents ?? 50_00)}
                className={inputClassName()}
              />
            </div>
            <div>
              <label htmlFor="daily-budget-account" className="text-xs font-semibold uppercase text-slate-500">
                Conta
              </label>
              <select
                id="daily-budget-account"
                name="accountId"
                defaultValue={latestDailyVersion?.accountId ?? ""}
                required
                className={inputClassName()}
              >
                <option value="">Seleccionar</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="daily-budget-effective-month" className="text-xs font-semibold uppercase text-slate-500">
                Vigência
              </label>
              <input
                id="daily-budget-effective-month"
                name="effectiveFromMonth"
                type="month"
                min={FIRST_MONTH}
                defaultValue={latestDailyVersion?.effectiveFromMonth ?? FIRST_MONTH}
                required
                className={inputClassName()}
              />
            </div>
            <div className="sm:col-span-3 xl:col-span-1">
              <button
                disabled={pendingForm === "daily"}
                className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
              >
                {pendingForm === "daily" ? "A guardar..." : "Guardar configuração"}
              </button>
            </div>
          </form>
          {dailyVersions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-700">Sem versão configurada.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Conta</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyVersions.map((version) => (
                    <tr key={version.id ?? version.effectiveFromMonth}>
                      <td className="px-3 py-2">{formatMonthLabel(version.effectiveFromMonth)}</td>
                      <td className="px-3 py-2">{accountNameById.get(version.accountId) ?? "Conta arquivada"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatEuroCents(version.dailyAmountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <HistoricalImpactModal prompt={historicalPrompt} />
    </div>
  );
}
