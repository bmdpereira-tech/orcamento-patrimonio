"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateIgcpTable,
  canPersistIgcpRows,
  createBlankIgcpRow,
  IGCP_MONTHS,
  IGCP_STORAGE_KEY,
  INITIAL_IGCP_ROWS,
  normaliseIgcpFieldValue,
  parseStoredIgcpRows,
  type IgcpEditableField,
  type IgcpSubscriptionRow,
} from "@/domain/budget/igcp";
import { formatEuroCents, type Cents } from "@/domain/budget/money";

const fieldLabels: Record<IgcpEditableField, string> = {
  subscriptionDate: "Data subscrição",
  subscriptionAmount: "Montante subscrição",
  currentAmount: "Montante à data",
  annualRate: "Taxa juro anual",
};

type StorageStatus = "idle" | "saved" | "blocked" | "error";

function inputClassName({ hasError, align = "text-left" }: { hasError: boolean; align?: string }) {
  return [
    "h-7 w-full rounded border bg-white px-1.5 py-0.5 text-xs leading-5 text-slate-950 shadow-none outline-none transition focus:ring-1",
    align,
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-transparent hover:border-slate-300 focus:border-brand-600 focus:ring-brand-600",
  ].join(" ");
}

function tableMoneyClassName(value: Cents) {
  return [
    "whitespace-nowrap px-2 py-0.5 text-right tabular-nums",
    value === 0 ? "text-slate-400" : "text-slate-950",
  ].join(" ");
}

function statusLabel(status: StorageStatus) {
  switch (status) {
    case "saved":
      return "Guardado localmente";
    case "blocked":
      return "Campos inválidos por guardar";
    case "error":
      return "Não foi possível guardar localmente";
    case "idle":
      return null;
  }
}

