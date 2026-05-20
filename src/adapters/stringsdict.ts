/**
 * iOS .stringsdict parser.
 *
 * Apple's legacy plural localization format. plist XML containing
 * top-level dict keyed by translation key; each entry is a nested dict
 * with NSStringLocalizedFormatKey + a sub-dict containing plural rules.
 *
 * One file per locale; caller supplies the locale. Becomes both
 * sourceLocale and the single target.
 */

import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import {
  emptyAST,
  type LocalizationAST,
  type PluralCategory,
  type TranslationUnit,
  type TranslationVariant,
} from "../ast.js";
import { detectPlaceholders } from "../validators/placeholders.js";

const PLURAL_CATEGORIES: PluralCategory[] = ["zero", "one", "two", "few", "many", "other"];

export async function parseStringsdict(filePath: string, locale: string): Promise<LocalizationAST> {
  const xml = await readFile(filePath, "utf8");
  return parseStringsdictString(xml, locale, filePath);
}

export function parseStringsdictString(
  xml: string,
  locale: string,
  filePath?: string,
): LocalizationAST {
  const parser = new XMLParser({
    ignoreAttributes: true,
    preserveOrder: true,
    trimValues: false,
  });

  const parsed = parser.parse(xml) as Array<Record<string, unknown>>;
  const ast = emptyAST(locale, "ios-stringsdict");

  const rootDict = findRootDict(parsed);
  if (!rootDict) return ast;

  const topLevelEntries = parsePlistDict(rootDict);

  for (const [key, value] of topLevelEntries) {
    if (!isDict(value)) continue;
    const entries = parsePlistDict(value);
    const subDictKey = findFormatVariableName(entries);
    if (!subDictKey) continue;

    const pluralDict = entries.find(([k]) => k === subDictKey)?.[1];
    if (!isDict(pluralDict)) continue;

    const pluralEntries = parsePlistDict(pluralDict);
    const variants: TranslationVariant[] = [];

    for (const [cat, val] of pluralEntries) {
      if (typeof val !== "string") continue;
      if (!PLURAL_CATEGORIES.includes(cat as PluralCategory)) continue;
      variants.push({
        pluralCategory: cat as PluralCategory,
        value: val,
        state: "translated",
      });
    }

    if (variants.length === 0) continue;

    const sourceForPlaceholders = variants.find((v) => v.pluralCategory === "other")?.value ?? variants[0]!.value!;
    const unit: TranslationUnit = {
      key,
      source: sourceForPlaceholders,
      sourceLocale: locale,
      placeholders: detectPlaceholders(sourceForPlaceholders),
      notes: [],
      isPlural: true,
      targets: new Map([[locale, { locale, variants }]]),
      origin: { format: "ios-stringsdict", filePath },
    };
    ast.units.push(unit);
    ast.targetLocales.add(locale);
  }

  ast.metadata.unitCount = ast.units.length;
  return ast;
}

function findRootDict(parsed: Array<Record<string, unknown>>): unknown {
  for (const node of parsed) {
    if ("plist" in node) {
      const plistArr = node.plist as Array<Record<string, unknown>>;
      for (const child of plistArr) {
        if ("dict" in child) return child.dict;
      }
    }
  }
  return null;
}

function isDict(node: unknown): boolean {
  return Array.isArray(node);
}

function parsePlistDict(dictNode: unknown): Array<[string, unknown]> {
  if (!Array.isArray(dictNode)) return [];
  const entries: Array<[string, unknown]> = [];
  let pendingKey: string | null = null;
  for (const item of dictNode) {
    if (!item || typeof item !== "object") continue;
    const keys = Object.keys(item);
    if (keys.includes("key")) {
      const keyVal = (item as { key: unknown }).key;
      if (Array.isArray(keyVal) && keyVal.length > 0) {
        const first = keyVal[0];
        if (first && typeof first === "object" && "#text" in first) {
          pendingKey = String((first as { "#text": unknown })["#text"]);
        }
      }
      continue;
    }
    if (pendingKey === null) continue;
    if (keys.includes("string")) {
      const strVal = (item as { string: unknown }).string;
      if (Array.isArray(strVal) && strVal.length > 0) {
        const first = strVal[0];
        if (first && typeof first === "object" && "#text" in first) {
          entries.push([pendingKey, String((first as { "#text": unknown })["#text"])]);
        } else {
          entries.push([pendingKey, ""]);
        }
      } else {
        entries.push([pendingKey, ""]);
      }
      pendingKey = null;
    } else if (keys.includes("dict")) {
      entries.push([pendingKey, (item as { dict: unknown }).dict]);
      pendingKey = null;
    }
  }
  return entries;
}

function findFormatVariableName(entries: Array<[string, unknown]>): string | null {
  // NSStringLocalizedFormatKey looks like "%#@count@" -- the variable name is "count"
  const formatEntry = entries.find(([k]) => k === "NSStringLocalizedFormatKey");
  if (!formatEntry) return null;
  const formatStr = formatEntry[1];
  if (typeof formatStr !== "string") return null;
  const match = formatStr.match(/%#@(\w+)@/);
  return match ? (match[1] ?? null) : null;
}
