"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isActualMovementType, type ActualMovementInput } from "@/domain/budget/actual-movements";
import { parseEuroCents } from "@/domain/budget/money";
import { FIRST_MONTH, normaliseMonth } from "@/domain/budget/months";
import {
  createActualMovement,
  deleteActualMovement,
  updateActualMovement,
} from "@/server/budget/actual-movements";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectToHistory(month: string, accountId: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ month, ...params });

  if (accountId) {
    searchParams.set("accountId", accountId);
  }

  redirect(`/historico?${searchParams.toString()}`);
}

function parseMovementForm(formData: FormData): ActualMovementInput {
  const accountId = getText(formData, "accountId");
  const movementDate = getText(formData, "movementDate");
  const description = getText(formData, "description");
  const movementType = getText(formData, "movementType");

  if (!isActualMovementType(movementType)) {
    throw new Error("Escolhe se o movimento é uma entrada ou uma saída.");
  }

  return {
    accountId,
    movementDate,
    description,
    movementType,
    amountCents: parseEuroCents(formData.get("amount")),
  };
}

function revalidateMovementViews() {
  revalidatePath("/historico");
  revalidatePath("/orcamento");
}

export async function createActualMovementAction(formData: FormData) {
  const month = normaliseMonth(getText(formData, "redirectMonth") || FIRST_MONTH);
  const accountId = getText(formData, "redirectAccountId");

  try {
    await createActualMovement(parseMovementForm(formData));
    revalidateMovementViews();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o movimento.";
    redirectToHistory(month, accountId, { erro: message });
  }

  redirectToHistory(month, accountId, { status: "created" });
}

export async function updateActualMovementAction(formData: FormData) {
  const id = getText(formData, "id");
  const month = normaliseMonth(getText(formData, "redirectMonth") || FIRST_MONTH);
  const accountId = getText(formData, "redirectAccountId");

  try {
    if (!id) {
      throw new Error("Movimento inválido.");
    }

    await updateActualMovement(id, parseMovementForm(formData));
    revalidateMovementViews();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível actualizar o movimento.";
    redirectToHistory(month, accountId, { erro: message });
  }

  redirectToHistory(month, accountId, { status: "updated" });
}

export async function deleteActualMovementAction(formData: FormData) {
  const id = getText(formData, "id");
  const month = normaliseMonth(getText(formData, "redirectMonth") || FIRST_MONTH);
  const accountId = getText(formData, "redirectAccountId");

  try {
    if (!id) {
      throw new Error("Movimento inválido.");
    }

    await deleteActualMovement(id);
    revalidateMovementViews();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível eliminar o movimento.";
    redirectToHistory(month, accountId, { erro: message });
  }

  redirectToHistory(month, accountId, { status: "deleted" });
}
