import { describe, expect, it } from "vitest";
import { parseXliff } from "../src/adapters/xliff.js";

const SAMPLE = "samples/booknook-de.xliff";

describe("parseXliff", () => {
  it("parses the BookNook German XLIFF without throwing", async () => {
    const ast = await parseXliff(SAMPLE);
    expect(ast.metadata.unitCount).toBe(12);
    expect(ast.sourceLocale).toBe("en");
  });

  it("collects target locale", async () => {
    const ast = await parseXliff(SAMPLE);
    expect([...ast.targetLocales]).toEqual(["de"]);
  });

  it("extracts trans-unit source + target text", async () => {
    const ast = await parseXliff(SAMPLE);
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome?.source).toBe("Welcome to BookNook");
    const german = welcome?.targets.get("de");
    expect(german?.variants[0]?.value).toBe("Willkommen bei BookNook");
    expect(german?.variants[0]?.state).toBe("translated");
  });

  it("extracts developer notes from trans-unit", async () => {
    const ast = await parseXliff(SAMPLE);
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome?.notes).toHaveLength(1);
    expect(welcome?.notes[0]?.content).toBe("Title shown on app launch screen");
    expect(welcome?.notes[0]?.from).toBe("developer");
  });

  it("handles a trans-unit with no note", async () => {
    const ast = await parseXliff(SAMPLE);
    const settings = ast.units.find((u) => u.key === "settings.title");
    expect(settings?.notes).toHaveLength(0);
  });

  it("preserves needs-translation state with empty target", async () => {
    const ast = await parseXliff(SAMPLE);
    const cart = ast.units.find((u) => u.key === "cart.empty.message");
    expect(cart).toBeDefined();
    const german = cart?.targets.get("de");
    expect(german?.variants[0]?.value).toBe("");
    expect(german?.variants[0]?.state).toBe("needs-translation");
  });

  it("preserves new state with empty target", async () => {
    const ast = await parseXliff(SAMPLE);
    const onboarding = ast.units.find((u) => u.key === "onboarding.step.welcome");
    expect(onboarding).toBeDefined();
    const german = onboarding?.targets.get("de");
    expect(german?.variants[0]?.value).toBe("");
    expect(german?.variants[0]?.state).toBe("new");
  });

  it("detects positional placeholders in source", async () => {
    const ast = await parseXliff(SAMPLE);
    const unit = ast.units.find((u) => u.key === "share.with.friends");
    expect(unit?.placeholders).toHaveLength(2);
    expect(unit?.placeholders[0]?.type).toBe("positional");
    expect(unit?.placeholders[0]?.positionalIndex).toBe(1);
    expect(unit?.placeholders[1]?.positionalIndex).toBe(2);
  });

  it("tags origin format as ios-xliff", async () => {
    const ast = await parseXliff(SAMPLE);
    expect(ast.units[0]?.origin.format).toBe("ios-xliff");
  });
});
