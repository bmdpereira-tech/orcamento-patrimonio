"use client";

import { Plus, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCreditCardPaymentAmountMap,
  buildMonthlyCreditCardPayments,
  type CreditCardStatementOverride,
  type MonthlyCreditCardPayment,
} from "@/domain/budget/credit-card-payments";
import type {
  BudgetOverview,
  BudgetRowTone,
  BudgetTableRow,
  EditableBudgetRowKey,
  MonthlyAccountSnapshot,
  MonthlyCustomBudgetItem,
} from "@/domain/budget/monthly-view";
import { buildBudgetOverview, EDITABLE_BUDGET_ROW_KEYS } from "@/domain/budget/monthly-view";
import type { MonthlyDirectDebitOccurrence } from "@/domain/budget/recurring-rules";
import { getAccountDisplayName, type LiquidityAccount } from "@/domain/budget/accounts";
import {
  formatEditableEuroCents,
  formatEuroCents,
  parseEuroCents,
  sumCents,
  type Cents,
} from "@/domain/budget/money";
import { FIRST_MONTH, type MonthId } from "@/domain/budget/months";
import { cn } from "@/lib/cn";
import { UI_TEXT } from "@/content/ui-text";

type BudgetActionResult = { ok: true } | { ok: false; error: string };
type AddCustomBudgetItemActionResult = { ok: true; item: MonthlyCustomBudgetItem } | { ok: false; error: string };
type DirectDebitExclusionActionResult =
  | {
      ok: true;
      state: {
        recurringRuleId: string;
        month: string;
        excludedFromForecast: boolean;
      };
    }
  | { ok: false; error: string };
type CreditCardStatementOverrideActionResult =
  | {
      ok: true;
      override: {
        creditCardAccountId: string;
        month: string;
        statementAmountCents: number | null;
      };
    }
  | { ok: false; error: string };

type MonthlyBudgetTableProps = {
  overview: BudgetOverview;
  editable?: boolean;
  saveBudgetAction?: (formData: FormData) => Promise<BudgetActionResult>;
  addCustomItemAction?: (formData: FormData) => Promise<AddCustomBudgetItemActionResult>;
  deleteCustomItemAction?: (formData: FormData) => Promise<BudgetActionResult>;
  setDirectDebitExcludedAction?: (formData: FormData) => Promise<DirectDebitExclusionActionResult>;
  setCreditCardStatementOverrideAction?: (
    formData: FormData,
  ) => Promise<CreditCardStatementOverrideActionResult>;
};

type EditableCellValues = Record<EditableBudgetRowKey, Record<string, string>>;

type LocalCustomBudgetItem = Omit<MonthlyCustomBudgetItem, "valuesByAccountId"> & {
  valuesByAccountId: Record<string, string>;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const DESCRIPTION_COLUMN_WIDTH_PX = 228;
const ACCOUNT_COLUMN_WIDTH_PX = 132;
const TOTAL_COLUMN_WIDTH_PX = 132;
const AUTOSAVE_DELAY_MS = 650;

function getRowClassName(tone: BudgetRowTone) {
  return cn(
    "hover:bg-slate-50",
    tone === "subtotal" && "bg-slate-50",
    tone === "salary" && "bg-white",
    tone === "final" && "bg-brand-50",
  );
}

function getToneCellClassName(tone: BudgetRowTone) {
  return cn(
    tone === "section-end" && "border-b-2 border-slate-300",
    tone === "subtotal" && "border-t-2 border-slate-300 bg-slate-50 font-semibold",
    tone === "salary" && "border-t border-slate-200 bg-white",
    tone === "final" && "border-y-2 border-brand-200 bg-brand-50 font-semibold",
  );
}

function getValueClassName({
  value,
  isCreditCard,
  tone,
  isTotal = false,
}: {
  value: Cents;
  isCreditCard?: boolean;
  tone: BudgetRowTone;
  isTotal?: boolean;
}) {
  const isImportantLine = tone === "subtotal" || tone === "final";
  const isNegative = value < 0;

  return cn(
    "w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap px-2 py-0.5 text-right tabular-nums text-slate-700",
    getToneCellClassName(tone),
    isTotal && "w-[132px] min-w-[132px] max-w-[132px]",
    isTotal && "font-semibold text-slate-950",
    tone === "final" && "text-slate-950",
    isNegative && isCreditCard && "text-blue-900",
    isNegative && !isCreditCard && "text-red-700",
    isNegative && !isCreditCard && isImportantLine && tone !== "final" && "bg-red-50",
  );
}

function shouldShowSectionHeader(sectionKey: string) {
  return sectionKey === "current-position" || sectionKey === "monthly-forecasts";
}

function tryParseCurrencyInput(value: string) {
  try {
    return parseEuroCents(value);
  } catch {
    return null;
  }
}

function parseCurrencyInput(value: string) {
  return tryParseCurrencyInput(value) ?? 0;
}

function normaliseCurrencyInput(value: string) {
  const parsed = tryParseCurrencyInput(value);

  return parsed === null ? value : formatEditableEuroCents(parsed);
}

function getSnapshotValue(snapshot: MonthlyAccountSnapshot, rowKey: EditableBudgetRowKey) {
  switch (rowKey) {
    case "initial-balance":
      return snapshot.initialBalanceCents;
    case "current-balance":
      return snapshot.currentBalanceCents;
    case "salary":
      return snapshot.salaryCents;
  }
}

function createEditableCellValues(overview: BudgetOverview): EditableCellValues {
  const snapshotByAccountId = new Map(overview.snapshots.map((snapshot) => [snapshot.accountId, snapshot]));

  return Object.fromEntries(
    EDITABLE_BUDGET_ROW_KEYS.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        overview.accounts.map((account) => {
          const snapshot = snapshotByAccountId.get(account.id);
          const value = snapshot ? getSnapshotValue(snapshot, rowKey) : 0;

          return [account.id, formatEditableEuroCents(value)];
        }),
      ),
    ]),
  ) as EditableCellValues;
}

function createCustomItemState(
  item: MonthlyCustomBudgetItem,
  accounts: readonly LiquidityAccount[],
): LocalCustomBudgetItem {
  return {
    id: item.id,
    month: item.month,
    description: item.description,
    sortOrder: item.sortOrder,
    valuesByAccountId: Object.fromEntries(
      accounts.map((account) => [
        account.id,
        formatEditableEuroCents(item.valuesByAccountId[account.id] ?? 0),
      ]),
    ),
  };
}

