"use server";

import { revalidatePath } from "next/cache";
import { parseEuroCents, type Cents } from "@/domain/budget/money";
import { normaliseMonth } from "@/domain/budget/months";
import {
  EDITABLE_BUDGET_ROW_KEYS,
  type EditableBudgetRowKey,
  type MonthlyCustomBudgetItem,
} from "@/domain/budget/monthly-view";
import {
  addCustomBudgetItem,
  deleteCustomBudgetItem,
  getMonthlyBudgetFinancialChangeMonth,
  saveMonthlyBudgetValues,
  type CustomBudgetItemSaveInput,
} from "@/server/budget/monthly-overview";
import {
  clearCreditCardStatementOverride,
  setCreditCardStatementOverride,
} from "@/server/budget/credit-card-payments";
import { setRecurringRuleMonthExcluded } from "@/server/budget/recurring-rules";
import { saveSalaryMonthState } from "@/server/budget/salary";
import { getHistoricalImpactActionResult } from "@/server/budget/historical-impact";
import type { HistoricalActionResult } from "@/domain/budget/historical-impact";

type BudgetActionResult = HistoricalActionResult;
type AddCustomBudgetItemActionResult = HistoricalActionResult<{ item: MonthlyCustomBudgetItem }>;
type DirectDebitExclusionActionResult =
  | {
      ok: true;
      state: {
        recurringRuleId: string;
        month: string;
        excludedFromForecast: boolean;
      };
    }
  | Extract<HistoricalActionResult, { ok: false }>;
type CreditCardStatementOverrideActionResult =
  | {
      ok: true;
      override: {
        creditCardAccountId: string;
        month: string;
        statementAmountCents: number | null;
      };
    }
  | Extract<HistoricalActionResult, { ok: false }>;
type SalaryMonthOverrideActionResult =
  | {
      ok: true;
      override: {
        month: string;
        reflectedInCurrentBalance: boolean;
      };
    }
  | Extract<HistoricalActionResult, { ok: false }>;

function parseCustomItems(formData: FormData, accountIds: readonly string[]) {
  const itemIds = [
    ...new Set(
      formData
        .getAll("customItemId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];

  return itemIds.map((id): CustomBudgetItemSaveInput => {
    const sortOrder = Number(String(formData.get(`custom:${id}:sortOrder`) ?? "0"));

    if (!Number.isInteger(sortOrder)) {
      throw new Error("A ordem das linhas personalizadas deve ser um número inteiro.");
    }

    return {
      id,
      description: String(formData.get(`custom:${id}:description`) ?? "").trim() || "Linha sem descrição",
      sortOrder,
      valuesByAccountId: Object.fromEntries(
        accountIds.map((accountId) => [
          accountId,
          parseEuroCents(formData.get(`custom:${id}:account:${accountId}`)),
        ]),
      ),
    };
  });
}

export async function saveMonthlyBudgetAction(formData: FormData): Promise<BudgetActionResult> {
  const month = normaliseMonth(String(formData.get("month") ?? ""));

  try {
    const accountIds = formData
      .getAll("accountId")
      .map((value) => String(value))
      .filter(Boolean);
    const values = Object.fromEntries(
      EDITABLE_BUDGET_ROW_KEYS.map((rowKey) => [rowKey, {} as Record<string, Cents>]),
    ) as Record<EditableBudgetRowKey, Record<string, Cents>>;

    for (const rowKey of EDITABLE_BUDGET_ROW_KEYS) {
      for (const accountId of accountIds) {
        values[rowKey][accountId] = parseEuroCents(formData.get(`cell:${rowKey}:${accountId}`));
      }
    }

    const customItems = parseCustomItems(formData, accountIds);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: await getMonthlyBudgetFinancialChangeMonth({ month, values, customItems }),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await saveMonthlyBudgetValues({ month, values, customItems });
    revalidatePath("/orcamento");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar o orçamento.";
    return { ok: false, error: message };
  }
}

export async function addCustomBudgetItemAction(formData: FormData): Promise<AddCustomBudgetItemActionResult> {
  const month = normaliseMonth(String(formData.get("month") ?? ""));

  try {
    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: month, formData });

    if (impactResult) {
      return impactResult;
    }

    const item = await addCustomBudgetItem(month);
    revalidatePath("/orcamento");
    return { ok: true, item };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível adicionar a linha.";
    return { ok: false, error: message };
  }
}

export async function deleteCustomBudgetItemAction(formData: FormData): Promise<BudgetActionResult> {
  const month = normaliseMonth(String(formData.get("month") ?? ""));
  const id = String(formData.get("customItemId") ?? "").trim();

  try {
    if (!id) {
      throw new Error("Linha personalizada inválida.");
    }

    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: month, formData });

    if (impactResult) {
      return impactResult;
    }

    await deleteCustomBudgetItem(month, id);
    revalidatePath("/orcamento");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível eliminar a linha.";
    return { ok: false, error: message };
  }
}

