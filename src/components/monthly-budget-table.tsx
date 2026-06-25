import { Plus, Save, Trash2 } from "lucide-react";
import { Fragment } from "react";
import type { BudgetOverview, BudgetRowTone, BudgetTableRow } from "@/domain/budget/monthly-view";
import { EDITABLE_BUDGET_ROW_KEYS } from "@/domain/budget/monthly-view";
import { getAccountDisplayName } from "@/domain/budget/accounts";
import { formatEditableEuroCents, formatEuroCents, type Cents } from "@/domain/budget/money";
import { FIRST_MONTH } from "@/domain/budget/months";
import { cn } from "@/lib/cn";
import { UI_TEXT } from "@/content/ui-text";

type MonthlyBudgetTableProps = {
  overview: BudgetOverview;
  editable?: boolean;
  addCustomItemAction?: (formData: FormData) => void | Promise<void>;
  deleteCustomItemAction?: (formData: FormData) => void | Promise<void>;
};

const DESCRIPTION_COLUMN_WIDTH_PX = 228;
const ACCOUNT_COLUMN_WIDTH_PX = 132;
const TOTAL_COLUMN_WIDTH_PX = 132;

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

function isEditableRow(row: BudgetTableRow, month: string) {
  if (!row.rowKey || !EDITABLE_BUDGET_ROW_KEYS.some((rowKey) => rowKey === row.rowKey)) {
    return false;
  }

  return row.rowKey !== "initial-balance" || month === FIRST_MONTH;
}

function EditableMoneyCell({
  row,
  accountId,
  accountName,
  disabled,
}: {
  row: BudgetTableRow;
  accountId: string;
  accountName: string;
  disabled: boolean;
}) {
  const value = row.valuesByAccountId[accountId] ?? 0;

  if (disabled) {
    return <>{formatEuroCents(value)}</>;
  }

  return (
    <input
      name={`cell:${row.key}:${accountId}`}
      defaultValue={formatEditableEuroCents(value)}
      inputMode="decimal"
      aria-label={`${row.label} — ${accountName}`}
      className="h-6 w-full min-w-0 rounded border border-transparent bg-white/80 px-1 text-right tabular-nums text-slate-900 shadow-inner outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
    />
  );
}