function createCustomItemStates(overview: BudgetOverview) {
  return overview.customItems.map((item) => createCustomItemState(item, overview.accounts));
}

function createDirectDebitExclusionState(overview: BudgetOverview) {
  return Object.fromEntries(
    overview.directDebitOccurrences.map((occurrence) => [
      occurrence.ruleId,
      occurrence.excludedFromForecast,
    ]),
  ) as Record<string, boolean>;
}

function createCreditCardOverrideValues(overview: BudgetOverview) {
  return Object.fromEntries(
    overview.creditCardPayments.map((payment) => [
      payment.creditCardAccountId,
      payment.overrideAmountCents === undefined ? "" : formatEditableEuroCents(payment.overrideAmountCents),
    ]),
  ) as Record<string, string>;
}

function createCreditCardOverrideEnabledState(overview: BudgetOverview) {
  return Object.fromEntries(
    overview.creditCardPayments.map((payment) => [
      payment.creditCardAccountId,
      payment.overrideAmountCents !== undefined,
    ]),
  ) as Record<string, boolean>;
}

function buildCreditCardStatementOverrides(
  month: MonthId,
  overrideValues: Readonly<Record<string, string>>,
  overrideEnabledByCardId: Readonly<Record<string, boolean>>,
): CreditCardStatementOverride[] {
  return Object.entries(overrideValues).flatMap(([creditCardAccountId, value]) => {
    if (!overrideEnabledByCardId[creditCardAccountId]) {
      return [];
    }

    const statementAmountCents = tryParseCurrencyInput(value.trim() || "0");

    if (statementAmountCents === null || statementAmountCents < 0) {
      return [];
    }

    return [{ creditCardAccountId, month, statementAmountCents }];
  });
}

function calculateDirectDebitAmountsByAccount(
  occurrences: readonly MonthlyDirectDebitOccurrence[],
  excludedByRuleId: Readonly<Record<string, boolean>>,
) {
  const amountsByAccount = new Map<string, Cents>();

  for (const occurrence of occurrences) {
    if (excludedByRuleId[occurrence.ruleId]) {
      continue;
    }

    const current = amountsByAccount.get(occurrence.accountId) ?? 0;
    amountsByAccount.set(occurrence.accountId, sumCents([current, -Math.abs(occurrence.amountCents)]));
  }

  return amountsByAccount;
}

function parseCustomItemState(item: LocalCustomBudgetItem, accounts: readonly LiquidityAccount[]) {
  return {
    id: item.id,
    month: item.month,
    description: item.description,
    sortOrder: item.sortOrder,
    valuesByAccountId: Object.fromEntries(
      accounts.map((account) => [account.id, parseCurrencyInput(item.valuesByAccountId[account.id] ?? "0")]),
    ) as Record<string, Cents>,
  };
}

function calculateDisplayBudgetState({
  overview,
  cellValues,
  customItems,
  directDebitExclusions,
  creditCardOverrideValues,
  creditCardOverrideEnabled,
}: {
  overview: BudgetOverview;
  cellValues: EditableCellValues;
  customItems: readonly MonthlyCustomBudgetItem[];
  directDebitExclusions: Readonly<Record<string, boolean>>;
  creditCardOverrideValues: Readonly<Record<string, string>>;
  creditCardOverrideEnabled: Readonly<Record<string, boolean>>;
}) {
  const snapshotByAccountId = new Map(overview.snapshots.map((snapshot) => [snapshot.accountId, snapshot]));
  const hasDirectDebitOccurrences = overview.directDebitOccurrences.length > 0;
  const directDebitAmountsByAccount = calculateDirectDebitAmountsByAccount(
    overview.directDebitOccurrences,
    directDebitExclusions,
  );

  const baseSnapshots = overview.accounts.map((account): MonthlyAccountSnapshot => {
    const sourceSnapshot = snapshotByAccountId.get(account.id);
    const initialBalanceCents =
      overview.month === FIRST_MONTH
        ? parseCurrencyInput(cellValues["initial-balance"][account.id] ?? "0")
        : sourceSnapshot?.initialBalanceCents ?? 0;
    const currentBalanceCents = parseCurrencyInput(cellValues["current-balance"][account.id] ?? "0");
    const directDebitsCents = hasDirectDebitOccurrences
      ? directDebitAmountsByAccount.get(account.id) ?? 0
      : sourceSnapshot?.directDebitsCents ?? 0;
    const dayToDayCents = sourceSnapshot?.dayToDayCents ?? 0;
    const salaryCents = parseCurrencyInput(cellValues.salary[account.id] ?? "0");
    const manualForecastsCents = sumCents(
      customItems.map((item) => item.valuesByAccountId[account.id] ?? 0),
    );
    const realisedMovementsCents = sumCents([currentBalanceCents, -initialBalanceCents]);

    return {
      accountId: account.id,
      initialBalanceCents,
      realisedMovementsCents,
      currentBalanceCents,
      directDebitsCents,
      dayToDayCents,
      creditCardPaymentsCents: 0,
      manualForecastsCents,
      subtotalBeforeSalaryCents: 0,
      salaryCents,
      finalBalanceCents: 0,
    };
  });
  const creditCardPayments = buildMonthlyCreditCardPayments({
    accounts: overview.accounts,
    snapshots: baseSnapshots,
    month: overview.month,
    overrides: buildCreditCardStatementOverrides(
      overview.month,
      creditCardOverrideValues,
      creditCardOverrideEnabled,
    ),
  });
  const creditCardPaymentAmountsByAccount = buildCreditCardPaymentAmountMap(creditCardPayments);
  const snapshots = baseSnapshots.map((snapshot): MonthlyAccountSnapshot => {
    const creditCardPaymentsCents = creditCardPaymentAmountsByAccount.get(snapshot.accountId) ?? 0;
    const subtotalBeforeSalaryCents = sumCents([
      snapshot.currentBalanceCents,
      snapshot.directDebitsCents,
      snapshot.dayToDayCents,
      creditCardPaymentsCents,
      snapshot.manualForecastsCents,
    ]);

    return {
      ...snapshot,
      creditCardPaymentsCents,
      subtotalBeforeSalaryCents,
      finalBalanceCents: sumCents([subtotalBeforeSalaryCents, snapshot.salaryCents]),
    };
  });

  return { snapshots, creditCardPayments };
}

