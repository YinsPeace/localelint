# Samples

Real-world and synthesized localization files for the Phase A feasibility spike.

## Real files (Wikipedia iOS, public domain license)

Pulled 2026-05-19 from `github.com/wikimedia/wikipedia-ios` (CC0 / MIT). Wikipedia iOS uses the legacy format (`.strings` + `.stringsdict`) and has 300+ locales, large body of real-world strings.

| File | Format | Size | What it demonstrates |
|---|---|---|---|
| `wikipedia-en.strings` | iOS `.strings` (source locale) | 130 KB | Real-world key density, escape sequences, comments, format specifiers |
| `wikipedia-en.stringsdict` | iOS `.stringsdict` (plurals, source) | 1 KB | English 2-category plurals (one + other) |
| `wikipedia-pl.strings` | iOS `.strings` (target locale) | 70 KB | Polish translations including escape sequences and special characters |
| `wikipedia-pl.stringsdict` | iOS `.stringsdict` (plurals, target) | 1 KB | Polish 4-category plurals (one + few + many + other) |

Source upstream paths:
- `Wikipedia/Localizations/en.lproj/Localizable.strings`
- `Wikipedia/Localizations/en.lproj/Localizable.stringsdict`
- `Wikipedia/Localizations/pl.lproj/Localizable.strings`
- `Wikipedia/Localizations/pl.lproj/Localizable.stringsdict`

## Synthesized files

Real-world `.xcstrings` and `.xliff` files are scarce in public repos because they are build/handoff artifacts, not source-controlled. Synthesized below to exercise the format edge cases the parser needs to handle. Modeled accurately on Apple's documented format and Xcode's actual export output. Replace with real samples from your own Xcode projects when you have access.

| File | Format | What it demonstrates |
|---|---|---|
| `booknook.xcstrings` | Xcode 15 String Catalog | Multiple locales (en, de, fr, pl, ja, ar), plural variants with category coverage differences (en: 2, pl: 4, ar: 6), state values (translated, needs_review, new with empty value), variable interpolation (`%@`, `%d`, `%lld`, positional `%1$@`/`%2$@`), comments, partial locale coverage per key |
| `booknook-de.xliff` | Xcode-exported XLIFF 1.2 (German target) | Standard Xcode tool header, trans-units with source + target + state + developer notes, format specifiers preserved, mix of `translated` / `needs-translation` / `new` states, empty targets |

The `booknook` app is a fictional iOS book reading app. Strings cover UI labels, action buttons, plural counts, error dialogs, and interpolated text.

## Phase A spike checklist

The parser should round-trip these files without errors:

- [ ] `npm run dev -- check samples/booknook.xcstrings` returns unit count > 0, lists target locales (de, fr, pl, ja, ar)
- [ ] `npm run dev -- check samples/booknook-de.xliff` returns unit count > 0, target locale "de"
- [ ] No crashes on any of the Wikipedia `.strings` files (parser may not yet support `.strings` natively, but reading raw bytes should not throw)

## Replacing synthesized samples

When you have macOS access:

1. Open any iOS Xcode project with multilingual support
2. Run `xcodebuild -exportLocalizations -localizationPath ./exports -project YourApp.xcodeproj`
3. Drop the resulting `.xcloc` package (which contains XLIFF) into `samples/private/` (gitignored)
4. Copy any `Localizable.xcstrings` file from the Xcode project into `samples/private/`
5. Run the parser against the real files to surface dialect quirks the synthesized samples may have missed
