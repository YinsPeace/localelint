/**
 * Validator findings.
 *
 * Each finding represents one issue detected by a validator. The runner
 * aggregates findings across all validators. The CLI prints them, the
 * GitHub Action turns them into PR comments.
 */

export type Severity = "error" | "warning" | "info";

export type FindingKind =
  | "missing-target"
  | "empty-target"
  | "placeholder-missing"
  | "placeholder-extra"
  | "plural-missing-category"
  | "plural-extra-category"
  | "needs-translation"
  | "needs-review";

export interface Finding {
  /** Translation unit key this finding is about. */
  key: string;
  /** Target locale this finding is about. "*" for source-level issues. */
  locale: string;
  /** What kind of issue. */
  kind: FindingKind;
  /** How serious it is. */
  severity: Severity;
  /** Human-readable description. */
  message: string;
  /** Optional plural category if the finding is plural-specific. */
  pluralCategory?: string;
}
