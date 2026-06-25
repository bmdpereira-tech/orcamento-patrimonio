import { assertCents, sumCents, type Cents } from "./money";
import { FIRST_MONTH, type MonthId } from "./months";

export type ActualMovementType = "income" | "expense";

export type ActualMovement = {
  id: string;
  accountId: string;
  movementDate: string;
  description: string;
  amountCents: Cents;
  movementType: ActualMovementType;
  createdAt?: string;
  updatedAt?: string;
};

export type ActualMovementInput = {
  accountId: string;
  movementDate: string;
  description: string;
  amountCents: Cents;
  movementType: ActualMovementType;
};

export type ActualMovementMutation =
  | {
      type: "create";
      movement: ActualMovement;
    }
  | {
      type: "update";
      movement: ActualMovement;
    }
  | {
      type: "delete";
      id: string;
    };

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isActualMovementType(value: string): value is ActualMovementType {
  return value === "income" || value === "expense";
}

export function getMonthFromMovementDate(date: string): MonthId {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Data inválida: ${date}`);
  }

  return date.slice(0, 7) as MonthId;
}

export function normaliseActualMovementInput(input: ActualMovementInput): ActualMovementInput {
  const accountId = input.accountId.trim();
  const description = input.description.trim();
  const movementMonth = getMonthFromMovementDate(input.movementDate);

  if (!accountId) {
    throw new Error("Escolhe uma conta.");
  }

  if (!description) {
    throw new Error("Indica uma descrição.");
  }

  if (movementMonth < FIRST_MONTH) {
    throw new Error("A data do movimento não pode ser anterior a Julho de 2026.");
  }

  if (!isActualMovementType(input.movementType)) {
    throw new Error("Escolhe um tipo de movimento válido.");
  }

  return {
    accountId,
    movementDate: input.movementDate,
    description,
    amountCents: assertCents(Math.abs(input.amountCents)),
    movementType: input.movementType,
  };
}

export function getActualMovementSignedAmount(
  movement: Pick<ActualMovement, "amountCents" | "movementType">,
): Cents {
  const amountCents = assertCents(Math.abs(movement.amountCents));

  return movement.movementType === "income" ? amountCents : assertCents(-amountCents);
}

export function actualMovementAmountKey(month: MonthId, accountId: string) {
  return `${month}:${accountId}`;
}

export function sumActualMovementsForAccountMonth(
  movements: readonly ActualMovement[],
  accountId: string,
  month: MonthId,
) {
  return sumCents(
    movements
      .filter((movement) => movement.accountId === accountId && getMonthFromMovementDate(movement.movementDate) === month)
      .map(getActualMovementSignedAmount),
  );
}

export function buildActualMovementAmountMap(movements: readonly ActualMovement[]) {
  const amountByMonthAccount = new Map<string, Cents>();

  for (const movement of movements) {
    const month = getMonthFromMovementDate(movement.movementDate);
    const key = actualMovementAmountKey(month, movement.accountId);
    amountByMonthAccount.set(
      key,
      sumCents([amountByMonthAccount.get(key) ?? 0, getActualMovementSignedAmount(movement)]),
    );
  }

  return amountByMonthAccount;
}

export function getActualMovementAmount(
  amountByMonthAccount: ReadonlyMap<string, Cents>,
  month: MonthId,
  accountId: string,
) {
  return amountByMonthAccount.get(actualMovementAmountKey(month, accountId)) ?? 0;
}

export function applyActualMovementMutation(
  movements: readonly ActualMovement[],
  mutation: ActualMovementMutation,
) {
  if (mutation.type === "create") {
    return [...movements, mutation.movement];
  }

  if (mutation.type === "update") {
    return movements.map((movement) => (movement.id === mutation.movement.id ? mutation.movement : movement));
  }

  return movements.filter((movement) => movement.id !== mutation.id);
}
