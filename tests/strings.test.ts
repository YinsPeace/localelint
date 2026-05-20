import { describe, expect, it } from "vitest";
import { parseStrings, parseStringsString } from "../src/adapters/strings.js";

describe("parseStrings", () => {
  it("parses a minimal single-entry .strings file", async () => {
    const ast = await parseStrings("samples/legacy-app/en.lproj/Localizable.strings", "en");
    expect(ast.sourceLocale).toBe("en");
    expect(ast.metadata.formats[0]).toBe("ios-strings");
    expect(ast.metadata.unitCount).toBe(4);
  });

  it("attaches the locale as both source and a self-target", async () => {
    const ast = await parseStrings("samples/legacy-app/de.lproj/Localizable.strings", "de");
    expect(ast.sourceLocale).toBe("de");
    expect([...ast.targetLocales]).toContain("de");
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome?.targets.get("de")?.variants[0]?.value).toBe("Willkommen bei QuickNotes");
  });

  it("preserves developer comments as notes", async () => {
    const ast = await parseStrings("samples/legacy-app/en.lproj/Localizable.strings", "en");
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome?.notes).toHaveLength(1);
    expect(welcome?.notes[0]?.from).toBe("developer");
    expect(welcome?.notes[0]?.content).toBe("Welcome screen title");
  });

  it("detects placeholders in source values", async () => {
    const ast = await parseStrings("samples/legacy-app/en.lproj/Localizable.strings", "en");
    const greeting = ast.units.find((u) => u.key === "user.greeting");
    expect(greeting?.placeholders).toHaveLength(1);
    expect(greeting?.placeholders[0]?.token).toBe("%@");
  });

  it("handles escape sequences in string values", () => {
    const input = `"escaped" = "Line one\\nLine two with \\"quotes\\"";`;
    const ast = parseStringsString(input, "en");
    const unit = ast.units.find((u) => u.key === "escaped");
    expect(unit?.source).toBe('Line one\nLine two with "quotes"');
  });

  it("throws on missing semicolon", () => {
    const input = `"key" = "value"`;
    expect(() => parseStringsString(input, "en")).toThrow();
  });
});
