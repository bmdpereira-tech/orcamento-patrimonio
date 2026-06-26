"use server";

import { revalidatePath } from "next/cache";
import type { HistoricalActionResult } from "@/domain/budget/historical-impact";
import { normaliseMonth } from "@/domain/budget/months";
import { parseEuroCents } from "@/domain/budget/money";
import { saveDailyBudgetVersion } from "@/server/budget/daily-budget";
import { getHistoricalImpactActionResult } from "@/server/budget/historical-impact";
import { saveSalaryVersion } from "@/server/budget/salary";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveDailyBudgetVersionAction(formData: FormData): Promise<HistoricalActionResult> {
  try {
    const accountId = getText(formData, "accountId");
    const effectiveFromMonthInput = getText(formData, "effectiveFromMonth");

    if (!effectiveFromMonthInput) {
      throw new Error("Indique o mês de entrada em vigor.");
    }

    const effectiveFromMonth = normaliseMonth(effectiveFromMonthInput);
    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: effectiveFromMonth, formData });

    if (impactResult) {
      return impactResult;
    }

    await saveDailyBudgetVersion({
      accountId,
      effectiveFromMonth,
      dailyAmountCents: parseEuroCents(getText(formData, "dailyAmount")),
    });
    revalidatePath("/configuracoes");
    revalidatePath("/orcamento");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível guardar a configuração.",
    };
  }
}

function parseMonthNumber(formData: FormData, key: string) {
  const value = Number(getText(formData, key));

  if (!Number.isInteger(value)) {
    throw new Error("Indique um mês válido.");
  }

  return value;
}

export async function saveSalaryVersionAction(formData: FormData): Promise<HistoricalActionResult> {
  try {
    const accountId = getText(formData, "accountId");
    const effectiveFromMonthInput = getText(formData, "effectiveFromMonth");

    if (!effectiveFromMonthInput) {
      throw new Error("Indique o mês de entrada em vigor.");
    }

    const effectiveFromMonth = normaliseMonth(effectiveFromMonthInput);
    const impactResult = getHistoricalImpactActionResult({ firstAffectedMonth: effectiveFromMonth, formData });

    if (impactResult) {
      return impactResult;
    }

    await saveSalaryVersion({
      accountId,
      effectiveFromMonth,
      amountCents: parseEuroCents(getText(formData, "amount")),
      vacationBonusCents: parseEuroCents(getText(formData, "vacationBonus")),
      vacationBonusMonth: parseMonthNumber(formData, "vacationBonusMonth"),
      christmasBonusCents: parseEuroCents(getText(formData, "christmasBonus")),
      christmasBonusMonth: parseMonthNumber(formData, "christmasBonusMonth"),
    });
    revalidatePath("/configuracoes");
    revalidatePath("/orcamento");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível guardar a configuração.",
    };
  }
}
