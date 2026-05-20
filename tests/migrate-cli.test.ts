import { describe, expect, it } from "vitest";
import { runMigrate } from "../src/commands/migrate.js";

describe("runMigrate orchestrator", () => {
  it("returns no findings on clean migration", async () => {
    const result = await runMigrate(
      "samples/legacy-app",
      "samples/legacy-app/Localizable.xcstrings",
    );
    expect(result.findings).toEqual([]);
  });

  it("returns findings on lossy migration", async () => {
    const result = await runMigrate(
      "samples/legacy-app",
      "samples/legacy-app/Localizable-lossy.xcstrings",
    );
    expect(result.findings.length).toBeGreaterThanOrEqual(5);
  });

  it("reports unit counts for both sides", async () => {
    const result = await runMigrate(
      "samples/legacy-app",
      "samples/legacy-app/Localizable.xcstrings",
    );
    expect(result.legacy.unitCount).toBe(5);
    expect(result.catalog.unitCount).toBe(5);
  });
});
