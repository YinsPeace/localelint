/**
 * iOS .lproj directory walker.
 *
 * Discovers <locale>.lproj/ folders under a given directory and merges
 * Localizable.strings + Localizable.stringsdict files into a single
 * multi-locale LocalizationAST.
 *
 * Source locale convention: "en" (Apple's default). Caller can override
 * via the second argument.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { emptyAST, type LocalizationAST, type TranslationUnit } from "../ast.js";
import { parseStrings } from "./strings.js";
import { parseStringsdict } from "./stringsdict.js";

export async function parseLproj(
  dirPath: string,
  sourceLocale = "en",
): Promise<LocalizationAST> {
  const ast = emptyAST(sourceLocale, "ios-lproj");
  ast.metadata.formats = ["ios-lproj", "ios-strings", "ios-stringsdict"];

  const entries = await readdir(dirPath);
  const unitsByKey = new Map<string, TranslationUnit>();

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const s = await stat(fullPath);
    if (!s.isDirectory()) continue;
    const match = entry.match(/^(.+)\.lproj$/);
    if (!match) continue;
    const locale = match[1]!;

    const stringsPath = join(fullPath, "Localizable.strings");
    const stringsdictPath = join(fullPath, "Localizable.stringsdict");

    if (existsSync(stringsPath)) {
      const localeAST = await parseStrings(stringsPath, locale);
      for (const unit of localeAST.units) {
        mergeStringsUnit(unitsByKey, unit, locale, sourceLocale);
      }
      ast.targetLocales.add(locale);
    }

    if (existsSync(stringsdictPath)) {
      const localeAST = await parseStringsdict(stringsdictPath, locale);
      for (const unit of localeAST.units) {
        mergeStringsdictUnit(unitsByKey, unit, locale, sourceLocale);
      }
      ast.targetLocales.add(locale);
    }
  }

  ast.units = [...unitsByKey.values()];
  ast.metadata.unitCount = ast.units.length;
  ast.targetLocales.delete(sourceLocale);
  return ast;
}

function mergeStringsUnit(
  unitsByKey: Map<string, TranslationUnit>,
  incoming: TranslationUnit,
  locale: string,
  sourceLocale: string,
): void {
  let unit = unitsByKey.get(incoming.key);
  if (!unit) {
    unit = {
      key: incoming.key,
      source: locale === sourceLocale ? incoming.source : "",
      sourceLocale,
      placeholders: incoming.placeholders,
      notes: incoming.notes,
      isPlural: false,
      targets: new Map(),
      origin: { format: "ios-lproj", filePath: incoming.origin.filePath },
    };
    unitsByKey.set(incoming.key, unit);
  }
  if (locale === sourceLocale) {
    unit.source = incoming.source;
    unit.placeholders = incoming.placeholders;
    if (incoming.notes.length > 0) unit.notes = incoming.notes;
  }
  const localeData = incoming.targets.get(locale);
  if (localeData) {
    unit.targets.set(locale, localeData);
  }
}

function mergeStringsdictUnit(
  unitsByKey: Map<string, TranslationUnit>,
  incoming: TranslationUnit,
  locale: string,
  sourceLocale: string,
): void {
  let unit = unitsByKey.get(incoming.key);
  if (!unit) {
    unit = {
      key: incoming.key,
      source: locale === sourceLocale ? incoming.source : "",
      sourceLocale,
      placeholders: incoming.placeholders,
      notes: [],
      isPlural: true,
      targets: new Map(),
      origin: { format: "ios-lproj", filePath: incoming.origin.filePath },
    };
    unitsByKey.set(incoming.key, unit);
  }
  unit.isPlural = true;
  if (locale === sourceLocale && incoming.source) {
    unit.source = incoming.source;
    unit.placeholders = incoming.placeholders;
  }
  const localeData = incoming.targets.get(locale);
  if (localeData) {
    unit.targets.set(locale, localeData);
  }
}
