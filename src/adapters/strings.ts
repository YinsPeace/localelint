/**
 * iOS .strings parser.
 *
 * Apple's legacy localization file format. UTF-8 text, "key" = "value";
 * syntax with C-style comments. We parse via a small hand-written
 * tokenizer rather than regex to handle escape sequences correctly.
 *
 * Single-file-per-locale: the caller supplies the locale. The locale
 * becomes both sourceLocale AND a target (the file IS the translation
 * for that locale).
 */

import { readFile } from "node:fs/promises";
import { emptyAST, type LocalizationAST, type TranslationUnit } from "../ast.js";
import { detectPlaceholders } from "../validators/placeholders.js";

export async function parseStrings(filePath: string, locale: string): Promise<LocalizationAST> {
  const text = await readFile(filePath, "utf8");
  return parseStringsString(text, locale, filePath);
}

interface Entry {
  key: string;
  value: string;
  comment?: string;
}

export function parseStringsString(text: string, locale: string, filePath?: string): LocalizationAST {
  const entries = tokenize(text);
  const ast = emptyAST(locale, "ios-strings");

  for (const entry of entries) {
    const unit: TranslationUnit = {
      key: entry.key,
      source: entry.value,
      sourceLocale: locale,
      placeholders: detectPlaceholders(entry.value),
      notes: entry.comment ? [{ from: "developer", content: entry.comment }] : [],
      isPlural: false,
      targets: new Map([
        [
          locale,
          {
            locale,
            variants: [{ value: entry.value, state: "translated" }],
          },
        ],
      ]),
      origin: { format: "ios-strings", filePath },
    };
    ast.units.push(unit);
    ast.targetLocales.add(locale);
  }

  ast.metadata.unitCount = ast.units.length;
  return ast;
}

function tokenize(text: string): Entry[] {
  const entries: Entry[] = [];
  let pos = 0;
  let pendingComment: string | undefined;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);
    if (pos >= text.length) break;

    if (text.startsWith("/*", pos)) {
      const end = text.indexOf("*/", pos + 2);
      if (end === -1) throw new Error("unterminated /* comment");
      pendingComment = text.slice(pos + 2, end).trim();
      pos = end + 2;
      continue;
    }

    if (text.startsWith("//", pos)) {
      const eol = text.indexOf("\n", pos);
      pendingComment = text.slice(pos + 2, eol === -1 ? text.length : eol).trim();
      pos = eol === -1 ? text.length : eol + 1;
      continue;
    }

    if (text[pos] !== '"') {
      throw new Error(`expected " at position ${pos}, got "${text[pos]}"`);
    }

    const keyResult = readQuoted(text, pos);
    pos = skipWhitespace(text, keyResult.end);
    if (text[pos] !== "=") throw new Error(`expected = after key, position ${pos}`);
    pos = skipWhitespace(text, pos + 1);
    if (text[pos] !== '"') throw new Error(`expected " for value, position ${pos}`);

    const valueResult = readQuoted(text, pos);
    pos = skipWhitespace(text, valueResult.end);
    if (text[pos] !== ";") throw new Error(`expected ; after value, position ${pos}`);
    pos++;

    entries.push({
      key: keyResult.value,
      value: valueResult.value,
      comment: pendingComment,
    });
    pendingComment = undefined;
  }

  return entries;
}

function skipWhitespace(text: string, pos: number): number {
  while (pos < text.length && /\s/.test(text[pos]!)) pos++;
  return pos;
}

function readQuoted(text: string, start: number): { value: string; end: number } {
  if (text[start] !== '"') throw new Error(`expected opening quote at ${start}`);
  let pos = start + 1;
  let result = "";
  while (pos < text.length) {
    const ch = text[pos]!;
    if (ch === "\\") {
      const next = text[pos + 1];
      if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else if (next === "r") result += "\r";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else if (next === "/") result += "/";
      else result += next ?? "";
      pos += 2;
      continue;
    }
    if (ch === '"') {
      return { value: result, end: pos + 1 };
    }
    result += ch;
    pos++;
  }
  throw new Error("unterminated string literal");
}
