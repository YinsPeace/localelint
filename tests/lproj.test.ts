import { describe, expect, it } from "vitest";
import { parseLproj } from "../src/adapters/lproj.js";

describe("parseLproj", () => {
  it("discovers all .lproj folders under the directory", async () => {
    const ast = await parseLproj("samples/legacy-app");
    const locales = [...ast.targetLocales].sort();
    expect(locales).toEqual(["de", "pl"]);
  });

  it("merges .strings and .stringsdict for each locale", async () => {
    const ast = await parseLproj("samples/legacy-app");
    // 5 unique keys: welcome.title, user.greeting, action.new.note, notes.empty.message, notes.count
    expect(ast.metadata.unitCount).toBe(5);
  });

  it("treats .stringsdict as source of truth for plural-keyed entries", async () => {
    const ast = await parseLproj("samples/legacy-app");
    const unit = ast.units.find((u) => u.key === "notes.count");
    expect(unit?.isPlural).toBe(true);
    const polish = unit?.targets.get("pl");
    expect(polish?.variants).toHaveLength(4);
  });

  it("preserves comments from .strings file", async () => {
    const ast = await parseLproj("samples/legacy-app");
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome?.notes[0]?.content).toBe("Welcome screen title");
  });

  it("uses sourceLocale 'en' by convention", async () => {
    const ast = await parseLproj("samples/legacy-app");
    expect(ast.sourceLocale).toBe("en");
  });

  it("tags origin format as ios-lproj", async () => {
    const ast = await parseLproj("samples/legacy-app");
    expect(ast.metadata.formats).toContain("ios-lproj");
  });
});
