"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FIRST_MONTH, normaliseMonth, type MonthId } from "@/domain/budget/months";
import {
  archiveAccount,
  createAccount,
  deleteAccountWhenAllowed,
  isAccountType,
  reactivateAccount,
  updateAccount,
  type AccountInput,
} from "@/server/budget/accounts";

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

function redirectToAccounts(status: string) {
  redirect(`/contas?status=${encodeURIComponent(status)}`);
}

function redirectToAccountsError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocorreu um erro ao guardar a conta.";
  redirect(`/contas?erro=${encodeURIComponent(message)}`);
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

export async function createAccountAction(formData: FormData) {
  try {
    await createAccount(parseAccountInput(formData));
    revalidateAccountViews();
  } catch (error) {
    redirectToAccountsError(error);
  }

  redirectToAccounts("created");
}

export async function updateAccountAction(formData: FormData) {
  const id = getText(formData, "id");

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    await updateAccount({ ...parseAccountInput(formData), id });
    revalidateAccountViews();
  } catch (error) {
    redirectToAccountsError(error);
  }

  redirectToAccounts("updated");
}

export async function archiveAccountAction(formData: FormData) {
  const id = getText(formData, "id");
  const archiveFromMonth = normaliseMonth(getText(formData, "archiveFromMonth") || FIRST_MONTH) as MonthId;

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    await archiveAccount(id, archiveFromMonth);
    revalidateAccountViews();
  } catch (error) {
    redirectToAccountsError(error);
  }

  redirectToAccounts("archived");
}

export async function reactivateAccountAction(formData: FormData) {
  const id = getText(formData, "id");

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    await reactivateAccount(id);
    revalidateAccountViews();
  } catch (error) {
    redirectToAccountsError(error);
  }

  redirectToAccounts("reactivated");
}

export async function deleteAccountAction(formData: FormData) {
  const id = getText(formData, "id");
  let status = "deleted";

  try {
    if (!id) {
      throw new Error("Conta inválida.");
    }

    const deleted = await deleteAccountWhenAllowed(id);
    revalidateAccountViews();

    if (!deleted) {
      status = "delete-blocked";
    }
  } catch (error) {
    redirectToAccountsError(error);
  }

  redirectToAccounts(status);
}
