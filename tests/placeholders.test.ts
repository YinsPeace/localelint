import { describe, expect, it } from "vitest";
import { comparePlaceholders, detectPlaceholders } from "../src/validators/placeholders.js";

describe("detectPlaceholders", () => {
  it("detects a single printf token", () => {
    const found = detectPlaceholders("Hello, %@!");
    expect(found).toHaveLength(1);
    expect(found[0]?.token).toBe("%@");
    expect(found[0]?.type).toBe("printf");
    expect(found[0]?.offset).toBe(7);
  });

  it("detects multiple printf tokens", () => {
    const found = detectPlaceholders("You have %d items costing %@");
    expect(found).toHaveLength(2);
    expect(found.map((p) => p.token)).toEqual(["%d", "%@"]);
  });

  it("detects positional tokens with index", () => {
    const found = detectPlaceholders("Share %1$@ with %2$@");
    expect(found).toHaveLength(2);
    expect(found[0]?.type).toBe("positional");
    expect(found[0]?.positionalIndex).toBe(1);
    expect(found[1]?.positionalIndex).toBe(2);
  });

  it("detects long-format printf tokens", () => {
    const found = detectPlaceholders("%lld books");
    expect(found).toHaveLength(1);
    expect(found[0]?.token).toBe("%lld");
  });

  it("detects length modifiers (l, ll, h, hh)", () => {
    expect(detectPlaceholders("%ld").map((p) => p.token)).toEqual(["%ld"]);
    expect(detectPlaceholders("%lld").map((p) => p.token)).toEqual(["%lld"]);
    expect(detectPlaceholders("%hd").map((p) => p.token)).toEqual(["%hd"]);
    expect(detectPlaceholders("%hhd").map((p) => p.token)).toEqual(["%hhd"]);
  });

  it("detects positional token with length modifier", () => {
    const found = detectPlaceholders("Count: %1$lld");
    expect(found).toHaveLength(1);
    expect(found[0]?.token).toBe("%1$lld");
    expect(found[0]?.type).toBe("positional");
    expect(found[0]?.positionalIndex).toBe(1);
  });

  it("does not treat literal %% as a placeholder", () => {
    expect(detectPlaceholders("100%% complete")).toEqual([]);
  });

  it("detects ICU named placeholders", () => {
    const found = detectPlaceholders("Hello, {name}!");
    expect(found).toHaveLength(1);
    expect(found[0]?.token).toBe("{name}");
    expect(found[0]?.type).toBe("named");
  });

  it("returns empty array for plain strings", () => {
    expect(detectPlaceholders("Just plain text.")).toEqual([]);
  });

  it("sorts placeholders by offset", () => {
    const found = detectPlaceholders("End %@ middle %d start");
    expect(found[0]?.offset).toBeLessThan(found[1]?.offset ?? 0);
  });
});

describe("comparePlaceholders", () => {
  it("returns no mismatches when source and target match", () => {
    const source = detectPlaceholders("Hello, %@!");
    const target = detectPlaceholders("Hallo, %@!");
    expect(comparePlaceholders(source, target)).toEqual([]);
  });

  it("flags a missing token in target", () => {
    const source = detectPlaceholders("Hello, %@!");
    const target = detectPlaceholders("Hallo!");
    const result = comparePlaceholders(source, target);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("missing");
    expect(result[0]?.token).toBe("%@");
  });

  it("flags an extra token in target", () => {
    const source = detectPlaceholders("Hello!");
    const target = detectPlaceholders("Hallo, %@!");
    const result = comparePlaceholders(source, target);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("extra");
    expect(result[0]?.token).toBe("%@");
  });

  it("flags duplicate-count mismatches", () => {
    const source = detectPlaceholders("%@ and %@");
    const target = detectPlaceholders("%@ alone");
    const result = comparePlaceholders(source, target);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("missing");
    expect(result[0]?.sourceCount).toBe(2);
    expect(result[0]?.targetCount).toBe(1);
  });

  it("treats reordered positional tokens as matching", () => {
    const source = detectPlaceholders("Share %1$@ with %2$@");
    const target = detectPlaceholders("%2$@に%1$@を共有");
    expect(comparePlaceholders(source, target)).toEqual([]);
  });
});
