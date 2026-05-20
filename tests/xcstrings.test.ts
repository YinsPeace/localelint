import { describe, expect, it } from "vitest";
import { parseXcstrings } from "../src/adapters/xcstrings.js";

const SAMPLE = "samples/booknook.xcstrings";

describe("parseXcstrings", () => {
  it("parses the BookNook sample without throwing", async () => {
    const ast = await parseXcstrings(SAMPLE);
    expect(ast.metadata.unitCount).toBe(12);
    expect(ast.sourceLocale).toBe("en");
  });

  it("collects all target locales", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const locales = [...ast.targetLocales].sort();
    expect(locales).toEqual(["ar", "de", "fr", "ja", "pl"]);
  });

  it("extracts comments as developer notes", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const welcome = ast.units.find((u) => u.key === "welcome.title");
    expect(welcome).toBeDefined();
    expect(welcome?.notes).toHaveLength(1);
    expect(welcome?.notes[0]?.from).toBe("developer");
    expect(welcome?.notes[0]?.content).toBe("Title shown on app launch screen");
  });

  it("handles a key with no comment", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const settings = ast.units.find((u) => u.key === "settings.title");
    expect(settings).toBeDefined();
    expect(settings?.notes).toHaveLength(0);
  });

  it("extracts Polish 4-category plural variants", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "library.books.count");
    const polish = unit?.targets.get("pl");
    expect(polish?.variants).toHaveLength(4);
    const categories = polish?.variants.map((v) => v.pluralCategory).sort();
    expect(categories).toEqual(["few", "many", "one", "other"]);
  });

  it("extracts Arabic 6-category plural variants", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "review.rating.stars");
    const arabic = unit?.targets.get("ar");
    expect(arabic?.variants).toHaveLength(6);
    const categories = arabic?.variants.map((v) => v.pluralCategory).sort();
    expect(categories).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });

  it("marks plural-keyed source units as isPlural", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const plural = ast.units.find((u) => u.key === "library.books.count");
    const nonPlural = ast.units.find((u) => u.key === "welcome.title");
    expect(plural?.isPlural).toBe(true);
    expect(nonPlural?.isPlural).toBe(false);
  });

  it("preserves explicit empty targets with new state", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "action.continue.reading");
    const french = unit?.targets.get("fr");
    expect(french?.variants[0]?.value).toBe("");
    expect(french?.variants[0]?.state).toBe("new");
  });

  it("preserves needs_review state mapping to needs-review", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "book.read.percent");
    const polish = unit?.targets.get("pl");
    expect(polish?.variants[0]?.state).toBe("needs-review");
  });

  it("detects positional placeholders in source", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "share.with.friends");
    expect(unit?.placeholders).toHaveLength(2);
    expect(unit?.placeholders[0]?.type).toBe("positional");
    expect(unit?.placeholders[0]?.positionalIndex).toBe(1);
    expect(unit?.placeholders[1]?.positionalIndex).toBe(2);
  });

  it("detects printf placeholders in source", async () => {
    const ast = await parseXcstrings(SAMPLE);
    const unit = ast.units.find((u) => u.key === "user.greeting");
    expect(unit?.placeholders).toHaveLength(1);
    expect(unit?.placeholders[0]?.token).toBe("%@");
    expect(unit?.placeholders[0]?.type).toBe("printf");
  });

  it("tags origin format as xcstrings", async () => {
    const ast = await parseXcstrings(SAMPLE);
    expect(ast.units[0]?.origin.format).toBe("xcstrings");
  });
});
