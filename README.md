# LocaleLint

Localization CI for iOS apps. Validates XLIFF and Xcode String Catalog (`.xcstrings`) files for missing translations, placeholder mismatches, broken ICU plurals, and CLDR plural-category coverage.

## Status

Available. CLI and GitHub Action published; v0.2.1 is live on the [GitHub Marketplace](https://github.com/marketplace/actions/localelint).

## Validators in v1

- **missing-target** — keys without a translation for a target locale (warning) or empty target with the wrong state (error).
- **needs-translation** — empty targets explicitly waiting for translator action (warning).
- **needs-review** — translator flagged the target for review (info).
- **placeholder-missing / placeholder-extra** — format-specifier count mismatch between source and target (error). Catches Arabic plural variants that drop `%d`, German targets missing `%@`, positional token mismatches.
- **plural-missing-category / plural-extra-category** — CLDR-required plural categories absent from a target locale's variants (error), or unexpected categories present (warning). Polish needs `one + few + many + other`; Arabic needs all six. Japanese single-stringUnit-as-plural is accepted.

## CLI usage

```bash
npm install
npm run build
npm install -g .
localelint check path/to/Localizable.xcstrings
localelint check path/to/de.xliff --json
```

Exit codes:

- `0` no errors
- `1` one or more error-severity findings
- `2` invalid usage

## GitHub Action usage

```yaml
name: Localization CI
on:
  pull_request:
    paths:
      - "**/*.xcstrings"
      - "**/*.xliff"
      - "**/*.xlf"

jobs:
  localelint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: YinsPeace/localelint@v0
        with:
          files: |
            BookNook/Localizable.xcstrings
            BookNook/Localizations/de.xliff
          fail-on-warning: false
          post-comment: true
```

Inputs:

- `files` (required): newline or comma separated paths to `.xliff`, `.xlf`, or `.xcstrings` files.
- `mode` (default `check`): either `check` (validates one or more files) or `migrate` (compares an lproj directory against an .xcstrings catalog).
- `lproj-dir` (required in `migrate` mode): path to the legacy `.lproj` directory tree.
- `fail-on-warning` (default `false`): fail the action on warnings, not just errors.
- `post-comment` (default `true`): post findings as a single PR comment, updated on each push.
- `github-token` (default `${{ github.token }}`): used to post comments.

Outputs:

- `errors`, `warnings`, `info`: counts.

### Migrate mode

```yaml
- uses: YinsPeace/localelint@v0
  with:
    mode: migrate
    lproj-dir: MyApp/Localizations
    files: MyApp/Localizable.xcstrings
    fail-on-warning: false
```

Migrate mode validates that Xcode's auto-migration from legacy `.strings` + `.stringsdict` to a String Catalog did not silently lose translations, plural categories, comments, or corrupt placeholders.

## Project structure

```
localelint/
├── src/
│   ├── ast.ts                          # Generic LocalizationAST data model
│   ├── index.ts                        # CLI entrypoint
│   ├── adapters/
│   │   ├── xliff.ts                    # iOS XLIFF 1.2 parser
│   │   └── xcstrings.ts                # Xcode String Catalog parser
│   └── validators/
│       ├── findings.ts                 # Finding interface + Severity + Kind enums
│       ├── runChecks.ts                # Orchestrator
│       ├── missing-target.ts           # Missing or empty translations
│       ├── placeholder-mismatch.ts     # Format specifier validation
│       ├── placeholders.ts             # Token detection + comparison
│       └── plural-coverage.ts          # CLDR plural category coverage
├── action/
│   ├── main.ts                         # GitHub Action entrypoint
│   └── dist/index.js                   # Bundled action (committed for GHA)
├── samples/                            # Real-world + synthetic test fixtures
├── tests/                              # Vitest specs (55+ tests)
├── action.yml                          # GitHub Action metadata
├── package.json
└── tsconfig.json
```

## Architecture

AST-first. Parser adapters convert any format to a generic `LocalizationAST`. Validators operate on the AST without knowing about XLIFF or `.xcstrings` specifically. v2+ formats (Android `strings.xml`, Flutter `.arb`, Angular XLIFF, JSON i18n) plug in as additional adapters without touching the validators.

## Development

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run build         # tsc compile to dist/
npm run build:action  # ncc bundle action to action/dist/index.js
npm run build:all     # both
```

## License

UNLICENSED for now. Will become closed-source-free at MVP, with hosted dashboard as paid tier.
