"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountType } from "@/domain/budget/accounts";
import {
  isHistoricalImpactActionResult,
  type HistoricalActionResult,
  type HistoricalImpactRequiredActionResult,
} from "@/domain/budget/historical-impact";
import { formatMonthLabel, type MonthId } from "@/domain/budget/months";
import type { ManagedAccount } from "@/server/budget/accounts";
import {
  HistoricalImpactModal,
  type HistoricalImpactPrompt,
  withHistoricalImpactConfirmation,
} from "./historical-impact-modal";

type AccountAction = (formData: FormData) => Promise<HistoricalActionResult<{ status: string }>>;

type AccountManagementProps = {
  accounts: ManagedAccount[];
  initialMonth: MonthId;
  createAction: AccountAction;
  updateAction: AccountAction;
  archiveAction: AccountAction;
  reactivateAction: AccountAction;
  deleteAction: AccountAction;
};

const accountTypeOptions: readonly { value: AccountType; label: string }[] = [
  { value: "bank_account", label: "Conta bancária" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "savings", label: "Poupança" },
  { value: "investment_cash", label: "Liquidez de investimento" },
  { value: "cash", label: "Numerário" },
  { value: "other", label: "Outra" },
];

const statusMessages: Record<string, string> = {
  created: "Conta criada com sucesso.",
  updated: "Conta actualizada com sucesso.",
  archived: "Conta arquivada com sucesso.",
  reactivated: "Conta reactivada com sucesso.",
  deleted: "Conta eliminada com sucesso.",
  "delete-blocked": "A conta tem dados associados e não foi eliminada. Podes arquivá-la para a esconder.",
};

function SubmitButton({ children, pending }: { children: React.ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "A guardar..." : children}
    </button>
  );
}

