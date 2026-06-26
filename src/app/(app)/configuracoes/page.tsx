import { SettingsManagement } from "@/components/settings-management";
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
  const loadError = accountsResult.error ?? dailyVersionsResult.error ?? salaryVersionsResult.error ?? params.erro;
  const statusMessage = params.status ? statusMessages[params.status] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Configurações</p>
        <h1 className="text-2xl font-semibold text-slate-950">Regras mensais</h1>
      </div>

      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : (
        <SettingsManagement
          accounts={accountsResult.accounts}
          dailyVersions={dailyVersionsResult.versions}
          salaryVersions={salaryVersionsResult.versions}
          initialMessage={statusMessage}
          saveDailyBudgetVersionAction={saveDailyBudgetVersionAction}
          saveSalaryVersionAction={saveSalaryVersionAction}
        />
      )}
    </div>
  );
}
