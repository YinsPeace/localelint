/**
 * Validator orchestrator.
 *
 * Runs all configured validators against the AST and returns aggregated
 * findings. Order is deterministic so tests can assert specific shapes.
 */

import type { LocalizationAST } from "../ast.js";
import type { Finding } from "./findings.js";
import { checkMissingTargets } from "./missing-target.js";
import { checkPlaceholderMismatches } from "./placeholder-mismatch.js";
import { checkPluralCoverage } from "./plural-coverage.js";

export function runChecks(ast: LocalizationAST): Finding[] {
  return [
    ...checkMissingTargets(ast),
    ...checkPlaceholderMismatches(ast),
    ...checkPluralCoverage(ast),
  ];
}
