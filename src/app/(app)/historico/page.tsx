import { ActualMovementsManagement } from "@/components/actual-movements-management";
import { normaliseMonth } from "@/domain/budget/months";
import { listActualMovements } from "@/server/budget/actual-movements";
import { listManagedAccounts } from "@/server/budget/accounts";
import {
  createActualMovementAction,
  deleteActualMovementAction,
  updateActualMovementAction,
} from "./actions";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams: Promise<{
    month?: string;
    accountId?: string;
    status?: string;
    erro?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  created: "Movimento criado com sucesso.",
  updated: "Movimento actualizado com sucesso.",
  deleted: "Movimento eliminado com sucesso.",
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const selectedMonth = normaliseMonth(params.month);
  const selectedAccountId = params.accountId?.trim() || undefined;
  const [accountsResult, movementsResult] = await Promise.all([
    listManagedAccounts()
      .then((accounts) => ({ accounts, error: null }))
      .catch((error: unknown) => ({
        accounts: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar as contas.",
      })),
    listActualMovements({ month: selectedMonth, accountId: selectedAccountId })
      .then((movements) => ({ movements, error: null }))
      .catch((error: unknown) => ({
        movements: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar os movimentos.",
      })),
  ]);
  const statusMessage = params.status ? statusMessages[params.status] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Histórico</p>
        <h1 className="text-2xl font-semibold text-slate-950">Movimentos reais</h1>
      </div>

      {statusMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      {params.erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.erro}</div>
      ) : null}

      {accountsResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {accountsResult.error}
        </div>
      ) : null}

      {movementsResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {movementsResult.error}
        </div>
      ) : null}

      {!accountsResult.error && !movementsResult.error ? (
        <ActualMovementsManagement
          accounts={accountsResult.accounts}
          movements={movementsResult.movements}
          selectedMonth={selectedMonth}
          selectedAccountId={selectedAccountId}
          createAction={createActualMovementAction}
          updateAction={updateActualMovementAction}
          deleteAction={deleteActualMovementAction}
        />
      ) : null}
    </div>
  );
}
