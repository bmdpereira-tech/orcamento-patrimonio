"use client";

import { Filter, Plus, Save, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  getActualMovementSignedAmount,
  type ActualMovement,
  type ActualMovementType,
} from "@/domain/budget/actual-movements";
import { getAccountDisplayName, type LiquidityAccount } from "@/domain/budget/accounts";
import { formatEditableEuroCents, formatEuroCents } from "@/domain/budget/money";
import type { MonthId } from "@/domain/budget/months";

type MovementAction = (formData: FormData) => void | Promise<void>;

type ActualMovementsManagementProps = {
  accounts: LiquidityAccount[];
  movements: ActualMovement[];
  selectedMonth: MonthId;
  selectedAccountId?: string;
  createAction: MovementAction;
  updateAction: MovementAction;
  deleteAction: MovementAction;
};

const movementTypeOptions: readonly { value: ActualMovementType; label: string }[] = [
  { value: "expense", label: "Saída" },
  { value: "income", label: "Entrada" },
];

function SubmitButton({
  children,
  tone = "primary",
  formId,
}: {
  children: React.ReactNode;
  tone?: "primary" | "muted" | "danger";
  formId?: string;
}) {
  const { pending } = useFormStatus();
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    muted: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };

  return (
    <button
      type="submit"
      form={formId}
      disabled={pending}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {pending ? "A guardar..." : children}
    </button>
  );
}

function inputClassName(className = "") {
  return `h-9 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function compactInputClassName(className = "") {
  return `h-8 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function formatMovementDate(date: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getAccountName(accounts: readonly LiquidityAccount[], accountId: string) {
  const account = accounts.find((item) => item.id === accountId);

  return account ? getAccountDisplayName(account) : "Conta removida";
}

function RedirectFields({
  selectedMonth,
  selectedAccountId,
  formId,
}: {
  selectedMonth: MonthId;
  selectedAccountId?: string;
  formId?: string;
}) {
  return (
    <>
      <input form={formId} type="hidden" name="redirectMonth" value={selectedMonth} />
      <input form={formId} type="hidden" name="redirectAccountId" value={selectedAccountId ?? ""} />
    </>
  );
}

function AccountOptions({ accounts }: { accounts: readonly LiquidityAccount[] }) {
  return (
    <>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {getAccountDisplayName(account)}
        </option>
      ))}
    </>
  );
}

