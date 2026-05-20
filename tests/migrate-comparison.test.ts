import { describe, expect, it } from "vitest";
import { parseLproj } from "../src/adapters/lproj.js";
import { parseXcstrings } from "../src/adapters/xcstrings.js";
import { compareMigration } from "../src/validators/migrate-comparison.js";

describe("compareMigration: clean migration", () => {
  it("returns no findings when catalog matches legacy exactly", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable.xcstrings");
    const findings = compareMigration(legacy, catalog);
    expect(findings).toEqual([]);
  });
});

describe("compareMigration: lossy migration", () => {
  it("flags lost Polish translation for welcome.title", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable-lossy.xcstrings");
    const findings = compareMigration(legacy, catalog);
    const lost = findings.find(
      (f) =>
        f.key === "welcome.title" &&
        f.locale === "pl" &&
        f.kind === "migration-lost-translation",
    );
    expect(lost).toBeDefined();
    expect(lost?.severity).toBe("error");
  });

  it("flags lost Polish 'many' plural category for notes.count", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable-lossy.xcstrings");
    const findings = compareMigration(legacy, catalog);
    const lost = findings.find(
      (f) =>
        f.key === "notes.count" &&
        f.locale === "pl" &&
        f.kind === "migration-lost-plural-category" &&
        f.pluralCategory === "many",
    );
    expect(lost).toBeDefined();
    expect(lost?.severity).toBe("error");
  });

  it("flags corrupted %@ placeholder in German user.greeting", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable-lossy.xcstrings");
    const findings = compareMigration(legacy, catalog);
    const corrupted = findings.find(
      (f) =>
        f.key === "user.greeting" &&
        f.locale === "de" &&
        f.kind === "migration-placeholder-corrupted",
    );
    expect(corrupted).toBeDefined();
    expect(corrupted?.severity).toBe("error");
  });

  it("flags dropped comment on action.new.note", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable-lossy.xcstrings");
    const findings = compareMigration(legacy, catalog);
    const drift = findings.find(
      (f) =>
        f.key === "action.new.note" &&
        f.kind === "migration-comment-drift",
    );
    expect(drift).toBeDefined();
    expect(drift?.severity).toBe("warning");
  });

  it("flags extra.unexpected.key not present in legacy", async () => {
    const legacy = await parseLproj("samples/legacy-app");
    const catalog = await parseXcstrings("samples/legacy-app/Localizable-lossy.xcstrings");
    const findings = compareMigration(legacy, catalog);
    const extra = findings.find(
      (f) => f.key === "extra.unexpected.key" && f.kind === "migration-extra-key",
    );
    expect(extra).toBeDefined();
    expect(extra?.severity).toBe("warning");
  });
});