function buildSaveFormData({
  overview,
  cellValues,
  customItems,
}: {
  overview: BudgetOverview;
  cellValues: EditableCellValues;
  customItems: readonly LocalCustomBudgetItem[];
}) {
  const formData = new FormData();
  formData.set("month", overview.month);

  for (const account of overview.accounts) {
    formData.append("accountId", account.id);
  }

  for (const rowKey of EDITABLE_BUDGET_ROW_KEYS) {
    for (const account of overview.accounts) {
      formData.set(`cell:${rowKey}:${account.id}`, cellValues[rowKey][account.id] ?? "0");
    }
  }

  for (const item of customItems) {
    formData.append("customItemId", item.id);
    formData.set(`custom:${item.id}:description`, item.description);
    formData.set(`custom:${item.id}:sortOrder`, String(item.sortOrder));

    for (const account of overview.accounts) {
      formData.set(`custom:${item.id}:account:${account.id}`, item.valuesByAccountId[account.id] ?? "0");
    }
  }

  return formData;
}

function createSaveSignature({
  overview,
  cellValues,
  customItems,
}: {
  overview: BudgetOverview;
  cellValues: EditableCellValues;
  customItems: readonly LocalCustomBudgetItem[];
}) {
  return JSON.stringify({
    month: overview.month,
    accounts: overview.accounts.map((account) => account.id),
    cellValues,
    customItems: customItems.map((item) => ({
      id: item.id,
      description: item.description,
      sortOrder: item.sortOrder,
      valuesByAccountId: item.valuesByAccountId,
    })),
  });
}

function isEditableBudgetRowKey(rowKey?: string): rowKey is EditableBudgetRowKey {
  return EDITABLE_BUDGET_ROW_KEYS.some((editableRowKey) => editableRowKey === rowKey);
}

function isEditableRow(row: BudgetTableRow, month: string) {
  if (!isEditableBudgetRowKey(row.rowKey)) {
    return false;
  }

  return row.rowKey !== "initial-balance" || month === FIRST_MONTH;
}

function MoneyCell({
  row,
  accountId,
}: {
  row: BudgetTableRow;
  accountId: string;
}) {
  const value = row.valuesByAccountId[accountId] ?? 0;

  return <>{formatEuroCents(value)}</>;
}