function inputClassName(className = "") {
  return `h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function checkboxClassName() {
  return "h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600";
}

function actionButtonClassName(tone: "primary" | "muted" | "danger" = "muted") {
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    muted: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };

  return `inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold shadow-sm ${tones[tone]}`;
}

function accountStatus(account: ManagedAccount) {
  return account.archivedFromMonth ? `Arquivada desde ${formatMonthLabel(account.archivedFromMonth)}` : "Activa";
}

export function AccountManagement({
  accounts,
  initialMonth,
  createAction,
  updateAction,
  archiveAction,
  reactivateAction,
  deleteAction,
}: AccountManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [historicalPrompt, setHistoricalPrompt] = useState<HistoricalImpactPrompt | null>(null);
  const paymentAccountOptions = accounts.filter((account) => !account.isCreditCard && !account.archivedFromMonth);

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

  const runAccountAction = useCallback(
    async ({
      action,
      formData,
      pendingId,
    }: {
      action: AccountAction;
      formData: FormData;
      pendingId: string;
    }) => {
      setPendingActionId(pendingId);
      setMessage(null);
      setError(null);

      const result = await action(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setPendingActionId(null);
          },
          onConfirm: async () => {
            setPendingActionId(pendingId);
            const confirmedResult = await action(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setError(confirmedResult.message);
              setPendingActionId(null);
              return;
            }

            if (!confirmedResult.ok) {
              setError(confirmedResult.error);
              setPendingActionId(null);
              return;
            }

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

      finishSuccessfulAction(result.status);
    },
    [finishSuccessfulAction, openHistoricalConfirmation],
  );

  const submitFormAction = useCallback(
    (event: React.FormEvent<HTMLFormElement>, action: AccountAction, pendingId: string) => {
      event.preventDefault();
      void runAccountAction({
        action,
        formData: new FormData(event.currentTarget),
        pendingId,
      });
    },
    [runAccountAction],
  );

  const runButtonAction = useCallback(
    (formId: string, action: AccountAction, pendingId: string) => {
      const form = document.getElementById(formId);

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      void runAccountAction({
        action,
        formData: new FormData(form),
        pendingId,
      });
    },
    [runAccountAction],
  );

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
        <form
          onSubmit={(event) => submitFormAction(event, createAction, "new")}
          className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_1fr_0.7fr_auto] lg:items-end"
        >
          <div>
            <label htmlFor="new-account-name" className="text-xs font-semibold uppercase text-slate-500">
              Nome
            </label>
            <input id="new-account-name" name="name" required className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-account-short-name" className="text-xs font-semibold uppercase text-slate-500">
              Nome curto
            </label>
            <input id="new-account-short-name" name="shortName" className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-account-type" className="text-xs font-semibold uppercase text-slate-500">
              Tipo
            </label>
            <select id="new-account-type" name="accountType" defaultValue="bank_account" className={inputClassName("mt-1")}>
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-account-order" className="text-xs font-semibold uppercase text-slate-500">
              Ordem
            </label>
            <input
              id="new-account-order"
              name="sortOrder"
              type="number"
              defaultValue={accounts.length > 0 ? Math.max(...accounts.map((account) => account.sortOrder)) + 10 : 10}
              className={inputClassName("mt-1")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input name="showInBudget" type="checkbox" defaultChecked className={checkboxClassName()} />
              Tabela
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input name="includeInNetWorth" type="checkbox" defaultChecked className={checkboxClassName()} />
              Património
            </label>
            <SubmitButton pending={pendingActionId === "new"}>Criar conta</SubmitButton>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {accounts.length === 0 ? (
          <p className="p-4 text-sm text-slate-700">Ainda não existem contas configuradas.</p>
        ) : (
          <table className="min-w-[1120px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Nome curto</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Conta pagamento</th>
                <th className="px-3 py-2">Ordem</th>
                <th className="px-3 py-2">Opções</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const formId = `account-${account.id}`;
                const isPending = pendingActionId === account.id;

                return (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <form
                        id={formId}
                        onSubmit={(event) => submitFormAction(event, updateAction, account.id)}
                      />
                      <input form={formId} type="hidden" name="id" value={account.id} />
                      <input form={formId} name="name" required defaultValue={account.name} className={inputClassName()} />
                    </td>
                    <td className="px-3 py-2">
                      <input form={formId} name="shortName" defaultValue={account.shortName} className={inputClassName()} />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        form={formId}
                        name="accountType"
                        defaultValue={account.accountType}
                        className={inputClassName()}
                      >
                        {accountTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
                        <input
                          form={formId}
                          name="isCreditCard"
                          type="checkbox"
                          defaultChecked={account.isCreditCard}
                          className={checkboxClassName()}
                        />
                        Cartão
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        form={formId}
                        name="linkedPaymentAccountId"
                        defaultValue={account.linkedPaymentAccountId ?? ""}
                        className={inputClassName()}
                      >
                        <option value="">Sem ligação</option>
                        {paymentAccountOptions
                          .filter((option) => option.id !== account.id)
                          .map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.shortName}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        form={formId}
                        name="sortOrder"
                        type="number"
                        defaultValue={account.sortOrder}
                        className={inputClassName("w-24")}
                      />
                      <input form={formId} type="hidden" name="startMonth" value={account.startMonth} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            form={formId}
                            name="showInBudget"
                            type="checkbox"
                            defaultChecked={account.showInBudget}
                            className={checkboxClassName()}
                          />
                          Mostrar na tabela
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            form={formId}
                            name="includeInNetWorth"
                            type="checkbox"
                            defaultChecked={account.includeInNetWorth}
                            className={checkboxClassName()}
                          />
                          Incluir em património
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{accountStatus(account)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          form={formId}
                          type="submit"
                          disabled={isPending}
                          className={actionButtonClassName("primary")}
                        >
                          Guardar
                        </button>
                        <input form={formId} type="hidden" name="archiveFromMonth" value={initialMonth} />
                        {account.archivedFromMonth ? (
                          <button
                            type="button"
                            disabled={isPending}
                            className={actionButtonClassName()}
                            onClick={() => runButtonAction(formId, reactivateAction, account.id)}
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            className={actionButtonClassName()}
                            onClick={() => runButtonAction(formId, archiveAction, account.id)}
                          >
                            Arquivar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          className={actionButtonClassName("danger")}
                          onClick={() => runButtonAction(formId, deleteAction, account.id)}
                        >
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
      </section>
      <HistoricalImpactModal prompt={historicalPrompt} />
    </div>
  );
}
