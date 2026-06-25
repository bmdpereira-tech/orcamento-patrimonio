"use server";

import { revalidatePath } from "next/cache";
import { formatMonthLabel, normaliseMonth, type MonthId } from "@/domain/budget/months";
import { parseEuroCents } from "@/domain/budget/money";
import {
  archiveRecurringRule,
  createRecurringRule,
  deleteRecurringRuleWhenAllowed,
  reactivateRecurringRule,
  setRecurringRuleActive,
  updateRecurringRule,
} from "@/server/budget/recurring-rules";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type RecurringRuleActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseMonthInput(value: string, fieldName: "início" | "fim") {
  if (!value) {
    if (fieldName === "início") {
      throw new Error("Indique o mês de início.");
    }

    return undefined;
  }

  if (!MONTH_PATTERN.test(value)) {
    throw new Error(`Indique um mês de ${fieldName} válido.`);
  }

  const month = normaliseMonth(value);

  if (month !== value) {
    throw new Error(`O mês de ${fieldName} deve ser igual ou posterior a ${formatMonthLabel(month)}.`);
  }

  return month as MonthId;
}

function parseInteger(formData: FormData, key: string, fallback: number) {
  const value = Number(getText(formData, key) || String(fallback));

  if (!Number.isInteger(value)) {
    throw new Error("A ordem deve ser um número inteiro.");
  }

  return value;
}

function parseRecurringRuleInput(formData: FormData) {
  const amountCents = parseEuroCents(getText(formData, "amount"));
  const chargeDay = Number(getText(formData, "chargeDay"));
  const startMonth = parseMonthInput(getText(formData, "startMonth"), "início");
  const endMonth = parseMonthInput(getText(formData, "endMonth"), "fim");

  if (!startMonth) {
    throw new Error("Indique o mês de início.");
  }

  return {
    description: getText(formData, "description"),
    accountId: getText(formData, "accountId"),
    amountCents,
    chargeDay,
    frequency: "monthly" as const,
    startMonth,
    endMonth,
    active: getText(formData, "active") !== "false",
    sortOrder: parseInteger(formData, "sortOrder", 0),
  };
}

function revalidateRecurringViews() {
  revalidatePath("/debitos-directos");
  revalidatePath("/orcamento");
}

export async function createRecurringRuleAction(formData: FormData): Promise<RecurringRuleActionResult<{ rule: Awaited<ReturnType<typeof createRecurringRule>> }>> {
  try {
    const rule = await createRecurringRule(parseRecurringRuleInput(formData));
    revalidateRecurringViews();

    return { ok: true, rule };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar o débito directo.",
    };
  }
}

export async function updateRecurringRuleAction(formData: FormData): Promise<RecurringRuleActionResult<{ rule: Awaited<ReturnType<typeof updateRecurringRule>> }>> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Débito directo inválido.");
    }

    const rule = await updateRecurringRule({ ...parseRecurringRuleInput(formData), id });
    revalidateRecurringViews();

    return { ok: true, rule };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível actualizar o débito directo.",
    };
  }
}

export async function setRecurringRuleActiveAction(formData: FormData): Promise<RecurringRuleActionResult<{ rule: Awaited<ReturnType<typeof setRecurringRuleActive>> }>> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Débito directo inválido.");
    }

    const rule = await setRecurringRuleActive(id, getText(formData, "active") === "true");
    revalidateRecurringViews();

    return { ok: true, rule };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível alterar o estado do débito directo.",
    };
  }
}

export async function archiveRecurringRuleAction(formData: FormData): Promise<RecurringRuleActionResult<{ rule: Awaited<ReturnType<typeof archiveRecurringRule>> }>> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Débito directo inválido.");
    }

    const rule = await archiveRecurringRule(id);
    revalidateRecurringViews();

    return { ok: true, rule };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível arquivar o débito directo.",
    };
  }
}

export async function reactivateRecurringRuleAction(formData: FormData): Promise<RecurringRuleActionResult<{ rule: Awaited<ReturnType<typeof reactivateRecurringRule>> }>> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Débito directo inválido.");
    }

    const rule = await reactivateRecurringRule(id);
    revalidateRecurringViews();

    return { ok: true, rule };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível reactivar o débito directo.",
    };
  }
}

export async function deleteRecurringRuleAction(formData: FormData): Promise<RecurringRuleActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Débito directo inválido.");
    }

    const result = await deleteRecurringRuleWhenAllowed(id);

    if (!result.deleted) {
      throw new Error(result.reason ?? "Este débito directo não pode ser eliminado. Arquive-o em alternativa.");
    }

    revalidateRecurringViews();

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível eliminar o débito directo.",
    };
  }
}
