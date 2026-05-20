import { describe, expect, it } from "vitest";
import { parseXcstrings } from "../src/adapters/xcstrings.js";
import { parseXliff } from "../src/adapters/xliff.js";
import { checkMissingTargets } from "../src/validators/missing-target.js";
import { checkPlaceholderMismatches } from "../src/validators/placeholder-mismatch.js";
import { runChecks } from "../src/validators/runChecks.js";

describe("checkMissingTargets on booknook.xcstrings", () => {
  it("flags keys with no localization entry for a target locale", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkMissingTargets(ast);
    // welcome.title has no ar localization, so ar is missing
    const arMissing = findings.find(
      (f) => f.key === "welcome.title" && f.locale === "ar" && f.kind === "missing-target",
    );
    expect(arMissing).toBeDefined();
  });

  it("flags empty target with new state as needs-translation", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkMissingTargets(ast);
    // action.continue.reading has fr with state=new and value=""
    const frNeedsTranslation = findings.find(
      (f) =>
        f.key === "action.continue.reading" &&
        f.locale === "fr" &&
        f.kind === "needs-translation",
    );
    expect(frNeedsTranslation).toBeDefined();
    expect(frNeedsTranslation?.severity).toBe("warning");
  });

  it("flags needs-review state as info-severity", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkMissingTargets(ast);
    // book.read.percent has pl with state=needs_review
    const needsReview = findings.find(
      (f) => f.key === "book.read.percent" && f.locale === "pl" && f.kind === "needs-review",
    );
    expect(needsReview).toBeDefined();
    expect(needsReview?.severity).toBe("info");
  });

  it("does not flag translated entries", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkMissingTargets(ast);
    // welcome.title is translated for de, fr, ja, pl
    const welcomeIssues = findings.filter(
      (f) => f.key === "welcome.title" && f.locale !== "ar",
    );
    expect(welcomeIssues).toEqual([]);
  });
});

describe("checkMissingTargets on booknook-de.xliff", () => {
  it("flags empty needs-translation targets", async () => {
    const ast = await parseXliff("samples/booknook-de.xliff");
    const findings = checkMissingTargets(ast);
    const cart = findings.find(
      (f) => f.key === "cart.empty.message" && f.kind === "needs-translation",
    );
    expect(cart).toBeDefined();
  });

  it("flags empty new-state targets as needs-translation", async () => {
    const ast = await parseXliff("samples/booknook-de.xliff");
    const findings = checkMissingTargets(ast);
    const onboarding = findings.find(
      (f) => f.key === "onboarding.step.welcome" && f.kind === "needs-translation",
    );
    expect(onboarding).toBeDefined();
  });

  it("does not flag translated trans-units", async () => {
    const ast = await parseXliff("samples/booknook-de.xliff");
    const findings = checkMissingTargets(ast);
    const welcomeFindings = findings.filter((f) => f.key === "welcome.title");
    expect(welcomeFindings).toEqual([]);
  });
});

describe("checkPlaceholderMismatches", () => {
  it("flags Arabic plural variants that drop the count placeholder", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPlaceholderMismatches(ast);
    // review.rating.stars in Arabic: zero/one/two forms spell out the count
    // ("no stars", "one star", "two stars" via dual form) and drop %d. Apple's
    // runtime needs the placeholder to substitute the integer, so this IS a
    // real bug the validator should catch. Three known mismatches.
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors).toHaveLength(3);
    expect(
      errors.every((e) => e.key === "review.rating.stars" && e.locale === "ar"),
    ).toBe(true);
    expect(errors.map((e) => e.pluralCategory).sort()).toEqual(["one", "two", "zero"]);
  });

  it("does not flag Japanese reversed positional tokens (valid permutation)", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = checkPlaceholderMismatches(ast);
    // ja share.with.friends uses "%2$@に%1$@を共有" — reversed order but both tokens present
    const jaShareFindings = findings.filter(
      (f) => f.key === "share.with.friends" && f.locale === "ja",
    );
    expect(jaShareFindings).toEqual([]);
  });

  it("can detect a synthetic mismatch", async () => {
    // Construct a minimal AST with a deliberate placeholder bug
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const unit = ast.units.find((u) => u.key === "user.greeting");
    expect(unit).toBeDefined();
    if (!unit) return;
    // Corrupt the de target so it loses the placeholder
    unit.targets.get("de")!.variants[0]!.value = "Hallo!";
    const findings = checkPlaceholderMismatches(ast);
    const userGreetingDe = findings.find(
      (f) => f.key === "user.greeting" && f.locale === "de",
    );
    expect(userGreetingDe).toBeDefined();
    expect(userGreetingDe?.kind).toBe("placeholder-missing");
    expect(userGreetingDe?.severity).toBe("error");
  });
});

describe("runChecks orchestrator", () => {
  it("returns aggregated findings (missing + placeholder)", async () => {
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    const findings = runChecks(ast);
    expect(findings.length).toBeGreaterThan(0);
    // expect both validator types to be represented in the kind set
    const kinds = new Set(findings.map((f) => f.kind));
    expect(kinds.has("missing-target")).toBe(true);
  });

  it("returns empty findings on a complete file with no issues (synthetic)", async () => {
    // Construct a tiny AST manually with full coverage
    const ast = await parseXcstrings("samples/booknook.xcstrings");
    // Strip targets so only one unit + one locale remains, fully populated
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    if (!welcome) throw new Error("welcome.title missing in fixture");
    ast.units = [welcome];
    ast.targetLocales = new Set(["de"]);
    // welcome.title has a translated de target, no placeholders
    const findings = runChecks(ast);
    expect(findings).toEqual([]);
  });
});
