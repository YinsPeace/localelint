# fixture-ios

A minimal SwiftUI app used as a real Xcode fixture for LocaleLint's verification workflows. The Xcode project itself is generated from `project.yml` via [xcodegen](https://github.com/yonaskolb/XcodeGen) on macOS, so the repo only holds the spec and source files (no `.xcodeproj` directory).

## What this exists for

LocaleLint's tests use synthetic samples. To verify Apple-emitted XLIFF + `.xcstrings` behavior in the real world (state value strings, XLIFF version, `<note from>` attribute, plural representation), this fixture is built and exported on a GitHub Actions `macos-latest` runner. The resulting `.xcloc` bundles are uploaded as workflow artifacts.

## Locally (on macOS)

```
brew install xcodegen
cd samples/fixture-ios
xcodegen generate
open Fixture.xcodeproj
```

## What it contains

- One iOS app target ("Fixture") targeting iOS 17+
- `Localizable.xcstrings` with 5 keys across 6 locales (en, de, fr, ja, pl, plus partial Arabic later) exercising:
  - Singular strings
  - Plural variants (English 2-cat, Polish 4-cat, Japanese single form)
  - Variable interpolation (`%@`, `%lld`)
  - Positional placeholders (`%1$@`, `%2$@`)
  - Comments
  - Mixed states (translated, needs_review, new with empty value)

## Triggering the workflow

The GitHub Actions workflow `generate-ios-samples.yml` runs on `workflow_dispatch`. To trigger:

```
gh workflow run "Generate iOS Localization Samples"
```

When it completes, download the artifacts from the Actions run page. They include `Fixture.xcodeproj.zip` (the generated project) and `exports/` (the `.xcloc` bundles per locale).
