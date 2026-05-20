/**
 * iOS XLIFF (1.2) adapter.
 *
 * Parses Xcode-exported XLIFF files into a LocalizationAST.
 *
 * Phase A scope: parse `<trans-unit>` elements, source/target text, state
 * attribute, developer notes. Defer plural variants and exotic dialect
 * quirks until real samples reveal them.
 */

import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import {
  emptyAST,
  type LocalizationAST,
  type Note,
  type TranslationState,
  type TranslationUnit,
} from "../ast.js";
import { detectPlaceholders } from "../validators/placeholders.js";

interface RawTransUnit {
  "@_id": string;
  "@_xml:space"?: string;
  source: string | { "#text": string };
  target?: string | { "#text": string; "@_state"?: string };
  note?: string | string[] | { "#text": string; "@_from"?: string } | Array<{ "#text": string; "@_from"?: string }>;
}

interface RawFile {
  "@_source-language": string;
  "@_target-language"?: string;
  "@_original": string;
  body?: { "trans-unit"?: RawTransUnit | RawTransUnit[] };
}

interface RawXliff {
  xliff?: {
    file?: RawFile | RawFile[];
  };
}

export async function parseXliff(filePath: string): Promise<LocalizationAST> {
  const xml = await readFile(filePath, "utf8");
  return parseXliffString(xml, filePath);
}

export function parseXliffString(xml: string, filePath?: string): LocalizationAST {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseAttributeValue: false,
    trimValues: false,
    isArray: (name) => name === "trans-unit" || name === "file" || name === "note",
  });

  const raw = parser.parse(xml) as RawXliff;
  const files = raw.xliff?.file;
  if (!files) {
    throw new Error(`no <file> elements in ${filePath ?? "input"}`);
  }

  const fileArray = Array.isArray(files) ? files : [files];
  const sourceLocale = fileArray[0]?.["@_source-language"] ?? "en";
  const ast = emptyAST(sourceLocale, "ios-xliff");

  const unitsByKey = new Map<string, TranslationUnit>();

  for (const file of fileArray) {
    const targetLocale = file["@_target-language"];
    const transUnits = file.body?.["trans-unit"];
    if (!transUnits) continue;

    const unitArray = Array.isArray(transUnits) ? transUnits : [transUnits];

    for (const tu of unitArray) {
      const key = tu["@_id"];
      const source = extractText(tu.source);
      const targetRaw = tu.target;
      const targetValue = targetRaw ? extractText(targetRaw) : null;
      const state = extractState(targetRaw);

      let unit = unitsByKey.get(key);
      if (!unit) {
        unit = {
          key,
          source,
          sourceLocale,
          placeholders: detectPlaceholders(source),
          notes: extractNotes(tu.note),
          isPlural: false,
          targets: new Map(),
          origin: { format: "ios-xliff", filePath },
        };
        unitsByKey.set(key, unit);
        ast.units.push(unit);
      }

      if (targetLocale && (targetValue !== null || state)) {
        unit.targets.set(targetLocale, {
          locale: targetLocale,
          variants: [
            {
              value: targetValue,
              state: state ?? (targetValue ? "translated" : "needs-translation"),
            },
          ],
        });
        ast.targetLocales.add(targetLocale);
      }
    }
  }

  ast.metadata.unitCount = ast.units.length;
  return ast;
}

function extractText(node: string | { "#text": string } | undefined): string {
  if (node === undefined) return "";
  if (typeof node === "string") return node;
  return node["#text"] ?? "";
}

function extractState(target: RawTransUnit["target"]): TranslationState | null {
  if (!target || typeof target === "string") return null;
  const raw = target["@_state"];
  if (!raw) return null;
  switch (raw) {
    case "new":
      return "new";
    case "needs-translation":
    case "needs-l10n":
      return "needs-translation";
    case "needs-review-translation":
    case "needs-review-l10n":
    case "needs-review":
      return "needs-review";
    case "translated":
    case "final":
    case "signed-off":
      return "translated";
    default:
      return null;
  }
}

function extractNotes(raw: RawTransUnit["note"]): Note[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((entry) => {
    if (typeof entry === "string") {
      return { from: "developer" as const, content: entry };
    }
    const from = entry["@_from"];
    return {
      from: from === "translator" ? ("translator" as const) : ("developer" as const),
      content: entry["#text"] ?? "",
    };
  });
}
