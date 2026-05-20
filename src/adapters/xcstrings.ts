/**
 * Xcode String Catalog (`.xcstrings`) adapter.
 *
 * Parses Xcode 15+ `.xcstrings` JSON files into a LocalizationAST.
 *
 * Phase A scope: parse the top-level `strings` map, source string,
 * localizations per locale, basic plural variants. Defer device variants
 * and substitution variants until real samples reveal their shape.
 */

import { readFile } from "node:fs/promises";
import {
  emptyAST,
  type LocalizationAST,
  type PluralCategory,
  type TranslationState,
  type TranslationUnit,
  type TranslationVariant,
} from "../ast.js";
import { detectPlaceholders } from "../validators/placeholders.js";

interface XcstringsFile {
  sourceLanguage: string;
  strings: Record<string, XcstringsEntry>;
  version: string;
}

interface XcstringsEntry {
  comment?: string;
  extractionState?: "manual" | "extracted_with_value" | "migrated" | "stale";
  shouldTranslate?: boolean;
  localizations?: Record<string, XcstringsLocalization>;
}

interface XcstringsLocalization {
  stringUnit?: XcstringsStringUnit;
  variations?: {
    plural?: Partial<Record<PluralCategory, { stringUnit: XcstringsStringUnit }>>;
  };
}

interface XcstringsStringUnit {
  state: "new" | "translated" | "needs_review" | "stale";
  value: string;
}

export async function parseXcstrings(filePath: string): Promise<LocalizationAST> {
  const json = await readFile(filePath, "utf8");
  return parseXcstringsString(json, filePath);
}

export function parseXcstringsString(json: string, filePath?: string): LocalizationAST {
  const raw = JSON.parse(json) as XcstringsFile;
  const sourceLocale = raw.sourceLanguage;
  const ast = emptyAST(sourceLocale, "xcstrings");

  for (const [key, entry] of Object.entries(raw.strings)) {
    const sourceVariant = entry.localizations?.[sourceLocale];
    const sourceText = extractSourceText(key, sourceVariant);

    const unit: TranslationUnit = {
      key,
      source: sourceText,
      sourceLocale,
      placeholders: detectPlaceholders(sourceText),
      notes: entry.comment ? [{ from: "developer", content: entry.comment }] : [],
      isPlural: hasPlural(sourceVariant),
      targets: new Map(),
      origin: { format: "xcstrings", filePath },
    };

    for (const [locale, localization] of Object.entries(entry.localizations ?? {})) {
      if (locale === sourceLocale) continue;
      const variants = toVariants(localization);
      unit.targets.set(locale, { locale, variants });
      ast.targetLocales.add(locale);
    }

    ast.units.push(unit);
  }

  ast.metadata.unitCount = ast.units.length;
  return ast;
}

function extractSourceText(key: string, sourceVariant: XcstringsLocalization | undefined): string {
  if (!sourceVariant) {
    // In .xcstrings the key is often the source string itself; treat it as source if no localization exists.
    return key;
  }
  if (sourceVariant.stringUnit) {
    return sourceVariant.stringUnit.value;
  }
  if (sourceVariant.variations?.plural) {
    // Use the "other" plural form as canonical source for placeholder detection.
    return sourceVariant.variations.plural.other?.stringUnit.value ?? key;
  }
  return key;
}

function hasPlural(localization: XcstringsLocalization | undefined): boolean {
  return Boolean(localization?.variations?.plural);
}

function toVariants(localization: XcstringsLocalization): TranslationVariant[] {
  if (localization.stringUnit) {
    return [
      {
        value: localization.stringUnit.value,
        state: toState(localization.stringUnit.state),
      },
    ];
  }
  if (localization.variations?.plural) {
    const variants: TranslationVariant[] = [];
    for (const [category, entry] of Object.entries(localization.variations.plural)) {
      if (!entry) continue;
      variants.push({
        pluralCategory: category as PluralCategory,
        value: entry.stringUnit.value,
        state: toState(entry.stringUnit.state),
      });
    }
    return variants;
  }
  return [{ value: null, state: "new" }];
}

function toState(raw: XcstringsStringUnit["state"]): TranslationState {
  switch (raw) {
    case "translated":
      return "translated";
    case "needs_review":
      return "needs-review";
    case "stale":
      return "stale";
    case "new":
    default:
      return "new";
  }
}
