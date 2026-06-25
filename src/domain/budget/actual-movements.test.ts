import { describe, expect, it } from "vitest";
import {
  applyActualMovementMutation,
  buildActualMovementAmountMap,
  getActualMovementAmount,
  getActualMovementSignedAmount,
  normaliseActualMovementInput,
  sumActualMovementsForAccountMonth,
  type ActualMovement,
} from "./actual-movements";

const movements: ActualMovement[] = [
  {
    id: "income-july",
    accountId: "account-a",
    movementDate: "2026-07-10",
    description: "Entrada",
    amountCents: 100_00,
    movementType: "income",
  },
  {
    id: "expense-july",
    accountId: "account-a",
    movementDate: "2026-07-11",
    description: "Saída",
    amountCents: 35_00,
    movementType: "expense",
  },
  {
    id: "income-august",
    accountId: "account-a",
    movementDate: "2026-08-01",
    description: "Outro mês",
    amountCents: 50_00,
    movementType: "income",
  },
  {
    id: "expense-account-b",
    accountId: "account-b",
    movementDate: "2026-07-12",
    description: "Outra conta",
    amountCents: 20_00,
    movementType: "expense",
  },
];

describe("actual movements", () => {
  it("sums income and expenses in the same month with the correct sign", () => {
    expect(sumActualMovementsForAccountMonth(movements, "account-a", "2026-07")).toBe(65_00);
  });

  it("excludes movements from other months", () => {
    expect(sumActualMovementsForAccountMonth(movements, "account-a", "2026-08")).toBe(50_00);
  });

  it("keeps movement totals separated by account", () => {
    const amountByMonthAccount = buildActualMovementAmountMap(movements);

    expect(getActualMovementAmount(amountByMonthAccount, "2026-07", "account-a")).toBe(65_00);
    expect(getActualMovementAmount(amountByMonthAccount, "2026-07", "account-b")).toBe(-20_00);
  });

  it("stores the amount as positive and lets the movement type define the sign", () => {
    const movement = normaliseActualMovementInput({
      accountId: "account-a",
      movementDate: "2026-07-20",
      description: "Pagamento",
      amountCents: -42_50,
      movementType: "expense",
    });

    expect(movement.amountCents).toBe(42_50);
    expect(getActualMovementSignedAmount(movement)).toBe(-42_50);
  });

  it("applies create, update and delete mutations", () => {
    const created: ActualMovement = {
      id: "created",
      accountId: "account-a",
      movementDate: "2026-07-21",
      description: "Criado",
      amountCents: 10_00,
      movementType: "income",
    };
    const updated = { ...created, description: "Editado", amountCents: 15_00 };
    const afterCreate = applyActualMovementMutation([], { type: "create", movement: created });
    const afterUpdate = applyActualMovementMutation(afterCreate, { type: "update", movement: updated });
    const afterDelete = applyActualMovementMutation(afterUpdate, { type: "delete", id: created.id });

    expect(afterCreate).toEqual([created]);
    expect(afterUpdate).toEqual([updated]);
    expect(afterDelete).toEqual([]);
  });
});