export async function setDirectDebitForecastExclusionAction(
  formData: FormData,
): Promise<DirectDebitExclusionActionResult> {
  const recurringRuleId = String(formData.get("recurringRuleId") ?? "").trim();
  const month = normaliseMonth(String(formData.get("month") ?? ""));
  const excludedFromForecast = String(formData.get("excludedFromForecast") ?? "false") === "true";

  try {
    if (!recurringRuleId) {
      throw new Error("Débito directo inválido.");
    }

    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: month, formData });

    if (impactResult) {
      return impactResult;
    }

    const state = await setRecurringRuleMonthExcluded({
      recurringRuleId,
      month,
      excludedFromForecast,
    });

    revalidatePath("/orcamento");
    return { ok: true, state };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível actualizar a previsão.";
    return { ok: false, error: message };
  }
}

export async function setCreditCardStatementOverrideAction(
  formData: FormData,
): Promise<CreditCardStatementOverrideActionResult> {
  const creditCardAccountId = String(formData.get("creditCardAccountId") ?? "").trim();
  const month = normaliseMonth(String(formData.get("month") ?? ""));
  const rawStatementAmount = String(formData.get("statementAmount") ?? "").trim();

  try {
    if (!creditCardAccountId) {
      throw new Error("Cartão inválido.");
    }

    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: month, formData });

    if (impactResult) {
      return impactResult;
    }

    if (!rawStatementAmount) {
      await clearCreditCardStatementOverride({ creditCardAccountId, month });
      revalidatePath("/orcamento");

      return {
        ok: true,
        override: { creditCardAccountId, month, statementAmountCents: null },
      };
    }

    const statementAmountCents = parseEuroCents(rawStatementAmount);
    const override = await setCreditCardStatementOverride({
      creditCardAccountId,
      month,
      statementAmountCents,
    });

    revalidatePath("/orcamento");
    return {
      ok: true,
      override: {
        creditCardAccountId: override.creditCardAccountId,
        month: override.month,
        statementAmountCents: override.statementAmountCents,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar o valor do extracto.";
    return { ok: false, error: message };
  }
}

export async function setSalaryMonthOverrideAction(
  formData: FormData,
): Promise<SalaryMonthOverrideActionResult> {
  const month = normaliseMonth(String(formData.get("month") ?? ""));
  const reflectedInCurrentBalance = String(formData.get("reflectedInCurrentBalance") ?? "false") === "true";

  try {
    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: month, formData });

    if (impactResult) {
      return impactResult;
    }

    const result = await saveSalaryMonthState({
      month,
      reflectedInCurrentBalance,
    });

    revalidatePath("/orcamento");
    return {
      ok: true,
      override: {
        month,
        reflectedInCurrentBalance: result.reflectedInCurrentBalance,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar o salário do mês.";
    return { ok: false, error: message };
  }
}
