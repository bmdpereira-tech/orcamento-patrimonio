import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HistoryDashboard } from "./history-dashboard";

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Bar: ({ children, name, yAxisId }: { children?: ReactNode; name?: string; yAxisId?: string }) => (
      <div data-testid="bar" data-name={name} data-y-axis-id={yAxisId}>
        {children}
      </div>
    ),
    CartesianGrid: () => <div data-testid="grid" />,
    Cell: ({ fill }: { fill?: string }) => <span data-testid="bar-cell" data-fill={fill} />,
    ComposedChart: passthrough,
    Legend: () => <div data-testid="legend" />,
    Line: ({
      name,
      dataKey,
      connectNulls,
      yAxisId,
    }: {
      name?: string;
      dataKey?: string;
      connectNulls?: boolean;
      yAxisId?: string;
    }) => (
      <div
        data-testid="line"
        data-name={name}
        data-key={dataKey}
        data-connect-nulls={String(connectNulls)}
        data-y-axis-id={yAxisId}
      />
    ),
    LineChart: passthrough,
    ResponsiveContainer: passthrough,
    Tooltip: () => <div data-testid="tooltip" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: ({ yAxisId, orientation }: { yAxisId?: string; orientation?: string }) => (
      <div data-testid="y-axis" data-y-axis-id={yAxisId} data-orientation={orientation} />
    ),
  };
});

describe("HistoryDashboard", () => {
  it("renders only the two visual history sections", () => {
    render(
      <HistoryDashboard
        currentMonth="2026-08"
        liquidity={{
          referenceMonth: "2026-08",
          months: ["2026-07", "2026-08"],
          points: [
            {
              month: "2026-07",
              saldoInicialTotalCents: 100_00,
              saldoFinalTotalCents: 80_00,
              variacaoMensalCents: -20_00,
            },
            {
              month: "2026-08",
              saldoInicialTotalCents: 80_00,
              saldoFinalTotalCents: 125_00,
              variacaoMensalCents: 45_00,
            },
          ],
        }}
        investments={{
          months: ["2026-07", "2026-08"],
          series: [
            {
              id: "core",
              name: "Core Equity",
              isGlobal: false,
              points: [
                { month: "2026-07", xirr: null },
                { month: "2026-08", xirr: 0.12 },
              ],
            },
            {
              id: "global",
              name: "Global",
              isGlobal: true,
              points: [
                { month: "2026-07", xirr: null },
                { month: "2026-08", xirr: 0.1 },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Liquidez e saldo mensal" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rentabilidade dos investimentos (XIRR)" })).toBeTruthy();
    expect(screen.getByLabelText("Mês de referência").getAttribute("value")).toBe("2026-08");
    expect(screen.getByRole("button", { name: "Ano" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ano em curso" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    const liquidityAxes = screen.getAllByTestId("y-axis").slice(0, 2);
    expect(liquidityAxes.map((axis) => axis.getAttribute("data-y-axis-id"))).toEqual(["left", "right"]);
    expect(liquidityAxes.map((axis) => axis.getAttribute("data-orientation"))).toEqual(["left", "right"]);
    expect(screen.getByTestId("bar").getAttribute("data-name")).toBe("Variação mensal");
    expect(screen.getByTestId("bar").getAttribute("data-y-axis-id")).toBe("right");
    expect(screen.getAllByTestId("bar-cell").map((cell) => cell.getAttribute("data-fill"))).toEqual([
      "#dc2626",
      "#16a34a",
    ]);
    const lines = screen.getAllByTestId("line");
    expect(lines.map((line) => line.getAttribute("data-name"))).toEqual([
      "Saldo final",
      "Core Equity",
      "Global",
    ]);
    expect(lines[0]?.getAttribute("data-y-axis-id")).toBe("left");
    expect(lines.at(-1)?.getAttribute("data-connect-nulls")).toBe("false");

    const ytdButtons = screen.getAllByRole("button", { name: "YTD" });
    fireEvent.click(ytdButtons[0] as HTMLButtonElement);
    expect(ytdButtons[0]?.getAttribute("aria-pressed")).toBe("true");
  });
});