function EditableMoneyCell({
  row,
  accountId,
  accountName,
  disabled,
  value,
  onChange,
  onBlur,
}: {
  row: BudgetTableRow;
  accountId: string;
  accountName: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const displayValue = row.valuesByAccountId[accountId] ?? 0;

  if (disabled) {
    return <>{formatEuroCents(displayValue)}</>;
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      inputMode="decimal"
      aria-label={`${row.label} — ${accountName}`}
      className="h-6 w-full min-w-0 rounded border border-transparent bg-white/80 px-1 text-right tabular-nums text-slate-900 shadow-inner outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
    />
  );
}

function CustomItemLabelCell({
  item,
  deletingItemId,
  onDescriptionChange,
  onDescriptionBlur,
  onDelete,
}: {
  item: LocalCustomBudgetItem;
  deletingItemId: string | null;
  onDescriptionChange: (value: string) => void;
  onDescriptionBlur: () => void;
  onDelete: () => void;
}) {
  const label = item.description.trim() || "linha personalizada";

  return (
    <div className="grid grid-cols-[1fr_28px] items-center gap-1">
      <input
        value={item.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onBlur={onDescriptionBlur}
        aria-label={`Descrição da linha ${label}`}
        className="h-6 min-w-0 rounded border border-slate-200 bg-white px-1 text-sm font-medium text-slate-900 shadow-inner outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      <button
        type="button"
        disabled={deletingItemId === item.id}
        onClick={onDelete}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        aria-label={`Eliminar ${label}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function CustomItemMoneyCell({
  item,
  accountName,
  value,
  onChange,
  onBlur,
}: {
  item: LocalCustomBudgetItem;
  accountName: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const label = item.description.trim() || "Linha personalizada";

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      inputMode="decimal"
      aria-label={`${label} — ${accountName}`}
      className="h-6 w-full min-w-0 rounded border border-transparent bg-white/80 px-1 text-right tabular-nums text-slate-900 shadow-inner outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
    />
  );
}

function MonthlyDirectDebitsChecklist({
  occurrences,
  excludedByRuleId,
  saveStatus,
  saveError,
  onToggle,
}: {
  occurrences: readonly MonthlyDirectDebitOccurrence[];
  excludedByRuleId: Readonly<Record<string, boolean>>;
  saveStatus: SaveStatus;
  saveError: string | null;
  onToggle: (occurrence: MonthlyDirectDebitOccurrence, excludedFromForecast: boolean) => void;
}) {
  const groupedOccurrences = useMemo(() => {
    const groups = new Map<
      string,
      {
        accountId: string;
        accountName: string;
        accountSortOrder: number;
        items: MonthlyDirectDebitOccurrence[];
      }
    >();

    for (const occurrence of occurrences) {
      const group = groups.get(occurrence.accountId) ?? {
        accountId: occurrence.accountId,
        accountName: occurrence.accountName ?? "Conta arquivada",
        accountSortOrder: occurrence.accountSortOrder ?? Number.MAX_SAFE_INTEGER,
        items: [],
      };
      group.items.push(occurrence);
      groups.set(occurrence.accountId, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort(
          (left, right) =>
            Math.abs(right.amountCents) - Math.abs(left.amountCents) ||
            left.description.localeCompare(right.description),
        ),
      }))
      .sort(
        (left, right) =>
          left.accountSortOrder - right.accountSortOrder || left.accountName.localeCompare(right.accountName),
      );
  }, [occurrences]);
  const statusLabel =
    saveStatus === "saving"
      ? "A guardar…"
      : saveStatus === "saved"
        ? "Guardado"
        : saveStatus === "error"
          ? "Erro ao guardar"
          : null;

  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm 2xl:w-[360px]">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Débitos directos do mês</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Marque os valores que já estão reflectidos no saldo actual ou que não deverão ocorrer neste mês.
            </p>
          </div>
          {statusLabel ? (
            <p
              aria-live="polite"
              title={saveError ?? undefined}
              className={cn(
                "shrink-0 whitespace-nowrap text-xs font-medium",
                saveStatus === "error" ? "text-red-700" : "text-slate-500",
              )}
            >
              {statusLabel}
            </p>
          ) : null}
        </div>
      </div>

      {saveError && saveStatus === "error" ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{saveError}</div>
      ) : null}

      {groupedOccurrences.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-700">Não existem débitos directos previstos para este mês.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groupedOccurrences.map((group) => (
            <section key={group.accountId} className="px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.accountName}</h3>
              <ul className="mt-2 space-y-2">
                {group.items.map((occurrence) => {
                  const checked = excludedByRuleId[occurrence.ruleId] === true;

                  return (
                    <li key={occurrence.ruleId} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <label className="grid grid-cols-[18px_1fr_auto] items-start gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => onToggle(occurrence, event.target.checked)}
                          title="Excluir da previsão deste mês"
                          aria-label={`Excluir ${occurrence.description} da previsão deste mês`}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                        />
                        <span className={cn("min-w-0", checked && "text-slate-500 line-through")}>
                          {occurrence.description}
                        </span>
                        <span className={cn("whitespace-nowrap tabular-nums", checked ? "text-slate-400" : "text-red-700")}>
                          {formatEuroCents(-Math.abs(occurrence.amountCents))}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

function MonthlyCreditCardPaymentCards({
  payments,
  editable,
  overrideValues,
  overrideEnabled,
  saveStatus,
  saveError,
  onChange,
  onBlur,
  onToggleOverride,
}: {
  payments: readonly MonthlyCreditCardPayment[];
  editable: boolean;
  overrideValues: Readonly<Record<string, string>>;
  overrideEnabled: Readonly<Record<string, boolean>>;
  saveStatus: SaveStatus;
  saveError: string | null;
  onChange: (creditCardAccountId: string, value: string) => void;
  onBlur: (creditCardAccountId: string) => void;
  onToggleOverride: (payment: MonthlyCreditCardPayment, enabled: boolean) => void;
}) {
  const statusLabel =
    saveStatus === "saving"
      ? "A guardar…"
      : saveStatus === "saved"
        ? "Guardado"
        : saveStatus === "error"
          ? "Erro ao guardar"
          : null;

  return (
    <section className="space-y-2">
      {statusLabel ? (
        <p
          aria-live="polite"
          title={saveError ?? undefined}
          className={cn(
            "text-right text-xs font-medium",
            saveStatus === "error" ? "text-red-700" : "text-slate-500",
          )}
        >
          {statusLabel}
        </p>
      ) : null}
      {saveError && saveStatus === "error" ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</div>
      ) : null}

      {payments.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          Não existem cartões de crédito activos neste mês.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {payments.map((payment) => {
            const overrideValue = overrideValues[payment.creditCardAccountId] ?? "";
            const hasOverride = overrideEnabled[payment.creditCardAccountId] === true;
            const controlsDisabled = !editable || Boolean(payment.warning);
            const inputDisabled = controlsDisabled || !hasOverride;

            return (
              <article
                key={payment.creditCardAccountId}
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(120px,0.85fr)_minmax(140px,1fr)_auto] lg:items-center"
              >
                <h3 className="truncate text-sm font-semibold text-slate-900">{payment.creditCardName}</h3>
                <label className="min-w-0 text-xs font-medium text-slate-700">
                  Valor do extracto
                  <span className="sr-only"> — {payment.creditCardName}</span>
                  <input
                    value={overrideValue}
                    onChange={(event) => onChange(payment.creditCardAccountId, event.target.value)}
                    onBlur={() => onBlur(payment.creditCardAccountId)}
                    inputMode="decimal"
                    disabled={inputDisabled}
                    placeholder={formatEditableEuroCents(payment.automaticPaymentCents)}
                    aria-label={`Valor do extracto — ${payment.creditCardName}`}
                    className="mt-1 h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-right tabular-nums text-slate-900 shadow-inner outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>
                <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasOverride}
                    disabled={controlsDisabled}
                    onChange={(event) => onToggleOverride(payment, event.target.checked)}
                    aria-label={`Usar valor do extracto — ${payment.creditCardName}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600 disabled:opacity-60"
                  />
                  Usar valor do extracto
                </label>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MonthlyBudgetTable({
  overview,
  editable = false,
  saveBudgetAction,
  addCustomItemAction,
  deleteCustomItemAction,
  setDirectDebitExcludedAction,
  setCreditCardStatementOverrideAction,
}: MonthlyBudgetTableProps) {
  const [cellValues, setCellValues] = useState(() => createEditableCellValues(overview));
  const [customItems, setCustomItems] = useState(() => createCustomItemStates(overview));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [directDebitSaveStatus, setDirectDebitSaveStatus] = useState<SaveStatus>("idle");
  const [directDebitSaveError, setDirectDebitSaveError] = useState<string | null>(null);
  const [directDebitExclusions, setDirectDebitExclusions] = useState(() => createDirectDebitExclusionState(overview));
  const [creditCardOverrideValues, setCreditCardOverrideValues] = useState(() =>
    createCreditCardOverrideValues(overview),
  );
  const [creditCardOverrideEnabled, setCreditCardOverrideEnabled] = useState(() =>
    createCreditCardOverrideEnabledState(overview),
  );
  const [creditCardSaveStatus, setCreditCardSaveStatus] = useState<SaveStatus>("idle");
  const [creditCardSaveError, setCreditCardSaveError] = useState<string | null>(null);
  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const overviewRef = useRef(overview);
  const cellValuesRef = useRef(cellValues);
  const customItemsRef = useRef(customItems);
  const directDebitExclusionsRef = useRef(directDebitExclusions);
  const creditCardOverrideValuesRef = useRef(creditCardOverrideValues);
  const creditCardOverrideEnabledRef = useRef(creditCardOverrideEnabled);
  const directDebitSaveVersionsRef = useRef(new Map<string, number>());
  const creditCardSaveVersionsRef = useRef(new Map<string, number>());
  const creditCardSaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveBudgetActionRef = useRef(saveBudgetAction);
  const setDirectDebitExcludedActionRef = useRef(setDirectDebitExcludedAction);
  const setCreditCardStatementOverrideActionRef = useRef(setCreditCardStatementOverrideAction);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const saveAfterCurrentRef = useRef(false);
  const dirtyRef = useRef(false);
  const lastSavedSignatureRef = useRef(
    createSaveSignature({ overview, cellValues, customItems }),
  );

  const parsedCustomItems = useMemo(
    () => customItems.map((item) => parseCustomItemState(item, overview.accounts)),
    [customItems, overview.accounts],
  );
  const displayOverview = useMemo(() => {
    const displayState = calculateDisplayBudgetState({
      overview,
      cellValues,
      customItems: parsedCustomItems,
      directDebitExclusions,
      creditCardOverrideValues,
      creditCardOverrideEnabled,
    });

    return buildBudgetOverview({
      month: overview.month,
      accounts: overview.accounts,
      investmentAssets: overview.investmentAssets,
      snapshots: displayState.snapshots,
      customItems: parsedCustomItems,
      directDebitOccurrences: overview.directDebitOccurrences,
      dailyBudgetForecast: overview.dailyBudgetForecast,
      creditCardPayments: displayState.creditCardPayments,
    });
  }, [
    cellValues,
    creditCardOverrideEnabled,
    creditCardOverrideValues,
    directDebitExclusions,
    overview,
    parsedCustomItems,
  ]);
  const customItemById = useMemo(
    () => new Map(customItems.map((item) => [item.id, item])),
    [customItems],
  );

  const updateCellValues = useCallback((updater: (current: EditableCellValues) => EditableCellValues) => {
    setCellValues((current) => {
      const next = updater(current);
      cellValuesRef.current = next;
      return next;
    });
  }, []);

  const updateCustomItems = useCallback((updater: (current: LocalCustomBudgetItem[]) => LocalCustomBudgetItem[]) => {
    setCustomItems((current) => {
      const next = updater(current);
      customItemsRef.current = next;
      return next;
    });
  }, []);

  const updateDirectDebitExclusions = useCallback(
    (updater: (current: Record<string, boolean>) => Record<string, boolean>) => {
      setDirectDebitExclusions((current) => {
        const next = updater(current);
        directDebitExclusionsRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateCreditCardOverrideValues = useCallback(
    (updater: (current: Record<string, string>) => Record<string, string>) => {
      const next = updater(creditCardOverrideValuesRef.current);
      creditCardOverrideValuesRef.current = next;
      setCreditCardOverrideValues(next);
    },
    [],
  );

  const updateCreditCardOverrideEnabled = useCallback(
    (updater: (current: Record<string, boolean>) => Record<string, boolean>) => {
      const next = updater(creditCardOverrideEnabledRef.current);
      creditCardOverrideEnabledRef.current = next;
      setCreditCardOverrideEnabled(next);
    },
    [],
  );

  const getCreditCardStatementAmountForSave = useCallback((creditCardAccountId: string, overrideValue?: string) => {
    if (!creditCardOverrideEnabledRef.current[creditCardAccountId]) {
      return "";
    }

    const value = overrideValue ?? creditCardOverrideValuesRef.current[creditCardAccountId] ?? "";
    const parsed = tryParseCurrencyInput(value.trim() || "0");

    if (parsed === null || parsed < 0) {
      return null;
    }

    return value.trim() || "0,00";
  }, []);

  const flushCreditCardOverride = useCallback(
    async (creditCardAccountId: string, overrideValue?: string) => {
      const action = setCreditCardStatementOverrideActionRef.current;

      if (!action) {
        return;
      }

      const timer = creditCardSaveTimersRef.current.get(creditCardAccountId);

      if (timer) {
        clearTimeout(timer);
        creditCardSaveTimersRef.current.delete(creditCardAccountId);
      }

      const version = (creditCardSaveVersionsRef.current.get(creditCardAccountId) ?? 0) + 1;
      creditCardSaveVersionsRef.current.set(creditCardAccountId, version);
      setCreditCardSaveStatus("saving");
      setCreditCardSaveError(null);

      const formData = new FormData();
      const statementAmount = getCreditCardStatementAmountForSave(creditCardAccountId, overrideValue);

      if (statementAmount === null) {
        setCreditCardSaveStatus("error");
        setCreditCardSaveError("O valor do extracto não pode ser negativo.");
        return;
      }

      formData.set("creditCardAccountId", creditCardAccountId);
      formData.set("month", overviewRef.current.month);
      formData.set("statementAmount", statementAmount);

      const result = await action(formData);

      if (creditCardSaveVersionsRef.current.get(creditCardAccountId) !== version) {
        return;
      }

      if (!result.ok) {
        setCreditCardSaveStatus("error");
        setCreditCardSaveError(result.error);
        return;
      }

      updateCreditCardOverrideValues((current) => ({
        ...current,
        [result.override.creditCardAccountId]:
          result.override.statementAmountCents === null
            ? ""
            : formatEditableEuroCents(result.override.statementAmountCents),
      }));
      updateCreditCardOverrideEnabled((current) => ({
        ...current,
        [result.override.creditCardAccountId]: result.override.statementAmountCents !== null,
      }));
      setCreditCardSaveStatus("saved");
      setCreditCardSaveError(null);
    },
    [getCreditCardStatementAmountForSave, updateCreditCardOverrideEnabled, updateCreditCardOverrideValues],
  );

  const scheduleCreditCardOverrideSave = useCallback(
    (creditCardAccountId: string) => {
      if (!editable || !setCreditCardStatementOverrideActionRef.current) {
        return;
      }

      const currentTimer = creditCardSaveTimersRef.current.get(creditCardAccountId);

      if (currentTimer) {
        clearTimeout(currentTimer);
      }

      setCreditCardSaveStatus("saving");
      setCreditCardSaveError(null);
      creditCardSaveTimersRef.current.set(
        creditCardAccountId,
        setTimeout(() => {
          void flushCreditCardOverride(creditCardAccountId);
        }, AUTOSAVE_DELAY_MS),
      );
    },
    [editable, flushCreditCardOverride],
  );

  const flushSave = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    const action = saveBudgetActionRef.current;

    if (!action) {
      dirtyRef.current = false;
      return;
    }

    if (saveInFlightRef.current) {
      saveAfterCurrentRef.current = true;
      await saveInFlightRef.current;
      return;
    }

    if (!dirtyRef.current) {
      return;
    }

    const runSave = async () => {
      while (dirtyRef.current) {
        saveAfterCurrentRef.current = false;
        const currentOverview = overviewRef.current;
        const currentCellValues = cellValuesRef.current;
        const currentCustomItems = customItemsRef.current;
        const signature = createSaveSignature({
          overview: currentOverview,
          cellValues: currentCellValues,
          customItems: currentCustomItems,
        });

        if (signature === lastSavedSignatureRef.current) {
          dirtyRef.current = false;
          break;
        }

        dirtyRef.current = false;
        setSaveStatus("saving");
        setSaveError(null);

        const result = await action(
          buildSaveFormData({
            overview: currentOverview,
            cellValues: currentCellValues,
            customItems: currentCustomItems,
          }),
        );

        if (!result.ok) {
          dirtyRef.current = true;
          setSaveStatus("error");
          setSaveError(result.error);
          break;
        }

        lastSavedSignatureRef.current = signature;

        if (saveAfterCurrentRef.current || dirtyRef.current) {
          dirtyRef.current = true;
          continue;
        }

        setSaveStatus("saved");
        setSaveError(null);
      }
    };

    const savePromise = runSave().finally(() => {
      saveInFlightRef.current = null;
    });
    saveInFlightRef.current = savePromise;

    await savePromise;
  }, []);

  const scheduleSave = useCallback(() => {
    if (!editable || !saveBudgetActionRef.current) {
      return;
    }

    dirtyRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);

    if (saveInFlightRef.current) {
      saveAfterCurrentRef.current = true;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_DELAY_MS);
  }, [editable, flushSave]);

  const normaliseCellValue = useCallback(
    (rowKey: EditableBudgetRowKey, accountId: string) => {
      updateCellValues((current) => ({
        ...current,
        [rowKey]: {
          ...current[rowKey],
          [accountId]: normaliseCurrencyInput(current[rowKey][accountId] ?? "0"),
        },
      }));
    },
    [updateCellValues],
  );

  const normaliseCustomValue = useCallback(
    (customItemId: string, accountId: string) => {
      updateCustomItems((current) =>
        current.map((item) =>
          item.id === customItemId
            ? {
                ...item,
                valuesByAccountId: {
                  ...item.valuesByAccountId,
                  [accountId]: normaliseCurrencyInput(item.valuesByAccountId[accountId] ?? "0"),
                },
              }
            : item,
        ),
      );
    },
    [updateCustomItems],
  );

  const normaliseCreditCardOverrideValue = useCallback(
    (creditCardAccountId: string) => {
      updateCreditCardOverrideValues((current) => {
        const currentValue = current[creditCardAccountId] ?? "";
        const parsed = tryParseCurrencyInput(currentValue);

        if (!creditCardOverrideEnabledRef.current[creditCardAccountId]) {
          return current;
        }

        return {
          ...current,
          [creditCardAccountId]: parsed === null || parsed < 0 ? currentValue : formatEditableEuroCents(parsed),
        };
      });
    },
    [updateCreditCardOverrideValues],
  );

  const handleCreditCardOverrideChange = useCallback(
    (creditCardAccountId: string, value: string) => {
      const parsed = tryParseCurrencyInput(value);
      const trimmedValue = value.trim();

      if (trimmedValue.startsWith("-") || trimmedValue.startsWith("(") || (parsed !== null && parsed < 0)) {
        setCreditCardSaveStatus("error");
        setCreditCardSaveError("O valor do extracto não pode ser negativo.");
        return;
      }

      updateCreditCardOverrideValues((current) => ({
        ...current,
        [creditCardAccountId]: value,
      }));
      scheduleCreditCardOverrideSave(creditCardAccountId);
    },
    [scheduleCreditCardOverrideSave, updateCreditCardOverrideValues],
  );

  const handleCreditCardOverrideBlur = useCallback(
    (creditCardAccountId: string) => {
      normaliseCreditCardOverrideValue(creditCardAccountId);
      void flushCreditCardOverride(creditCardAccountId);
    },
    [flushCreditCardOverride, normaliseCreditCardOverrideValue],
  );

  const handleCreditCardOverrideToggle = useCallback(
    (payment: MonthlyCreditCardPayment, enabled: boolean) => {
      const nextValue = enabled
        ? creditCardOverrideValuesRef.current[payment.creditCardAccountId]?.trim() ||
          formatEditableEuroCents(payment.automaticPaymentCents)
        : "";

      updateCreditCardOverrideEnabled((current) => ({
        ...current,
        [payment.creditCardAccountId]: enabled,
      }));
      updateCreditCardOverrideValues((current) => ({
        ...current,
        [payment.creditCardAccountId]: nextValue,
      }));
      void flushCreditCardOverride(payment.creditCardAccountId, nextValue);
    },
    [flushCreditCardOverride, updateCreditCardOverrideEnabled, updateCreditCardOverrideValues],
  );

  const handleAddCustomItem = useCallback(async () => {
    if (!addCustomItemAction || isAddingCustomItem) {
      return;
    }

    await flushSave();
    setIsAddingCustomItem(true);
    setSaveStatus("saving");
    setSaveError(null);

    const formData = new FormData();
    formData.set("month", overviewRef.current.month);
    const result = await addCustomItemAction(formData);

    if (!result.ok) {
      setSaveStatus("error");
      setSaveError(result.error);
      setIsAddingCustomItem(false);
      return;
    }

    updateCustomItems((current) => [
      ...current,
      createCustomItemState(result.item, overviewRef.current.accounts),
    ]);
    lastSavedSignatureRef.current = createSaveSignature({
      overview: overviewRef.current,
      cellValues: cellValuesRef.current,
      customItems: customItemsRef.current,
    });
    dirtyRef.current = false;
    setSaveStatus("saved");
    setIsAddingCustomItem(false);
  }, [addCustomItemAction, flushSave, isAddingCustomItem, updateCustomItems]);

  const handleDeleteCustomItem = useCallback(
    async (itemId: string) => {
      await flushSave();

      if (itemId.startsWith("temp:")) {
        updateCustomItems((current) => current.filter((item) => item.id !== itemId));
        scheduleSave();
        return;
      }

      if (!deleteCustomItemAction || deletingItemId) {
        return;
      }

      setDeletingItemId(itemId);
      setSaveStatus("saving");
      setSaveError(null);

      const formData = new FormData();
      formData.set("month", overviewRef.current.month);
      formData.set("customItemId", itemId);
      const result = await deleteCustomItemAction(formData);

      if (!result.ok) {
        setSaveStatus("error");
        setSaveError(result.error);
        setDeletingItemId(null);
        return;
      }

      updateCustomItems((current) => current.filter((item) => item.id !== itemId));
      lastSavedSignatureRef.current = createSaveSignature({
        overview: overviewRef.current,
        cellValues: cellValuesRef.current,
        customItems: customItemsRef.current,
      });
      dirtyRef.current = false;
      setSaveStatus("saved");
      setSaveError(null);
      setDeletingItemId(null);
    },
    [deleteCustomItemAction, deletingItemId, flushSave, scheduleSave, updateCustomItems],
  );

  const handleDirectDebitToggle = useCallback(
    async (occurrence: MonthlyDirectDebitOccurrence, excludedFromForecast: boolean) => {
      const action = setDirectDebitExcludedActionRef.current;

      if (!action) {
        return;
      }

      const previousValue = directDebitExclusionsRef.current[occurrence.ruleId] === true;
      const version = (directDebitSaveVersionsRef.current.get(occurrence.ruleId) ?? 0) + 1;
      directDebitSaveVersionsRef.current.set(occurrence.ruleId, version);

      updateDirectDebitExclusions((current) => ({
        ...current,
        [occurrence.ruleId]: excludedFromForecast,
      }));
      setDirectDebitSaveStatus("saving");
      setDirectDebitSaveError(null);

      const formData = new FormData();
      formData.set("recurringRuleId", occurrence.ruleId);
      formData.set("month", occurrence.month);
      formData.set("excludedFromForecast", String(excludedFromForecast));

      const result = await action(formData);

      if (directDebitSaveVersionsRef.current.get(occurrence.ruleId) !== version) {
        return;
      }

      if (!result.ok) {
        updateDirectDebitExclusions((current) => ({
          ...current,
          [occurrence.ruleId]: previousValue,
        }));
        setDirectDebitSaveStatus("error");
        setDirectDebitSaveError(result.error);
        return;
      }

      updateDirectDebitExclusions((current) => ({
        ...current,
        [occurrence.ruleId]: result.state.excludedFromForecast,
      }));
      setDirectDebitSaveStatus("saved");
      setDirectDebitSaveError(null);
    },
    [updateDirectDebitExclusions],
  );

  useEffect(() => {
    saveBudgetActionRef.current = saveBudgetAction;
  }, [saveBudgetAction]);

  useEffect(() => {
    setDirectDebitExcludedActionRef.current = setDirectDebitExcludedAction;
  }, [setDirectDebitExcludedAction]);

  useEffect(() => {
    setCreditCardStatementOverrideActionRef.current = setCreditCardStatementOverrideAction;
  }, [setCreditCardStatementOverrideAction]);

  useEffect(() => {
    const nextCellValues = createEditableCellValues(overview);
    const nextCustomItems = createCustomItemStates(overview);
    const nextDirectDebitExclusions = createDirectDebitExclusionState(overview);
    const nextCreditCardOverrideValues = createCreditCardOverrideValues(overview);
    const nextCreditCardOverrideEnabled = createCreditCardOverrideEnabledState(overview);

    overviewRef.current = overview;
    cellValuesRef.current = nextCellValues;
    customItemsRef.current = nextCustomItems;
    directDebitExclusionsRef.current = nextDirectDebitExclusions;
    creditCardOverrideValuesRef.current = nextCreditCardOverrideValues;
    creditCardOverrideEnabledRef.current = nextCreditCardOverrideEnabled;
    directDebitSaveVersionsRef.current.clear();
    creditCardSaveVersionsRef.current.clear();
    dirtyRef.current = false;
    saveAfterCurrentRef.current = false;
    lastSavedSignatureRef.current = createSaveSignature({
      overview,
      cellValues: nextCellValues,
      customItems: nextCustomItems,
    });

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    for (const timer of creditCardSaveTimersRef.current.values()) {
      clearTimeout(timer);
    }
    creditCardSaveTimersRef.current.clear();

    setCellValues(nextCellValues);
    setCustomItems(nextCustomItems);
    setDirectDebitExclusions(nextDirectDebitExclusions);
    setCreditCardOverrideValues(nextCreditCardOverrideValues);
    setCreditCardOverrideEnabled(nextCreditCardOverrideEnabled);
    setSaveStatus("idle");
    setSaveError(null);
    setDirectDebitSaveStatus("idle");
    setDirectDebitSaveError(null);
    setCreditCardSaveStatus("idle");
    setCreditCardSaveError(null);
  }, [overview]);

  useEffect(() => {
    const flushPendingCreditCardOverrides = () => {
      for (const creditCardAccountId of creditCardSaveTimersRef.current.keys()) {
        void flushCreditCardOverride(creditCardAccountId);
      }
    };
    const handleBeforeUnload = () => {
      void flushSave();
      flushPendingCreditCardOverrides();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void flushSave();
      flushPendingCreditCardOverrides();
    };
  }, [flushCreditCardOverride, flushSave]);

  const columnCount = displayOverview.accounts.length + 2;
  const tableWidthPx =
    DESCRIPTION_COLUMN_WIDTH_PX + displayOverview.accounts.length * ACCOUNT_COLUMN_WIDTH_PX + TOTAL_COLUMN_WIDTH_PX;
  const statusLabel =
    saveStatus === "saving"
      ? "A guardar…"
      : saveStatus === "saved"
        ? "Guardado"
        : saveStatus === "error"
          ? "Erro ao guardar"
          : null;

  return (
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,max-content)_360px]">
      <div className="space-y-3">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">{UI_TEXT.budget.monthlyTable}</h2>
          {editable && statusLabel ? (
            <p
              aria-live="polite"
              title={saveError ?? undefined}
              className={cn(
                "text-xs font-medium",
                saveStatus === "error" ? "text-red-700" : "text-slate-500",
              )}
            >
              {statusLabel}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: tableWidthPx }}>
          <caption className="sr-only">{UI_TEXT.budget.monthlyTable}</caption>
          <colgroup>
            <col style={{ width: DESCRIPTION_COLUMN_WIDTH_PX }} />
            {displayOverview.accounts.map((account) => (
              <col key={account.id} style={{ width: ACCOUNT_COLUMN_WIDTH_PX }} />
            ))}
            <col style={{ width: TOTAL_COLUMN_WIDTH_PX }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="sticky left-0 z-30 w-[228px] min-w-[228px] max-w-[228px] border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                {UI_TEXT.budget.rowHeader}
              </th>
              {displayOverview.accounts.map((account) => (
                <th
                  key={account.id}
                  title={account.name}
                  className="w-[132px] min-w-[132px] max-w-[132px] border-b border-slate-200 px-2 py-1.5 text-right align-bottom"
                >
                  <span className={cn("block", account.name.length > 16 && "whitespace-normal")}>
                    {getAccountDisplayName(account)}
                  </span>
                </th>
              ))}
              <th className="w-[132px] min-w-[132px] max-w-[132px] border-b border-slate-200 bg-slate-100 px-2 py-1.5 text-right align-bottom text-slate-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {displayOverview.tableSections.map((section, sectionIndex) => (
              <Fragment key={section.key}>
                {shouldShowSectionHeader(section.key) ? (
                  <tr className={cn(sectionIndex > 0 && "border-t border-slate-200")}>
                    <th
                      colSpan={columnCount}
                      scope="rowgroup"
                      className="bg-slate-100 px-2 py-1 text-left text-xs font-semibold uppercase text-slate-600"
                    >
                      {section.label}
                    </th>
                  </tr>
                ) : null}
                {section.rows.map((row) => {
                  const customItem = row.customItem ? customItemById.get(row.customItem.id) : undefined;
                  const editableRowKey = isEditableBudgetRowKey(row.rowKey) ? row.rowKey : null;

                  return (
                    <tr key={row.key} className={getRowClassName(row.tone)}>
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-10 w-[228px] min-w-[228px] max-w-[228px] bg-inherit px-2 py-0.5 text-left font-medium text-slate-800",
                          getToneCellClassName(row.tone),
                          row.tone === "final" && "text-slate-950",
                        )}
                      >
                        {editable && customItem ? (
                          <CustomItemLabelCell
                            item={customItem}
                            deletingItemId={deletingItemId}
                            onDescriptionChange={(value) => {
                              updateCustomItems((current) =>
                                current.map((item) =>
                                  item.id === customItem.id ? { ...item, description: value } : item,
                                ),
                              );
                              scheduleSave();
                            }}
                            onDescriptionBlur={() => void flushSave()}
                            onDelete={() => void handleDeleteCustomItem(customItem.id)}
                          />
                        ) : (
                          row.label
                        )}
                      </th>
                      {displayOverview.accounts.map((account) => (
                        <td
                          key={account.id}
                          className={getValueClassName({
                            value: row.valuesByAccountId[account.id] ?? 0,
                            isCreditCard: account.isCreditCard,
                            tone: row.tone,
                          })}
                        >
                          {editable && customItem ? (
                            <CustomItemMoneyCell
                              item={customItem}
                              accountName={getAccountDisplayName(account)}
                              value={customItem.valuesByAccountId[account.id] ?? "0,00"}
                              onChange={(value) => {
                                updateCustomItems((current) =>
                                  current.map((item) =>
                                    item.id === customItem.id
                                      ? {
                                          ...item,
                                          valuesByAccountId: {
                                            ...item.valuesByAccountId,
                                            [account.id]: value,
                                          },
                                        }
                                      : item,
                                  ),
                                );
                                scheduleSave();
                              }}
                              onBlur={() => {
                                normaliseCustomValue(customItem.id, account.id);
                                void flushSave();
                              }}
                            />
                          ) : editable ? (
                            <EditableMoneyCell
                              row={row}
                              accountId={account.id}
                              accountName={getAccountDisplayName(account)}
                              disabled={!isEditableRow(row, displayOverview.month)}
                              value={
                                editableRowKey ? cellValues[editableRowKey][account.id] ?? "0,00" : "0,00"
                              }
                              onChange={(value) => {
                                if (!editableRowKey) {
                                  return;
                                }

                                updateCellValues((current) => ({
                                  ...current,
                                  [editableRowKey]: {
                                    ...current[editableRowKey],
                                    [account.id]: value,
                                  },
                                }));
                                scheduleSave();
                              }}
                              onBlur={() => {
                                if (editableRowKey) {
                                  normaliseCellValue(editableRowKey, account.id);
                                }

                                void flushSave();
                              }}
                            />
                          ) : (
                            <MoneyCell row={row} accountId={account.id} />
                          )}
                        </td>
                      ))}
                      <td className={getValueClassName({ value: row.totalCents, tone: row.tone, isTotal: true })}>
                        {formatEuroCents(row.totalCents)}
                      </td>
                    </tr>
                  );
                })}
                {section.key === "monthly-forecasts" && editable && addCustomItemAction ? (
                  <tr className="hover:bg-slate-50">
                    <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left">
                      <button
                        type="button"
                        disabled={isAddingCustomItem}
                        onClick={() => void handleAddCustomItem()}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Adicionar linha
                      </button>
                    </th>
                    <td colSpan={displayOverview.accounts.length + 1} className="bg-white px-2 py-1" />
                  </tr>
                ) : null}
              </Fragment>
            ))}

            <tr>
              <th
                scope="rowgroup"
                className="sticky left-0 z-10 bg-slate-100 px-2 py-1 text-left text-xs font-semibold uppercase text-slate-600"
              >
                {UI_TEXT.budget.heritageSection}
              </th>
              <td colSpan={displayOverview.accounts.length + 1} className="bg-slate-100 px-2 py-1" />
            </tr>
            <tr>
              <th colSpan={displayOverview.accounts.length + 1} scope="row" className="px-2 py-1 text-right font-medium">
                {UI_TEXT.budget.investments}
              </th>
              <td className="w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-800">
                {formatEuroCents(displayOverview.investmentTotalCents)}
              </td>
            </tr>
            <tr className="border-y-2 border-brand-200 bg-brand-50">
              <th
                colSpan={displayOverview.accounts.length + 1}
                scope="row"
                className="px-2 py-1 text-right font-semibold text-slate-950"
              >
                {UI_TEXT.budget.netWorth}
              </th>
              <td className="w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap px-2 py-1 text-right font-semibold tabular-nums text-slate-950">
                {formatEuroCents(displayOverview.netWorthCents)}
              </td>
            </tr>
          </tbody>
          </table>
        </div>
        </section>

        <MonthlyCreditCardPaymentCards
          payments={displayOverview.creditCardPayments}
          editable={editable}
          overrideValues={creditCardOverrideValues}
          overrideEnabled={creditCardOverrideEnabled}
          saveStatus={creditCardSaveStatus}
          saveError={creditCardSaveError}
          onChange={handleCreditCardOverrideChange}
          onBlur={handleCreditCardOverrideBlur}
          onToggleOverride={handleCreditCardOverrideToggle}
        />
      </div>

      <div className="space-y-4">
        <MonthlyDirectDebitsChecklist
          occurrences={displayOverview.directDebitOccurrences}
          excludedByRuleId={directDebitExclusions}
          saveStatus={directDebitSaveStatus}
          saveError={directDebitSaveError}
          onToggle={(occurrence, excludedFromForecast) =>
            void handleDirectDebitToggle(occurrence, excludedFromForecast)
          }
        />
      </div>
    </div>
  );
}
