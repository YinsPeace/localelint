/**
 * Placeholder detection.
 *
 * Scans a string for printf-style format specifiers (`%@`, `%d`, `%1$@`),
 * ICU message-format placeholders (`{name}`, `{count, plural, ...}`), and
 * named token patterns.
 *
 * Phase A scope: printf + named ICU. Defer full ICU MessageFormat parsing
 * until validators need it (Phase B `check` work).
 */

import type { Placeholder, PlaceholderType } from "../ast.js";

// printf format: %[positional$][flags][width][.precision][length]<conversion>
// length modifiers (hh, ll must come before h, l in alternation due to longest-match):
const PRINTF_REGEX = /%(?:(\d+)\$)?[+-]?\d*\.?\d*(?:hh|ll|h|l|q|j|z|t|L)?[@dDiouxXeEfFgGsScCaA]/g;
const ICU_NAMED_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function detectPlaceholders(source: string): Placeholder[] {
  const found: Placeholder[] = [];

  for (const match of source.matchAll(PRINTF_REGEX)) {
    if (match.index === undefined) continue;
    const token = match[0];
    const positional = match[1];
    found.push({
      token,
      offset: match.index,
      type: (positional ? "positional" : "printf") as PlaceholderType,
      positionalIndex: positional ? Number.parseInt(positional, 10) : undefined,
    });
  }

  for (const match of source.matchAll(ICU_NAMED_REGEX)) {
    if (match.index === undefined) continue;
    found.push({
      token: match[0],
      offset: match.index,
      type: "named",
    });
  }

  return found.sort((a, b) => a.offset - b.offset);
}

/**
 * Compare placeholders in source vs target. Returns a list of mismatches.
 *
 * Mismatch criteria:
 * - target is missing a token present in source
 * - target has a token not present in source (extra)
 * - positional token indices differ between source and target
 */
export function comparePlaceholders(
  sourcePlaceholders: Placeholder[],
  targetPlaceholders: Placeholder[],
): PlaceholderMismatch[] {
  const mismatches: PlaceholderMismatch[] = [];

  const sourceTokens = new Map<string, number>();
  for (const p of sourcePlaceholders) {
    sourceTokens.set(p.token, (sourceTokens.get(p.token) ?? 0) + 1);
  }

  const targetTokens = new Map<string, number>();
  for (const p of targetPlaceholders) {
    targetTokens.set(p.token, (targetTokens.get(p.token) ?? 0) + 1);
  }

  for (const [token, sourceCount] of sourceTokens) {
    const targetCount = targetTokens.get(token) ?? 0;
    if (targetCount < sourceCount) {
      mismatches.push({
        kind: "missing",
        token,
        sourceCount,
        targetCount,
      });
    }
  }

  for (const [token, targetCount] of targetTokens) {
    if (!sourceTokens.has(token)) {
      mismatches.push({
        kind: "extra",
        token,
        sourceCount: 0,
        targetCount,
      });
    }
  }

  return mismatches;
}

export interface PlaceholderMismatch {
  kind: "missing" | "extra";
  token: string;
  sourceCount: number;
  targetCount: number;
}
