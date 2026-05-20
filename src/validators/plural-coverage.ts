/**
 * CLDR plural coverage validator.
 *
 * For every plural-keyed translation unit, checks that each target locale's
 * variants cover the categories required by CLDR for that locale.
 *
 * Examples:
 * - English (en, de, sv): "one" + "other"
 * - Polish (pl): "one" + "few" + "many" + "other"
 * - Arabic (ar): "zero" + "one" + "two" + "few" + "many" + "other"
 * - Japanese (ja), Chinese (zh), Korean (ko): "other" only
 *
 * Apple String Catalogs allow a single non-plural stringUnit as the target
 * for a plural-keyed source when the locale has no plural distinction or
 * when the developer chose a single form. We treat that case as "all
 * categories covered" rather than flagging it.
 *
 * Data source: Node's built-in Intl.PluralRules (CLDR data baked into V8).
 * No external dependency.
 */

import type { LocalizationAST, PluralCategory } from "../ast.js";
import type { Finding } from "./findings.js";

export function checkPluralCoverage(ast: LocalizationAST): Finding[] {
  const findings: Finding[] = [];

  for (const unit of ast.units) {
    if (!unit.isPlural) continue;

    for (const target of unit.targets.values()) {
      const hasPluralVariants = target.variants.some((v) => v.pluralCategory !== undefined);
      if (!hasPluralVariants) {
        // Single non-plural variant covers all categories (e.g. Japanese)
        continue;
      }

      let requiredCategories: Set<string>;
      try {
        const rules = new Intl.PluralRules(target.locale);
        requiredCategories = new Set(rules.resolvedOptions().pluralCategories);
      } catch {
        continue;
      }

      const presentCategories = new Set<string>(
        target.variants
          .filter((v) => v.value !== null && v.value !== "")
          .map((v) => v.pluralCategory)
          .filter((c): c is PluralCategory => c !== undefined),
      );

      for (const required of requiredCategories) {
        if (!presentCategories.has(required)) {
          findings.push({
            key: unit.key,
            locale: target.locale,
            kind: "plural-missing-category",
            severity: "error",
            message: `missing plural category "${required}" required by CLDR for ${target.locale}`,
            pluralCategory: required,
          });
        }
      }

      for (const present of presentCategories) {
        if (!requiredCategories.has(present)) {
          findings.push({
            key: unit.key,
            locale: target.locale,
            kind: "plural-extra-category",
            severity: "warning",
            message: `unexpected plural category "${present}" for ${target.locale} (CLDR does not require it)`,
            pluralCategory: present,
          });
        }
      }
    }
  }

  return findings;
}
