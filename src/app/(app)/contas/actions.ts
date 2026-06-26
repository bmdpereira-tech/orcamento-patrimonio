"use server";

import { revalidatePath } from "next/cache";
import type { HistoricalActionResult } from "@/domain/budget/historical-impact";
import { FIRST_MONTH, normaliseMonth, type MonthId } from "@/domain/budget/months";
import {
  archiveAccount,
  createAccount,
  deleteAccountWhenAllowed,
  getAccountById,
  getAccountFinancialImpactMonth,
  isAccountType,
  reactivateAccount,
  updateAccount,
  type AccountInput,
} from "@/server/budget/accounts";
import { getHistoricalImpactActionResult } from "@/server/budget/historical-impact";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getSortOrder(formData: FormData) {
  const value = Number(getText(formData, "sortOrder") || "0");

  if (!Number.isInteger(value)) {
    throw new Error("A ordem deve ser um número inteiro.");
  }

  return value;
}

function parseAccountInput(formData: FormData): AccountInput {
  const name = getText(formData, "name");
  const accountType = getText(formData, "accountType");
  const isCreditCard = getCheckbox(formData, "isCreditCard") || accountType === "credit_card";
  const startMonth = normaliseMonth(getText(formData, "startMonth") || FIRST_MONTH);

  if (!name) {
    throw new Error("Indica o nome da conta.");
  }

  if (!isAccountType(accountType)) {
    throw new Error("Escolhe um tipo de conta válido.");
  }

  return {
    name,
    shortName: getText(formData, "shortName"),
    accountType,
    isCreditCard,
    linkedPaymentAccountId: getText(formData, "linkedPaymentAccountId") || null,
    startMonth,
    sortOrder: getSortOrder(formData),
    showInBudget: getCheckbox(formData, "showInBudget"),
    includeInNetWorth: getCheckbox(formData, "includeInNetWorth"),
  };
}

function revalidateAccountViews() {
  revalidatePath("/contas");
  revalidatePath("/orcamento");
}

function getAccountVisibilityImpactMonth(
  account: { showInBudget: boolean; includeInNetWorth: boolean },
  firstAffectedMonth: MonthId,
) {
  return account.showInBudget || account.includeInNetWorth ? firstAffectedMonth : null;
}

export async function createAccountAction(formData: FormData): Promise<HistoricalActionResult<{ status: string }>> {
  try {
    const input = parseAccountInput(formData);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: getAccountVisibilityImpactMonth(input, input.startMonth),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await createAccount(input);
    revalidateAccountViews();
    return { ok: true, status: "created" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.",
    };
  }
}

export async function updateAccountAction(formData: FormData): Promise<HistoricalActionResult<{ status: string }>> {
  const id = getText(formData, "id");

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    const input = { ...parseAccountInput(formData), id };
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: await getAccountFinancialImpactMonth(input),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await updateAccount(input);
    revalidateAccountViews();
    return { ok: true, status: "updated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.",
    };
  }
}

export async function archiveAccountAction(formData: FormData): Promise<HistoricalActionResult<{ status: string }>> {
  const id = getText(formData, "id");
  const archiveFromMonth = normaliseMonth(getText(formData, "archiveFromMonth") || FIRST_MONTH) as MonthId;

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    const account = await getAccountById(id);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: getAccountVisibilityImpactMonth(account, archiveFromMonth),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await archiveAccount(id, archiveFromMonth);
    revalidateAccountViews();
    return { ok: true, status: "archived" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.",
    };
  }
}

export async function reactivateAccountAction(formData: FormData): Promise<HistoricalActionResult<{ status: string }>> {
  const id = getText(formData, "id");

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    const account = await getAccountById(id);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: getAccountVisibilityImpactMonth(
        account,
        account.archivedFromMonth ?? account.startMonth,
      ),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await reactivateAccount(id);
    revalidateAccountViews();
    return { ok: true, status: "reactivated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.",
    };
  }
}

export async function deleteAccountAction(formData: FormData): Promise<HistoricalActionResult<{ status: string }>> {
  const id = getText(formData, "id");
  let status = "deleted";

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    const account = await getAccountById(id);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: getAccountVisibilityImpactMonth(account, account.startMonth),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    const deleted = await deleteAccountWhenAllowed(id);
    revalidateAccountViews();

    if (!deleted) {
      status = "delete-blocked";
    }
    return { ok: true, status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.",
    };
  }
}
