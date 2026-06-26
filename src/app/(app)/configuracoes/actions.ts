"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normaliseMonth } from "@/domain/budget/months";
import { parseEuroCents } from "@/domain/budget/money";
import { saveDailyBudgetVersion } from "@/server/budget/daily-budget";
import { saveSalaryVersion } from "@/server/budget/salary";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectToSettings(status: string) {
  redirect(`/configuracoes?status=${encodeURIComponent(status)}`);
}

function redirectToSettingsError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível guardar a configuração.";
  redirect(`/configuracoes?erro=${encodeURIComponent(message)}`);
}

export async function saveDailyBudgetVersionAction(formData: FormData) {
  try {
    const accountId = getText(formData, "accountId");
    const effectiveFromMonthInput = getText(formData, "effectiveFromMonth");

    if (!effectiveFromMonthInput) {
      throw new Error("Indique o mês de entrada em vigor.");
    }

    await saveDailyBudgetVersion({
      accountId,
      effectiveFromMonth: normaliseMonth(effectiveFromMonthInput),
      dailyAmountCents: parseEuroCents(getText(formData, "dailyAmount")),
    });
    revalidatePath("/configuracoes");
    revalidatePath("/orcamento");
  } catch (error) {
    redirectToSettingsError(error);
  }

  redirectToSettings("daily-budget-saved");
}

function parseMonthNumber(formData: FormData, key: string) {
  const value = Number(getText(formData, key));

  if (!Number.isInteger(value)) {
    throw new Error("Indique um mês válido.");
  }

  return value;
}

export async function saveSalaryVersionAction(formData: FormData) {
  try {
    const accountId = getText(formData, "accountId");
    const effectiveFromMonthInput = getText(formData, "effectiveFromMonth");

    if (!effectiveFromMonthInput) {
      throw new Error("Indique o mês de entrada em vigor.");
    }

    await saveSalaryVersion({
      accountId,
      effectiveFromMonth: normaliseMonth(effectiveFromMonthInput),
      amountCents: parseEuroCents(getText(formData, "amount")),
      vacationBonusCents: parseEuroCents(getText(formData, "vacationBonus")),
      vacationBonusMonth: parseMonthNumber(formData, "vacationBonusMonth"),
      christmasBonusCents: parseEuroCents(getText(formData, "christmasBonus")),
      christmasBonusMonth: parseMonthNumber(formData, "christmasBonusMonth"),
    });
    revalidatePath("/configuracoes");
    revalidatePath("/orcamento");
  } catch (error) {
    redirectToSettingsError(error);
  }

  redirectToSettings("salary-saved");
}