export function IgcpManagement() {
  const [rows, setRows] = useState<IgcpSubscriptionRow[]>(INITIAL_IGCP_ROWS);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("idle");
  const nextRowIdRef = useRef(1);
  const table = useMemo(() => calculateIgcpTable(rows), [rows]);

  useEffect(() => {
    try {
      const storedRows = parseStoredIgcpRows(window.localStorage.getItem(IGCP_STORAGE_KEY) ?? "");

      if (storedRows) {
        setRows(storedRows);
      }
    } catch {
      setStorageStatus("error");
    } finally {
      setHasLoadedStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    if (!canPersistIgcpRows(rows)) {
      setStorageStatus("blocked");
      return;
    }

    try {
      window.localStorage.setItem(IGCP_STORAGE_KEY, JSON.stringify(rows));
      setStorageStatus("saved");
    } catch {
      setStorageStatus("error");
    }
  }, [hasLoadedStorage, rows]);

  const updateField = (rowId: string, field: IgcpEditableField, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const normaliseField = (rowId: string, field: IgcpEditableField) => {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const normalisedValue = normaliseIgcpFieldValue(field, row[field]);

        return normalisedValue === null ? row : { ...row, [field]: normalisedValue };
      }),
    );
  };

  const addRow = () => {
    const rowId = `igcp-new-${Date.now()}-${nextRowIdRef.current}`;
    nextRowIdRef.current += 1;
    setRows((currentRows) => [...currentRows, createBlankIgcpRow(rowId)]);
  };

  const removeRow = (rowId: string) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  };

  const currentStatusLabel = table.hasInvalidFields ? statusLabel("blocked") : statusLabel(storageStatus);

  return (
    <div className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1800px] -translate-x-1/2 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">IGCP</p>
          <h1 className="text-2xl font-semibold text-slate-950">Juros trimestrais previstos</h1>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar linha
        </button>
      </div>

      {currentStatusLabel ? (
        <p
          role={table.hasInvalidFields ? "alert" : undefined}
          aria-live="polite"
          className={table.hasInvalidFields ? "text-xs font-medium text-red-700" : "text-xs font-medium text-slate-500"}
        >
          {currentStatusLabel}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-fixed border-separate border-spacing-0 text-xs" style={{ width: 1730 }}>
            <caption className="sr-only">Tabela IGCP de juros trimestrais líquidos previstos</caption>
            <colgroup>
              <col style={{ width: 122 }} />
              <col style={{ width: 136 }} />
              <col style={{ width: 136 }} />
              <col style={{ width: 100 }} />
              {IGCP_MONTHS.map((month) => (
                <col key={month.key} style={{ width: 96 }} />
              ))}
              <col style={{ width: 84 }} />
            </colgroup>
            <thead className="text-[11px] font-semibold text-blue-950">
              <tr className="bg-emerald-50">
                <th rowSpan={2} scope="col" className="border-b border-emerald-100 px-2 py-1 text-center">
                  Data subscrição
                </th>
                <th rowSpan={2} scope="col" className="border-b border-emerald-100 px-2 py-1 text-right">
                  Montante subscrição
                </th>
                <th rowSpan={2} scope="col" className="border-b border-emerald-100 px-2 py-1 text-right">
                  Montante à data
                </th>
                <th rowSpan={2} scope="col" className="border-b border-emerald-100 px-2 py-1 text-right">
                  Taxa juro anual
                </th>
                <th colSpan={12} scope="colgroup" className="border-b border-emerald-100 px-2 py-0.5 text-center">
                  Juro previsto TRIMESTRAL - líquido de retenção na fonte 28%
                </th>
                <th rowSpan={2} scope="col" className="border-b border-emerald-100 px-2 py-1 text-right">
                  <span className="sr-only">Acções</span>
                </th>
              </tr>
              <tr className="bg-emerald-50">
                {IGCP_MONTHS.map((month) => (
                  <th key={month.key} scope="col" className="border-b border-emerald-100 px-2 py-0.5 text-right">
                    {month.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((calculatedRow, rowIndex) => {
                const rowNumber = rowIndex + 1;

                return (
                  <tr key={calculatedRow.row.id} className="hover:bg-slate-50">
                    {(["subscriptionDate", "subscriptionAmount", "currentAmount", "annualRate"] as const).map(
                      (field) => {
                        const error = calculatedRow.errors[field];
                        const align = field === "subscriptionDate" ? "text-center" : "text-right tabular-nums";

                        return (
                          <td key={field} className="px-1 py-0.5 align-top">
                            <input
                              value={calculatedRow.row[field]}
                              onChange={(event) => updateField(calculatedRow.row.id, field, event.target.value)}
                              onBlur={() => normaliseField(calculatedRow.row.id, field)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") {
                                  return;
                                }

                                event.preventDefault();
                                normaliseField(calculatedRow.row.id, field);
                                event.currentTarget.blur();
                              }}
                              inputMode={field === "subscriptionDate" ? "numeric" : "decimal"}
                              aria-invalid={error ? "true" : undefined}
                              aria-label={`${fieldLabels[field]} da linha ${rowNumber}`}
                              className={inputClassName({ hasError: Boolean(error), align })}
                            />
                            {error ? <span className="mt-0.5 block text-[10px] text-red-700">{error}</span> : null}
                          </td>
                        );
                      },
                    )}
                    {IGCP_MONTHS.map((month) => (
                      <td
                        key={month.key}
                        data-testid={`igcp-interest-${calculatedRow.row.id}-${month.key}`}
                        className={tableMoneyClassName(calculatedRow.interestByMonth[month.key])}
                      >
                        {formatEuroCents(calculatedRow.interestByMonth[month.key])}
                      </td>
                    ))}
                    <td className="px-1 py-0.5 text-right align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(calculatedRow.row.id)}
                        aria-label={`Remover linha ${rowNumber}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 shadow-sm hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-950">
                <th
                  scope="row"
                  className="border-y-2 border-slate-950 bg-white px-2 py-1 text-left text-xs uppercase"
                >
                  Total
                </th>
                <td
                  data-testid="igcp-total-subscription"
                  className="border-y-2 border-slate-950 px-2 py-1 text-right tabular-nums"
                >
                  {formatEuroCents(table.totals.subscriptionAmountCents)}
                </td>
                <td
                  data-testid="igcp-total-current"
                  className="border-y-2 border-slate-950 px-2 py-1 text-right tabular-nums"
                >
                  {formatEuroCents(table.totals.currentAmountCents)}
                </td>
                <td className="border-y-2 border-slate-950 px-2 py-1" />
                {IGCP_MONTHS.map((month) => (
                  <td
                    key={month.key}
                    data-testid={`igcp-total-${month.key}`}
                    className="border-y-2 border-slate-950 px-2 py-1 text-right tabular-nums"
                  >
                    {formatEuroCents(table.totals.interestByMonth[month.key])}
                  </td>
                ))}
                <td className="border-y-2 border-slate-950 px-2 py-1" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid max-w-md grid-cols-[1fr_auto] gap-4 px-1 text-sm">
        <span className="font-medium text-slate-800">Ganho acumulado</span>
        <span data-testid="igcp-accumulated-gain" className="font-semibold tabular-nums text-slate-950">
          {formatEuroCents(table.totals.accumulatedGainCents)}
        </span>
      </div>
    </div>
  );
}
