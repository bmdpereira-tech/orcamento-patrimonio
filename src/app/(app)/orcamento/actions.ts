"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEuroCents, type Cents } from "@/domain/budget/money";
import { normaliseMonth } from "@/domain/budget/months";
import {
  EDITABLE_BUDGET_ROW_KEYS,
  type CustomBudgetItemCategory,
  type EditableBudgetRowKey,
} from "@/domain/budget/monthly-view";
import {
  addCustomBudgetItem,
  deleteCustomBudgetItem,
  saveMonthlyBudgetValues,
  type CustomBudgetItemSaveInput,
} from "@/server/budget/monthly-overview";

function redirectToBudget(month: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ month, ...params });
  redirect(`/orcamento?${searchParams.toString()}`);
}

function isCustomBudgetItemCategory(value: string): value is CustomBudgetItemCategory {
  return value === "expense" || value === "income";
}

function parseCustomItems(formData: FormData, accountIds: readonly string[]) {
  return formData
    .getAll("customItemId")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((id): CustomBudgetItemSaveInput => {
      const category = String(formData.get(`custom:${id}:category`) ?? "");

      if (!isCustomBudgetItemCategory(category)) {
        throw new Error("Escolhe um tipo válido para cada linha personalizada.");
      }

      const sortOrder = Number(String(formData.get(`custom:${id}:sortOrder`) ?? "0"));

      if (!Number.isInteger(sortOrder)) {
        throw new Error("A ordem das linhas personalizadas deve ser um número inteiro.");
      }

      return {
        id,
        description: String(formData.get(`custom:${id}:description`) ?? "").trim() || "Linha sem descrição",
        category,
        sortOrder,
        valuesByAccountId: Object.fromEntries(
          accountIds.map((accountId) => [
            accountId,
            Math.abs(parseEuroCents(formData.get(`custom:${id}:account:${accountId}`))),
          ]),
        ),
      };
    });
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

    const customItems = parseCustomItems(formData, accountIds);

    await saveMonthlyBudgetValues({ month, values, customItems });
    revalidatePath("/orcamento");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível guardar o orçamento.";
    redirectToBudget(month, { erro: message });
  }

  redirectToBudget(month, { status: "saved" });
}

export async function addCustomBudgetItemAction(formData: FormData) {
  const month = normaliseMonth(String(formData.get("month") ?? ""));

  try {
    await addCustomBudgetItem(month);
    revalidatePath("/orcamento");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível adicionar a linha.";
    redirectToBudget(month, { erro: message });
  }

  redirectToBudget(month, { status: "line-added" });
}

export async function deleteCustomBudgetItemAction(formData: FormData) {
  const month = normaliseMonth(String(formData.get("month") ?? ""));
  const id = String(formData.get("deleteCustomItemId") ?? "").trim();

  try {
    if (!id) {
      throw new Error("Linha personalizada inválida.");
    }

    await deleteCustomBudgetItem(month, id);
    revalidatePath("/orcamento");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível eliminar a linha.";
    redirectToBudget(month, { erro: message });
  }

  redirectToBudget(month, { status: "line-deleted" });
}
