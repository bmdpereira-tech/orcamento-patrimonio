import { Plus } from "lucide-react";
import { AccountManagement } from "@/components/account-management";
import { FIRST_MONTH } from "@/domain/budget/months";
import { listManagedAccounts } from "@/server/budget/accounts";
import {
  archiveAccountAction,
  createAccountAction,
  deleteAccountAction,
  reactivateAccountAction,
  updateAccountAction,
} from "./actions";

export const dynamic = "force-dynamic";

type AccountsPageProps = {
  searchParams: Promise<{
    status?: string;
    erro?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  created: "Conta criada com sucesso.",
  updated: "Conta actualizada com sucesso.",
  archived: "Conta arquivada com sucesso.",
  reactivated: "Conta reactivada com sucesso.",
  deleted: "Conta eliminada com sucesso.",
  "delete-blocked": "A conta tem dados associados e não foi eliminada. Podes arquivá-la para a esconder.",
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const accountsResult = await listManagedAccounts()
    .then((accounts) => ({ accounts, error: null }))
    .catch((error: unknown) => ({
      accounts: [],
      error: error instanceof Error ? error.message : "Não foi possível carregar as contas.",
    }));
  const statusMessage = params.status ? statusMessages[params.status] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">Contas</p>
          <h1 className="text-2xl font-semibold text-slate-950">Liquidez</h1>
        </div>
        <a
          href="#new-account-name"
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Conta
        </a>
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
      ) : (
        <AccountManagement
          accounts={accountsResult.accounts}
          initialMonth={FIRST_MONTH}
          createAction={createAccountAction}
          updateAction={updateAccountAction}
          archiveAction={archiveAccountAction}
          reactivateAction={reactivateAccountAction}
          deleteAction={deleteAccountAction}
        />
      )}
    </div>
  );
}
