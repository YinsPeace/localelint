import { describe, expect, it } from "vitest";
import { parseStringsdict } from "../src/adapters/stringsdict.js";

describe("parseStringsdict", () => {
  it("parses an English 2-category plural", async () => {
    const ast = await parseStringsdict("samples/legacy-app/en.lproj/Localizable.stringsdict", "en");
    expect(ast.metadata.formats[0]).toBe("ios-stringsdict");
    expect(ast.metadata.unitCount).toBe(1);

    const unit = ast.units.find((u) => u.key === "notes.count");
    expect(unit).toBeDefined();
    expect(unit?.isPlural).toBe(true);

    const target = unit?.targets.get("en");
    expect(target?.variants).toHaveLength(2);
    const categories = target?.variants.map((v) => v.pluralCategory).sort();
    expect(categories).toEqual(["one", "other"]);

    const oneVariant = target?.variants.find((v) => v.pluralCategory === "one");
    expect(oneVariant?.value).toBe("%lld note");
  });

  it("parses a Polish 4-category plural", async () => {
    const ast = await parseStringsdict("samples/legacy-app/pl.lproj/Localizable.stringsdict", "pl");
    const unit = ast.units.find((u) => u.key === "notes.count");
    const target = unit?.targets.get("pl");
    expect(target?.variants).toHaveLength(4);
    const categories = target?.variants.map((v) => v.pluralCategory).sort();
    expect(categories).toEqual(["few", "many", "one", "other"]);
  });

  it("tags origin format as ios-stringsdict", async () => {
    const ast = await parseStringsdict("samples/legacy-app/en.lproj/Localizable.stringsdict", "en");
    expect(ast.units[0]?.origin.format).toBe("ios-stringsdict");
  });

  it("sets sourceLocale and target locale to the provided locale", async () => {
    const ast = await parseStringsdict("samples/legacy-app/pl.lproj/Localizable.stringsdict", "pl");
    expect(ast.sourceLocale).toBe("pl");
    expect([...ast.targetLocales]).toEqual(["pl"]);
  });
});
