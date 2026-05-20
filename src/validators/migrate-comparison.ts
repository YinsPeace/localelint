/**
 * Migration comparison validator.
 *
 * Compares two ASTs:
 *   - legacy: built from a .lproj directory of .strings + .stringsdict files
 *   - catalog: parsed from a post-migration Localizable.xcstrings
 *
 * Detects translation/plural/comment/placeholder/key drift. Used by the
 * `localelint migrate` command to validate Xcode's auto-migration didn't
 * silently lose data.
 */

import type { LocalizationAST, PluralCategory, TranslationUnit } from "../ast.js";
import type { Finding } from "./findings.js";
import { comparePlaceholders, detectPlaceholders } from "./placeholders.js";

export function compareMigration(legacy: LocalizationAST, catalog: LocalizationAST): Finding[] {
  const findings: Finding[] = [];
  const legacyByKey = new Map(legacy.units.map((u) => [u.key, u]));
  const catalogByKey = new Map(catalog.units.map((u) => [u.key, u]));

  for (const [key, legacyUnit] of legacyByKey) {
    const catalogUnit = catalogByKey.get(key);
    if (!catalogUnit) {
      findings.push({
        key,
        locale: "*",
        kind: "migration-lost-translation",
        severity: "error",
        message: `key "${key}" present in legacy but not in catalog`,
      });
      continue;
    }

    findings.push(...compareUnit(legacyUnit, catalogUnit));
  }

  for (const [key] of catalogByKey) {
    if (!legacyByKey.has(key)) {
      findings.push({
        key,
        locale: "*",
        kind: "migration-extra-key",
        severity: "warning",
        message: `catalog has key "${key}" that was not in legacy lproj`,
      });
    }
  }

  return findings;
}

function compareUnit(legacy: TranslationUnit, catalog: TranslationUnit): Finding[] {
  const findings: Finding[] = [];

  if (legacy.notes.length > 0) {
    const legacyComment = legacy.notes.find((n) => n.from === "developer")?.content;
    const catalogComment = catalog.notes.find((n) => n.from === "developer")?.content;
    if (legacyComment && legacyComment !== catalogComment) {
      findings.push({
        key: legacy.key,
        locale: "*",
        kind: "migration-comment-drift",
        severity: "warning",
        message: catalogComment
          ? `developer comment changed during migration (legacy: "${legacyComment}", catalog: "${catalogComment}")`
          : `developer comment dropped during migration (legacy had: "${legacyComment}")`,
      });
    }
  }

  for (const [locale, legacyTarget] of legacy.targets) {
    // Skip source locale as it's not a target locale
    if (locale === legacy.sourceLocale) continue;

    const catalogTarget = catalog.targets.get(locale);
    if (!catalogTarget) {
      findings.push({
        key: legacy.key,
        locale,
        kind: "migration-lost-translation",
        severity: "error",
        message: `legacy ${locale} translation missing from catalog`,
      });
      continue;
    }

    if (legacy.isPlural) {
      const legacyCategories = new Set(
        legacyTarget.variants.map((v) => v.pluralCategory).filter((c): c is PluralCategory => c !== undefined),
      );
      const catalogCategories = new Set(
        catalogTarget.variants.map((v) => v.pluralCategory).filter((c): c is PluralCategory => c !== undefined),
      );
      for (const cat of legacyCategories) {
        if (!catalogCategories.has(cat)) {
          findings.push({
            key: legacy.key,
            locale,
            kind: "migration-lost-plural-category",
            severity: "error",
            message: `legacy plural category "${cat}" missing from catalog for ${locale}`,
            pluralCategory: cat,
          });
        }
      }

      for (const legacyVariant of legacyTarget.variants) {
        const catalogVariant = catalogTarget.variants.find(
          (v) => v.pluralCategory === legacyVariant.pluralCategory,
        );
        if (catalogVariant && legacyVariant.value && catalogVariant.value) {
          findings.push(
            ...comparePlaceholdersForVariant(
              legacy.key,
              locale,
              legacyVariant.value,
              catalogVariant.value,
              legacyVariant.pluralCategory,
            ),
          );
        }
      }
    } else {
      const legacyValue = legacyTarget.variants[0]?.value;
      const catalogValue = catalogTarget.variants[0]?.value;
      if (legacyValue && catalogValue) {
        findings.push(
          ...comparePlaceholdersForVariant(legacy.key, locale, legacyValue, catalogValue),
        );
      }
    }
  }

  return findings;
}

function comparePlaceholdersForVariant(
  key: string,
  locale: string,
  legacyValue: string,
  catalogValue: string,
  pluralCategory?: PluralCategory,
): Finding[] {
  const legacyPh = detectPlaceholders(legacyValue);
  const catalogPh = detectPlaceholders(catalogValue);
  const mismatches = comparePlaceholders(legacyPh, catalogPh);
  return mismatches.map((mm) => ({
    key,
    locale,
    kind: "migration-placeholder-corrupted",
    severity: "error" as const,
    message: `placeholder ${mm.token} ${mm.kind} in catalog vs legacy (legacy ${mm.sourceCount}, catalog ${mm.targetCount})${
      pluralCategory ? ` (plural: ${pluralCategory})` : ""
    }`,
    pluralCategory,
  }));
}
