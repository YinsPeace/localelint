import { describe, expect, it } from "vitest";
import { parseXcstrings } from "../src/adapters/xcstrings.js";
import { checkPluralCoverage } from "../src/validators/plural-coverage.js";
import type { LocalizationAST } from "../src/ast.js";

describe("checkPluralCoverage on booknook.xcstrings", () => {
  it("returns no findings when Polish covers all 4 required categories", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPluralCoverage(ast);
    const polishLibraryFindings = findings.filter(
      (f) => f.key === "library.books.count" && f.locale === "pl",
    );
    expect(polishLibraryFindings).toEqual([]);
  });

  it("returns no findings when Arabic covers all 6 required categories", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPluralCoverage(ast);
    const arabicStarsFindings = findings.filter(
      (f) => f.key === "review.rating.stars" && f.locale === "ar",
    );
    expect(arabicStarsFindings).toEqual([]);
  });

  it("does not flag Japanese single stringUnit for plural source", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPluralCoverage(ast);
    // library.books.count has Japanese as a single stringUnit (no variations.plural)
    const jaFindings = findings.filter(
      (f) => f.key === "library.books.count" && f.locale === "ja",
    );
    expect(jaFindings).toEqual([]);
  });

  it("does not flag non-plural keys at all", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPluralCoverage(ast);
    const nonPluralKeys = ["welcome.title", "settings.title", "user.greeting"];
    for (const key of nonPluralKeys) {
      const f = findings.filter((finding) => finding.key === key);
      expect(f).toEqual([]);
    }
  });
});

describe("checkPluralCoverage on synthetic gap scenarios", () => {
  it("flags Polish missing 'few' category", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const unit = ast.units.find((u) => u.key === "library.books.count");
    if (!unit) throw new Error("fixture missing library.books.count");
    const polish = unit.targets.get("pl");
    if (!polish) throw new Error("fixture missing pl target");
    // Remove the "few" variant to simulate a real-world gap
    polish.variants = polish.variants.filter((v) => v.pluralCategory !== "few");

    const findings = checkPluralCoverage(ast);
    const missing = findings.find(
      (f) =>
        f.key === "library.books.count" &&
        f.locale === "pl" &&
        f.kind === "plural-missing-category" &&
        f.pluralCategory === "few",
    );
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe("error");
  });

  it("flags an unexpected 'zero' category in German (CLDR does not require it)", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const unit = ast.units.find((u) => u.key === "library.books.count");
    if (!unit) throw new Error("fixture missing library.books.count");
    const german = unit.targets.get("de");
    if (!german) throw new Error("fixture missing de target");
    // Inject a spurious zero variant
    german.variants.push({
      pluralCategory: "zero",
      value: "%lld Bücher",
      state: "translated",
    });

    const findings = checkPluralCoverage(ast);
    const extra = findings.find(
      (f) =>
        f.key === "library.books.count" &&
        f.locale === "de" &&
        f.kind === "plural-extra-category" &&
        f.pluralCategory === "zero",
    );
    expect(extra).toBeDefined();
    expect(extra?.severity).toBe("warning");
  });

  it("handles unknown locale gracefully (no throw)", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const unit = ast.units.find((u) => u.key === "library.books.count");
    if (!unit) throw new Error("fixture missing library.books.count");
    // Inject a made-up locale
    unit.targets.set("xx-INVALID", {
      locale: "xx-INVALID",
      variants: [{ pluralCategory: "one", value: "x", state: "translated" }],
    });
    (ast as LocalizationAST).targetLocales.add("xx-INVALID");

    expect(() => checkPluralCoverage(ast)).not.toThrow();
  });
});
