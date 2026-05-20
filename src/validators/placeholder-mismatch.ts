/**
 * Placeholder-mismatch validator.
 *
 * Detects per-locale per-key mismatches in format specifiers. The source
 * string's placeholders are the reference. Every translated target must
 * contain the same set of placeholders. Missing or extra tokens are
 * almost always bugs that will surface in production.
 */

import type { LocalizationAST } from "../ast.js";
import type { Finding } from "./findings.js";
import { comparePlaceholders, detectPlaceholders } from "./placeholders.js";

export function checkPlaceholderMismatches(ast: LocalizationAST): Finding[] {
  const findings: Finding[] = [];

  for (const unit of ast.units) {
    if (unit.placeholders.length === 0) continue;

    for (const target of unit.targets.values()) {
      for (const variant of target.variants) {
        if (!variant.value) continue;

        const targetPlaceholders = detectPlaceholders(variant.value);
        const mismatches = comparePlaceholders(unit.placeholders, targetPlaceholders);

        for (const mm of mismatches) {
          const pluralSuffix = variant.pluralCategory ? ` (plural: ${variant.pluralCategory})` : "";
          const kind = mm.kind === "missing" ? "placeholder-missing" : "placeholder-extra";
          findings.push({
            key: unit.key,
            locale: target.locale,
            kind,
            severity: "error",
            message: `placeholder ${mm.token} ${mm.kind} (source ${mm.sourceCount}, target ${mm.targetCount})${pluralSuffix}`,
            pluralCategory: variant.pluralCategory,
          });
        }
      }
    }
  }

  return findings;
}
