import { getAccountDisplayName } from "@/domain/budget/accounts";
import { formatEditableEuroCents, formatEuroCents } from "@/domain/budget/money";
import { FIRST_MONTH, formatMonthLabel } from "@/domain/budget/months";
import { listManagedAccounts } from "@/server/budget/accounts";
import { listDailyBudgetVersions } from "@/server/budget/daily-budget";
import { listSalaryVersions } from "@/server/budget/salary";
import { saveDailyBudgetVersionAction, saveSalaryVersionAction } from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{
    status?: string;
    erro?: string;
  }>;
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

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const [accountsResult, dailyVersionsResult, salaryVersionsResult] = await Promise.all([
    listManagedAccounts()
      .then((accounts) => ({ accounts, error: null }))
      .catch((error: unknown) => ({
        accounts: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar as contas.",
      })),
    listDailyBudgetVersions()
      .then((versions) => ({ versions, error: null }))
      .catch((error: unknown) => ({
        versions: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar a configuração Day to day.",
      })),
    listSalaryVersions()
      .then((versions) => ({ versions, error: null }))
      .catch((error: unknown) => ({
        versions: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar a configuração de salário.",
      })),
  ]);
  const activeAccounts = accountsResult.accounts.filter((account) => !account.archivedFromMonth);
  const salaryAccounts = activeAccounts.filter((account) => !account.isCreditCard && account.showInBudget !== false);
  const accountNameById = new Map(accountsResult.accounts.map((account) => [account.id, getAccountDisplayName(account)]));
  const latestDailyVersion = dailyVersionsResult.versions[0];
  const latestSalaryVersion = salaryVersionsResult.versions[0];
  const statusMessage = params.status ? statusMessages[params.status] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Configurações</p>
        <h1 className="text-2xl font-semibold text-slate-950">Regras mensais</h1>
      </div>

      {statusMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      {params.erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.erro}</div>
      ) : null}

      {accountsResult.error || dailyVersionsResult.error || salaryVersionsResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {accountsResult.error ?? dailyVersionsResult.error ?? salaryVersionsResult.error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.6fr_1.6fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Primeiro mês</h2>
          <p className="mt-2 text-sm text-slate-700">{formatMonthLabel(FIRST_MONTH)}</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="font-semibold text-slate-950">Salário</h2>
          <form action={saveSalaryVersionAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="salary-amount" className="text-xs font-semibold uppercase text-slate-500">
                Salário mensal
              </label>
              <input
                id="salary-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestSalaryVersion?.amountCents ?? 0)}
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
              />
            </div>
            <div className="flex items-end">
              <button className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900">
                Guardar salário
              </button>
            </div>
          </form>
          {salaryVersionsResult.versions.length === 0 ? (
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
                  {salaryVersionsResult.versions.map((version) => (
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
          <form action={saveDailyBudgetVersionAction} className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div>
              <label htmlFor="daily-budget-amount" className="text-xs font-semibold uppercase text-slate-500">
                Plafond diário
              </label>
              <input
                id="daily-budget-amount"
                name="dailyAmount"
                inputMode="decimal"
                defaultValue={formatEditableEuroCents(latestDailyVersion?.dailyAmountCents ?? 50_00)}
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
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
                className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
              />
            </div>
            <div className="sm:col-span-3 xl:col-span-1">
              <button className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900">
                Guardar configuração
              </button>
            </div>
          </form>
          {dailyVersionsResult.versions.length === 0 ? (
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
                  {dailyVersionsResult.versions.map((version) => (
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
    </div>
  );
}
