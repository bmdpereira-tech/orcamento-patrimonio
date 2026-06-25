"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEuroCents, type Cents } from "@/domain/budget/money";
import { normaliseMonth } from "@/domain/budget/months";
import { EDITABLE_BUDGET_ROW_KEYS, type EditableBudgetRowKey } from "@/domain/budget/monthly-view";
import { saveMonthlyBudgetValues } from "@/server/budget/monthly-overview";

function redirectToBudget(month: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ month, ...params });
  redirect(`/orcamento?${searchParams.toString()}`);
}

export async function saveMonthlyBudgetAction(formData: FormData) {
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

    await saveMonthlyBudgetValues({ month, values });
    revalidatePath("/orcamento");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar o orçamento.";
    redirectToBudget(month, { erro: message });
  }

  redirectToBudget(month, { status: "saved" });
}