function CustomItemLabelCell({
  row,
  deleteCustomItemAction,
}: {
  row: BudgetTableRow;
  deleteCustomItemAction?: (formData: FormData) => void | Promise<void>;
}) {
  const item = row.customItem;

  if (!item) {
    return row.label;
  }

  return (
    <div className="grid grid-cols-[1fr_78px_28px] items-center gap-1">
      <input type="hidden" name="customItemId" value={item.id} />
      <input type="hidden" name={`custom:${item.id}:sortOrder`} value={item.sortOrder} />
      <input
        name={`custom:${item.id}:description`}
        defaultValue={item.description}
        aria-label={`Descrição da linha ${item.description}`}
        className="h-6 min-w-0 rounded border border-slate-200 bg-white px-1 text-sm font-medium text-slate-900 shadow-inner outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      <select
        name={`custom:${item.id}:category`}
        defaultValue={item.category}
        aria-label={`Tipo da linha ${item.description}`}
        className="h-6 rounded border-slate-200 bg-white px-1 text-xs text-slate-900 shadow-inner focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <option value="expense">Despesa</option>
        <option value="income">Entrada</option>
      </select>
      {deleteCustomItemAction ? (
        <button
          type="submit"
          formAction={deleteCustomItemAction}
          name="deleteCustomItemId"
          value={item.id}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-200 bg-white text-red-700 hover:bg-red-50"
          aria-label={`Eliminar ${item.description}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function CustomItemMoneyCell({
  row,
  accountId,
}: {
  row: BudgetTableRow;
  accountId: string;
}) {
  const item = row.customItem;

  if (!item) {
    return <MoneyCell row={row} accountId={accountId} />;
  }

  const value = Math.abs(item.valuesByAccountId[accountId] ?? 0);

  return (
    <input
      name={`custom:${item.id}:account:${accountId}`}
      defaultValue={formatEditableEuroCents(value)}
      inputMode="decimal"
      aria-label={`${item.description} — ${accountId}`}
      className="h-6 w-full min-w-0 rounded border border-transparent bg-white/80 px-1 text-right tabular-nums text-slate-900 shadow-inner outline-none transition focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
    />
  );
}

export function MonthlyBudgetTable({
  overview,
  editable = false,
  addCustomItemAction,
  deleteCustomItemAction,
}: MonthlyBudgetTableProps) {
  const columnCount = overview.accounts.length + 2;
  const tableWidthPx =
    DESCRIPTION_COLUMN_WIDTH_PX + overview.accounts.length * ACCOUNT_COLUMN_WIDTH_PX + TOTAL_COLUMN_WIDTH_PX;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-950">{UI_TEXT.budget.monthlyTable}</h2>
        <button
          type={editable ? "submit" : "button"}
          className="inline-flex items-center justify-center rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
        >
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          {editable ? UI_TEXT.budget.saveChanges : UI_TEXT.budget.movement}
        </button>
      </div>

      <div className="overflow-x-auto">
        {overview.accounts.map((account) => (
          <input key={account.id} type="hidden" name="accountId" value={account.id} />
        ))}
        <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: tableWidthPx }}>
          <caption className="sr-only">{UI_TEXT.budget.monthlyTable}</caption>
          <colgroup>
            <col style={{ width: DESCRIPTION_COLUMN_WIDTH_PX }} />
            {overview.accounts.map((account) => (
              <col key={account.id} style={{ width: ACCOUNT_COLUMN_WIDTH_PX }} />
            ))}
            <col style={{ width: TOTAL_COLUMN_WIDTH_PX }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
                  <th className="sticky left-0 z-30 w-[228px] min-w-[228px] max-w-[228px] border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                {UI_TEXT.budget.rowHeader}
              </th>
              {overview.accounts.map((account) => (
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
            {overview.tableSections.map((section, sectionIndex) => (
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
                {section.rows.map((row) => (
                  <tr key={row.key} className={getRowClassName(row.tone)}>
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 w-[228px] min-w-[228px] max-w-[228px] bg-inherit px-2 py-0.5 text-left font-medium text-slate-800",
                        getToneCellClassName(row.tone),
                        row.tone === "final" && "text-slate-950",
                      )}
                    >
                      {editable && row.customItem ? (
                        <CustomItemLabelCell row={row} deleteCustomItemAction={deleteCustomItemAction} />
                      ) : (
                        row.label
                      )}
                    </th>
                    {overview.accounts.map((account) => (
                      <td
                        key={account.id}
                        className={getValueClassName({
                          value: row.valuesByAccountId[account.id] ?? 0,
                          isCreditCard: account.isCreditCard,
                          tone: row.tone,
                        })}
                      >
                        {editable && row.customItem ? (
                          <CustomItemMoneyCell row={row} accountId={account.id} />
                        ) : editable ? (
                          <EditableMoneyCell
                            row={row}
                            accountId={account.id}
                            accountName={getAccountDisplayName(account)}
                            disabled={!isEditableRow(row, overview.month)}
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
                ))}
                {section.key === "monthly-forecasts" && editable && addCustomItemAction ? (
                  <tr className="hover:bg-slate-50">
                    <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left">
                      <button
                        type="submit"
                        formAction={addCustomItemAction}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Adicionar linha
                      </button>
                    </th>
                    <td colSpan={overview.accounts.length + 1} className="bg-white px-2 py-1" />
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
              <td colSpan={overview.accounts.length + 1} className="bg-slate-100 px-2 py-1" />
            </tr>
            <tr>
              <th colSpan={overview.accounts.length + 1} scope="row" className="px-2 py-1 text-right font-medium">
                {UI_TEXT.budget.investments}
              </th>
              <td className="w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-800">
                {formatEuroCents(overview.investmentTotalCents)}
              </td>
            </tr>
            <tr className="border-y-2 border-brand-200 bg-brand-50">
              <th
                colSpan={overview.accounts.length + 1}
                scope="row"
                className="px-2 py-1 text-right font-semibold text-slate-950"
              >
                {UI_TEXT.budget.netWorth}
              </th>
              <td className="w-[132px] min-w-[132px] max-w-[132px] whitespace-nowrap px-2 py-1 text-right font-semibold tabular-nums text-slate-950">
                {formatEuroCents(overview.netWorthCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
