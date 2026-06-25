import { describe, expect, it } from "vitest";
import { assertCents, formatEditableEuroCents, formatEuroCents, parseEuroCents, sumCents } from "./money";

describe("money helpers", () => {
  it("formats zero as a valid euro amount", () => {
    expect(formatEuroCents(0)).toBe("0,00 €");
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
});
