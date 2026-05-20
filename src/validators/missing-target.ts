/**
 * Missing-target validator.
 *
 * Flags translation units where a target locale lacks a translation,
 * distinguishing three cases:
 *
 * - missing-target: no localization entry at all for this locale.
 * - needs-translation: entry exists with empty value and "new" or
 *   "needs-translation" state. Translator workflow expects this.
 * - empty-target: entry exists with empty value but NOT a new/needs-translation
 *   state. This is a likely bug (translator marked it translated but it is empty).
 * - needs-review: translator-flagged for review.
 */

import type { LocalizationAST } from "../ast.js";
import type { Finding } from "./findings.js";

export function checkMissingTargets(ast: LocalizationAST): Finding[] {
  const findings: Finding[] = [];

  for (const unit of ast.units) {
    for (const locale of ast.targetLocales) {
      const target = unit.targets.get(locale);

      if (!target) {
        findings.push({
          key: unit.key,
          locale,
          kind: "missing-target",
          severity: "warning",
          message: `key not localized for ${locale}`,
        });
        continue;
      }

      for (const variant of target.variants) {
        const pluralSuffix = variant.pluralCategory ? ` (plural: ${variant.pluralCategory})` : "";

        if (variant.value === null || variant.value === "") {
          if (variant.state === "new" || variant.state === "needs-translation") {
            findings.push({
              key: unit.key,
              locale,
              kind: "needs-translation",
              severity: "warning",
              message: `empty target awaiting translation${pluralSuffix}`,
              pluralCategory: variant.pluralCategory,
            });
          } else {
            findings.push({
              key: unit.key,
              locale,
              kind: "empty-target",
              severity: "error",
              message: `empty target with state "${variant.state}" (expected "new" or "needs-translation")${pluralSuffix}`,
              pluralCategory: variant.pluralCategory,
            });
          }
        } else if (variant.state === "needs-review") {
          findings.push({
            key: unit.key,
            locale,
            kind: "needs-review",
            severity: "info",
            message: `target flagged for review${pluralSuffix}`,
            pluralCategory: variant.pluralCategory,
          });
        }
      }
    }
  }

  return findings;
}
