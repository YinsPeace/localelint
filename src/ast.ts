/**
 * Generic localization AST.
 *
 * Format-agnostic representation of localization resources. All parsers
 * (iOS XLIFF, Xcode .xcstrings, Angular XLIFF, etc.) produce this shape;
 * all validators operate on it. v2+ formats add adapters without touching
 * the validators.
 */

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export type TranslationState =
  | "new"
  | "needs-translation"
  | "needs-review"
  | "translated"
  | "stale";

export type SourceFormat =
  | "ios-xliff"
  | "xcstrings"
  | "angular-xliff"
  | "android-xml"
  | "flutter-arb"
  | "json-i18n"
  | "unknown";

export type PlaceholderType = "printf" | "icu" | "positional" | "named";

export interface Placeholder {
  /** The raw token as it appears in the source (e.g. "%@", "%1$d", "{count}"). */
  token: string;
  /** Character offset where the token starts in the containing string. */
  offset: number;
  /** Format-specifier style. */
  type: PlaceholderType;
  /** Argument index for positional tokens (e.g. 2 in "%2$@"). Undefined for non-positional. */
  positionalIndex?: number;
}

export interface Note {
  /** Who attributed this note. */
  from: "developer" | "translator" | "tool";
  /** Note content. */
  content: string;
}

export interface TranslationVariant {
  /** Plural category if this variant is plural-keyed. Undefined for non-plural strings. */
  pluralCategory?: PluralCategory;
  /** Target string. Null means absent (no target supplied by translator yet). Empty string is a deliberate empty translation and is distinct from null. */
  value: string | null;
  /** State of this variant. */
  state: TranslationState;
}

export interface TranslationTarget {
  /** Locale code (BCP 47), e.g. "de", "fr", "ja", "zh-Hans", "pt-BR". */
  locale: string;
  /** Variants of this translation. For non-plural strings, exactly one entry with no pluralCategory. For plural strings, one entry per active CLDR plural category. */
  variants: TranslationVariant[];
}

export interface OriginMetadata {
  /** Source format this unit was parsed from. */
  format: SourceFormat;
  /** Original file path. Undefined for synthesized units. */
  filePath?: string;
  /** Line number in the source file (if applicable). */
  line?: number;
}

export interface TranslationUnit {
  /** Stable key identifying this string across locales. */
  key: string;
  /** Source string text. */
  source: string;
  /** Source locale (typically "en"). */
  sourceLocale: string;
  /** Placeholders detected in source. */
  placeholders: Placeholder[];
  /** Notes attached to this unit (translator context, developer comments). */
  notes: Note[];
  /** Whether this unit uses plural variants (declared in source). */
  isPlural: boolean;
  /** Target translations keyed by locale code. */
  targets: Map<string, TranslationTarget>;
  /** Metadata about where this unit came from. */
  origin: OriginMetadata;
}

export interface LocalizationAST {
  /** All translation units in this resource. */
  units: TranslationUnit[];
  /** All locales referenced by any unit's targets. Does NOT include sourceLocale. */
  targetLocales: Set<string>;
  /** Source locale (typically "en"). */
  sourceLocale: string;
  /** Resource-level metadata. */
  metadata: {
    /** Source format(s) this AST was built from. May be multiple if merged across files. */
    formats: SourceFormat[];
    /** Total unit count. */
    unitCount: number;
    /** Build timestamp. */
    parsedAt: Date;
  };
}

/**
 * Helper: construct an empty AST shell. Adapters populate it.
 */
export function emptyAST(sourceLocale: string, format: SourceFormat): LocalizationAST {
  return {
    units: [],
    targetLocales: new Set<string>(),
    sourceLocale,
    metadata: {
      formats: [format],
      unitCount: 0,
      parsedAt: new Date(),
    },
  };
}
