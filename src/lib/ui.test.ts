import { describe, it, expect } from "vitest";
import { consumptionColor, hoursFmt } from "./ui";

describe("consumptionColor", () => {
  it("100% 超は赤", () => {
    expect(consumptionColor(101)).toBe("#ef4444");
  });
  it("80〜100% は緑", () => {
    expect(consumptionColor(80)).toBe("#10b981");
    expect(consumptionColor(100)).toBe("#10b981");
  });
  it("50〜79% は橙", () => {
    expect(consumptionColor(50)).toBe("#f59e0b");
    expect(consumptionColor(79)).toBe("#f59e0b");
  });
  it("50% 未満は青", () => {
    expect(consumptionColor(0)).toBe("#0ea5e9");
    expect(consumptionColor(49)).toBe("#0ea5e9");
  });
});

describe("hoursFmt", () => {
  it("桁区切りと単位を付与する", () => {
    expect(hoursFmt(1234)).toBe("1,234 h");
    expect(hoursFmt(0)).toBe("0 h");
  });
});