export function ActualMovementsManagement({
  accounts,
  movements,
  selectedMonth,
  selectedAccountId,
  createAction,
  updateAction,
  deleteAction,
}: ActualMovementsManagementProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form method="get" action="/historico" className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="history-month" className="text-xs font-semibold uppercase text-slate-500">
              Mês
            </label>
            <input
              id="history-month"
              name="month"
              type="month"
              defaultValue={selectedMonth}
              className={inputClassName("mt-1")}
            />
          </div>
          <div>
            <label htmlFor="history-account" className="text-xs font-semibold uppercase text-slate-500">
              Conta
            </label>
            <select
              id="history-account"
              name="accountId"
              defaultValue={selectedAccountId ?? ""}
              className={inputClassName("mt-1")}
            >
              <option value="">Todas as contas</option>
              <AccountOptions accounts={accounts} />
            </select>
          </div>
          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtrar
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form action={createAction} className="grid gap-3 lg:grid-cols-[140px_1fr_180px_130px_140px_auto] lg:items-end">
          <RedirectFields selectedMonth={selectedMonth} selectedAccountId={selectedAccountId} />
          <div>
            <label htmlFor="new-movement-date" className="text-xs font-semibold uppercase text-slate-500">
              Data
            </label>
            <input
              id="new-movement-date"
              name="movementDate"
              type="date"
              defaultValue={`${selectedMonth}-01`}
              required
              className={inputClassName("mt-1")}
            />
          </div>
          <div>
            <label htmlFor="new-movement-description" className="text-xs font-semibold uppercase text-slate-500">
              Descrição
            </label>
            <input
              id="new-movement-description"
              name="description"
              required
              className={inputClassName("mt-1")}
            />
          </div>
          <div>
            <label htmlFor="new-movement-account" className="text-xs font-semibold uppercase text-slate-500">
              Conta
            </label>
            <select
              id="new-movement-account"
              name="accountId"
              defaultValue={selectedAccountId ?? ""}
              required
              className={inputClassName("mt-1")}
            >
              <option value="" disabled>
                Escolher conta
              </option>
              <AccountOptions accounts={accounts} />
            </select>
          </div>
          <div>
            <label htmlFor="new-movement-type" className="text-xs font-semibold uppercase text-slate-500">
              Tipo
            </label>
            <select
              id="new-movement-type"
              name="movementType"
              defaultValue="expense"
              className={inputClassName("mt-1")}
            >
              {movementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-movement-amount" className="text-xs font-semibold uppercase text-slate-500">
              Valor
            </label>
            <input
              id="new-movement-amount"
              name="amount"
              inputMode="decimal"
              required
              className={inputClassName("mt-1 text-right tabular-nums")}
            />
          </div>
          <SubmitButton>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Movimento
          </SubmitButton>
        </form>
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {movements.length === 0 ? (
          <p className="p-4 text-sm text-slate-700">Sem movimentos para os filtros seleccionados.</p>
        ) : (
          <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Conta</th>
                <th className="px-3 py-2 text-right">Entrada</th>
                <th className="px-3 py-2 text-right">Saída</th>
                <th className="px-3 py-2 text-right">Valor líquido</th>
                <th className="px-3 py-2 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((movement) => {
                const formId = `movement-${movement.id}`;
                const signedAmountCents = getActualMovementSignedAmount(movement);

                return (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 align-top">
                      <form id={formId} action={updateAction} />
                      <RedirectFields selectedMonth={selectedMonth} selectedAccountId={selectedAccountId} formId={formId} />
                      <input form={formId} type="hidden" name="id" value={movement.id} />
                      <input
                        form={formId}
                        name="movementDate"
                        type="date"
                        defaultValue={movement.movementDate}
                        aria-label={`Data de ${movement.description}`}
                        className={compactInputClassName()}
                      />
                      <p className="mt-1 text-xs text-slate-500">{formatMovementDate(movement.movementDate)}</p>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        form={formId}
                        name="description"
                        defaultValue={movement.description}
                        aria-label="Descrição"
                        className={compactInputClassName()}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        form={formId}
                        name="accountId"
                        defaultValue={movement.accountId}
                        aria-label={`Conta de ${movement.description}`}
                        className={compactInputClassName()}
                      >
                        <AccountOptions accounts={accounts} />
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{getAccountName(accounts, movement.accountId)}</p>
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-emerald-700">
                      {movement.movementType === "income" ? formatEuroCents(movement.amountCents) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-red-700">
                      {movement.movementType === "expense" ? formatEuroCents(movement.amountCents) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums font-semibold text-slate-900">
                      <div>{formatEuroCents(signedAmountCents)}</div>
                      <div className="mt-1 grid grid-cols-[1fr_120px] items-center gap-2">
                        <select
                          form={formId}
                          name="movementType"
                          defaultValue={movement.movementType}
                          aria-label={`Tipo de ${movement.description}`}
                          className={compactInputClassName()}
                        >
                          {movementTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          form={formId}
                          name="amount"
                          defaultValue={formatEditableEuroCents(movement.amountCents)}
                          inputMode="decimal"
                          aria-label={`Valor de ${movement.description}`}
                          className={compactInputClassName("text-right tabular-nums")}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex justify-end gap-2">
                        <SubmitButton tone="muted" formId={formId}>
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Guardar
                        </SubmitButton>
                        <form action={deleteAction}>
                          <RedirectFields selectedMonth={selectedMonth} selectedAccountId={selectedAccountId} />
                          <input type="hidden" name="id" value={movement.id} />
                          <button
                            type="submit"
                            onClick={(event) => {
                              if (!window.confirm(`Eliminar o movimento "${movement.description}"?`)) {
                                event.preventDefault();
                              }
                            }}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
