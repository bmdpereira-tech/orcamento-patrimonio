import { describe, expect, it } from "vitest";
import { getActiveLiquidityAccounts, INITIAL_LIQUIDITY_ACCOUNTS, type LiquidityAccount } from "./accounts";

describe("active liquidity accounts", () => {
  it("shows the seven initial active accounts in July 2026", () => {
    const accounts = getActiveLiquidityAccounts(INITIAL_LIQUIDITY_ACCOUNTS, "2026-07");

    expect(accounts.map((account) => account.name)).toEqual([
      "Santander",
      "CC Santander",
      "ActivoBank",
      "CC ActivoBank",
      "T212 Cash",
      "N26",
      "IGCP",
    ]);
  });

  it("hides an archived account from the archive month onwards", () => {
    const accounts: LiquidityAccount[] = [
      {
        id: "old",
        name: "Conta antiga",
        isCreditCard: false,
        startMonth: "2026-07",
        archivedFromMonth: "2026-10",
        sortOrder: 10,
      },
    ];

    expect(getActiveLiquidityAccounts(accounts, "2026-09")).toHaveLength(1);
    expect(getActiveLiquidityAccounts(accounts, "2026-10")).toHaveLength(0);
    expect(getActiveLiquidityAccounts(accounts, "2026-11")).toHaveLength(0);
  });

  it("does not show a future account before its start month", () => {
    const accounts: LiquidityAccount[] = [
      {
        id: "future",
        name: "Conta futura",
        isCreditCard: false,
        startMonth: "2027-01",
        sortOrder: 10,
      },
    ];

    expect(getActiveLiquidityAccounts(accounts, "2026-12")).toHaveLength(0);
    expect(getActiveLiquidityAccounts(accounts, "2027-01")).toHaveLength(1);
  });
});
