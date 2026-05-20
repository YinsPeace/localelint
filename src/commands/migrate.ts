/**
 * `localelint migrate <lproj-dir> <xcstrings-file>` command.
 *
 * Loads legacy AST from an .lproj directory tree and a catalog AST
 * from a .xcstrings file, then runs the migration comparison validator.
 */

import { parseLproj } from "../adapters/lproj.js";
import { parseXcstrings } from "../adapters/xcstrings.js";
import type { Finding } from "../validators/findings.js";
import { compareMigration } from "../validators/migrate-comparison.js";

export interface MigrateResult {
  legacy: { unitCount: number; targetLocales: string[] };
  catalog: { unitCount: number; targetLocales: string[] };
  findings: Finding[];
}

export async function runMigrate(
  lprojDir: string,
  xcstringsPath: string,
  sourceLocale = "en",
): Promise<MigrateResult> {
  const legacy = await parseLproj(lprojDir, sourceLocale);
  const catalog = await parseXcstrings(xcstringsPath);
  const findings = compareMigration(legacy, catalog);
  return {
    legacy: {
      unitCount: legacy.metadata.unitCount,
      targetLocales: [...legacy.targetLocales].sort(),
    },
    catalog: {
      unitCount: catalog.metadata.unitCount,
      targetLocales: [...catalog.targetLocales].sort(),
    },
    findings,
  };
}
