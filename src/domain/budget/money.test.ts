import { describe, expect, it } from "vitest";
import {
  assertCents,
  evaluateCurrencyExpressionCents,
  formatEditableEuroCents,
  formatEuroCents,
  parseEuroCents,
  sumCents,
} from "./money";

describe("money helpers", () => {
  it("formats zero as an en dash", () => {
    expect(formatEuroCents(0)).toBe("–");
  });

  it("formats positive euros for Portugal", () => {
    expect(formatEuroCents(123456)).toBe("1 234,56 €");
  });

  it("formats negative values in parentheses", () => {
    expect(formatEuroCents(-123456)).toBe("(1 234,56 €)");
  });

  it("rejects non-integer cent amounts", () => {
    expect(() => assertCents(10.5)).toThrow("inteiros em cêntimos");
  });

  it("sums only integer cents", () => {
    expect(sumCents([100, -40, 15])).toBe(75);
  });

  it("formats values for editable pt-PT inputs", () => {
    expect(formatEditableEuroCents(-123456)).toBe("-1234,56");
  });

  it("parses pt-PT monetary input into cents", () => {
    expect(parseEuroCents("1 234,56 €")).toBe(123456);
    expect(parseEuroCents("(1 234,56 €)")).toBe(-123456);
    expect(parseEuroCents("-1234,5")).toBe(-123450);
  });

  it("evaluates simple currency expressions into cents without executing arbitrary input", () => {
    expect(evaluateCurrencyExpressionCents("1200")).toBe(120000);
    expect(evaluateCurrencyExpressionCents("-1000+2200")).toBe(120000);
    expect(evaluateCurrencyExpressionCents("500+250-100")).toBe(65000);
    expect(evaluateCurrencyExpressionCents("(1000+200)/2")).toBe(60000);
    expect(evaluateCurrencyExpressionCents("1500/2")).toBe(75000);
    expect(evaluateCurrencyExpressionCents("1,50*2")).toBe(300);
  });

  it("rejects invalid currency expressions", () => {
    expect(evaluateCurrencyExpressionCents("abc+100")).toBeNull();
    expect(evaluateCurrencyExpressionCents("100/0")).toBeNull();
    expect(evaluateCurrencyExpressionCents("1000+")).toBeNull();
    expect(evaluateCurrencyExpressionCents("Math.max(1,2)")).toBeNull();
  });
});
