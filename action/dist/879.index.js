export const id = 879;
export const ids = [879];
export const modules = {

/***/ 5879:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  runMigrate: () => (/* binding */ runMigrate)
});

// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(1455);
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(6760);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(3024);
// EXTERNAL MODULE: ./src/ast.ts
var src_ast = __webpack_require__(2631);
// EXTERNAL MODULE: ./src/validators/placeholders.ts
var placeholders = __webpack_require__(9861);
;// CONCATENATED MODULE: ./src/adapters/strings.ts
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



async function parseStrings(filePath, locale) {
    const text = await (0,promises_.readFile)(filePath, "utf8");
    return parseStringsString(text, locale, filePath);
}
function parseStringsString(text, locale, filePath) {
    const entries = tokenize(text);
    const ast = (0,src_ast/* emptyAST */.A)(locale, "ios-strings");
    for (const entry of entries) {
        const unit = {
            key: entry.key,
            source: entry.value,
            sourceLocale: locale,
            placeholders: (0,placeholders/* detectPlaceholders */.y)(entry.value),
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
function tokenize(text) {
    const entries = [];
    let pos = 0;
    let pendingComment;
    while (pos < text.length) {
        pos = skipWhitespace(text, pos);
        if (pos >= text.length)
            break;
        if (text.startsWith("/*", pos)) {
            const end = text.indexOf("*/", pos + 2);
            if (end === -1)
                throw new Error("unterminated /* comment");
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
        if (text[pos] !== "=")
            throw new Error(`expected = after key, position ${pos}`);
        pos = skipWhitespace(text, pos + 1);
        if (text[pos] !== '"')
            throw new Error(`expected " for value, position ${pos}`);
        const valueResult = readQuoted(text, pos);
        pos = skipWhitespace(text, valueResult.end);
        if (text[pos] !== ";")
            throw new Error(`expected ; after value, position ${pos}`);
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
function skipWhitespace(text, pos) {
    while (pos < text.length && /\s/.test(text[pos]))
        pos++;
    return pos;
}
function readQuoted(text, start) {
    if (text[start] !== '"')
        throw new Error(`expected opening quote at ${start}`);
    let pos = start + 1;
    let result = "";
    while (pos < text.length) {
        const ch = text[pos];
        if (ch === "\\") {
            const next = text[pos + 1];
            if (next === "n")
                result += "\n";
            else if (next === "t")
                result += "\t";
            else if (next === "r")
                result += "\r";
            else if (next === '"')
                result += '"';
            else if (next === "\\")
                result += "\\";
            else if (next === "/")
                result += "/";
            else
                result += next ?? "";
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

// EXTERNAL MODULE: ./node_modules/fast-xml-parser/src/fxp.js
var fxp = __webpack_require__(9741);
;// CONCATENATED MODULE: ./src/adapters/stringsdict.ts
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




const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
async function parseStringsdict(filePath, locale) {
    const xml = await (0,promises_.readFile)(filePath, "utf8");
    return parseStringsdictString(xml, locale, filePath);
}
function parseStringsdictString(xml, locale, filePath) {
    const parser = new fxp.XMLParser({
        ignoreAttributes: true,
        preserveOrder: true,
        trimValues: false,
    });
    const parsed = parser.parse(xml);
    const ast = (0,src_ast/* emptyAST */.A)(locale, "ios-stringsdict");
    const rootDict = findRootDict(parsed);
    if (!rootDict)
        return ast;
    const topLevelEntries = parsePlistDict(rootDict);
    for (const [key, value] of topLevelEntries) {
        if (!isDict(value))
            continue;
        const entries = parsePlistDict(value);
        const subDictKey = findFormatVariableName(entries);
        if (!subDictKey)
            continue;
        const pluralDict = entries.find(([k]) => k === subDictKey)?.[1];
        if (!isDict(pluralDict))
            continue;
        const pluralEntries = parsePlistDict(pluralDict);
        const variants = [];
        for (const [cat, val] of pluralEntries) {
            if (typeof val !== "string")
                continue;
            if (!PLURAL_CATEGORIES.includes(cat))
                continue;
            variants.push({
                pluralCategory: cat,
                value: val,
                state: "translated",
            });
        }
        if (variants.length === 0)
            continue;
        const sourceForPlaceholders = variants.find((v) => v.pluralCategory === "other")?.value ?? variants[0].value;
        const unit = {
            key,
            source: sourceForPlaceholders,
            sourceLocale: locale,
            placeholders: (0,placeholders/* detectPlaceholders */.y)(sourceForPlaceholders),
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
function findRootDict(parsed) {
    for (const node of parsed) {
        if ("plist" in node) {
            const plistArr = node.plist;
            for (const child of plistArr) {
                if ("dict" in child)
                    return child.dict;
            }
        }
    }
    return null;
}
function isDict(node) {
    return Array.isArray(node);
}
function parsePlistDict(dictNode) {
    if (!Array.isArray(dictNode))
        return [];
    const entries = [];
    let pendingKey = null;
    for (const item of dictNode) {
        if (!item || typeof item !== "object")
            continue;
        const keys = Object.keys(item);
        if (keys.includes("key")) {
            const keyVal = item.key;
            if (Array.isArray(keyVal) && keyVal.length > 0) {
                const first = keyVal[0];
                if (first && typeof first === "object" && "#text" in first) {
                    pendingKey = String(first["#text"]);
                }
            }
            continue;
        }
        if (pendingKey === null)
            continue;
        if (keys.includes("string")) {
            const strVal = item.string;
            if (Array.isArray(strVal) && strVal.length > 0) {
                const first = strVal[0];
                if (first && typeof first === "object" && "#text" in first) {
                    entries.push([pendingKey, String(first["#text"])]);
                }
                else {
                    entries.push([pendingKey, ""]);
                }
            }
            else {
                entries.push([pendingKey, ""]);
            }
            pendingKey = null;
        }
        else if (keys.includes("dict")) {
            entries.push([pendingKey, item.dict]);
            pendingKey = null;
        }
    }
    return entries;
}
function findFormatVariableName(entries) {
    // NSStringLocalizedFormatKey looks like "%#@count@" -- the variable name is "count"
    const formatEntry = entries.find(([k]) => k === "NSStringLocalizedFormatKey");
    if (!formatEntry)
        return null;
    const formatStr = formatEntry[1];
    if (typeof formatStr !== "string")
        return null;
    const match = formatStr.match(/%#@(\w+)@/);
    return match ? (match[1] ?? null) : null;
}

;// CONCATENATED MODULE: ./src/adapters/lproj.ts
/**
 * iOS .lproj directory walker.
 *
 * Discovers <locale>.lproj/ folders under a given directory and merges
 * Localizable.strings + Localizable.stringsdict files into a single
 * multi-locale LocalizationAST.
 *
 * Source locale convention: "en" (Apple's default). Caller can override
 * via the second argument.
 */






async function parseLproj(dirPath, sourceLocale = "en") {
    const ast = (0,src_ast/* emptyAST */.A)(sourceLocale, "ios-lproj");
    ast.metadata.formats = ["ios-lproj", "ios-strings", "ios-stringsdict"];
    const entries = await (0,promises_.readdir)(dirPath);
    const unitsByKey = new Map();
    for (const entry of entries) {
        const fullPath = (0,external_node_path_.join)(dirPath, entry);
        const s = await (0,promises_.stat)(fullPath);
        if (!s.isDirectory())
            continue;
        const match = entry.match(/^(.+)\.lproj$/);
        if (!match)
            continue;
        const locale = match[1];
        const stringsPath = (0,external_node_path_.join)(fullPath, "Localizable.strings");
        const stringsdictPath = (0,external_node_path_.join)(fullPath, "Localizable.stringsdict");
        if ((0,external_node_fs_.existsSync)(stringsPath)) {
            const localeAST = await parseStrings(stringsPath, locale);
            for (const unit of localeAST.units) {
                mergeStringsUnit(unitsByKey, unit, locale, sourceLocale);
            }
            ast.targetLocales.add(locale);
        }
        if ((0,external_node_fs_.existsSync)(stringsdictPath)) {
            const localeAST = await parseStringsdict(stringsdictPath, locale);
            for (const unit of localeAST.units) {
                mergeStringsdictUnit(unitsByKey, unit, locale, sourceLocale);
            }
            ast.targetLocales.add(locale);
        }
    }
    ast.units = [...unitsByKey.values()];
    ast.metadata.unitCount = ast.units.length;
    ast.targetLocales.delete(sourceLocale);
    return ast;
}
function mergeStringsUnit(unitsByKey, incoming, locale, sourceLocale) {
    let unit = unitsByKey.get(incoming.key);
    if (!unit) {
        unit = {
            key: incoming.key,
            source: locale === sourceLocale ? incoming.source : "",
            sourceLocale,
            placeholders: incoming.placeholders,
            notes: incoming.notes,
            isPlural: false,
            targets: new Map(),
            origin: { format: "ios-lproj", filePath: incoming.origin.filePath },
        };
        unitsByKey.set(incoming.key, unit);
    }
    if (locale === sourceLocale) {
        unit.source = incoming.source;
        unit.placeholders = incoming.placeholders;
        if (incoming.notes.length > 0)
            unit.notes = incoming.notes;
    }
    const localeData = incoming.targets.get(locale);
    if (localeData) {
        unit.targets.set(locale, localeData);
    }
}
function mergeStringsdictUnit(unitsByKey, incoming, locale, sourceLocale) {
    let unit = unitsByKey.get(incoming.key);
    if (!unit) {
        unit = {
            key: incoming.key,
            source: locale === sourceLocale ? incoming.source : "",
            sourceLocale,
            placeholders: incoming.placeholders,
            notes: [],
            isPlural: true,
            targets: new Map(),
            origin: { format: "ios-lproj", filePath: incoming.origin.filePath },
        };
        unitsByKey.set(incoming.key, unit);
    }
    unit.isPlural = true;
    if (locale === sourceLocale && incoming.source) {
        unit.source = incoming.source;
        unit.placeholders = incoming.placeholders;
    }
    const localeData = incoming.targets.get(locale);
    if (localeData) {
        unit.targets.set(locale, localeData);
    }
}

// EXTERNAL MODULE: ./src/adapters/xcstrings.ts
var xcstrings = __webpack_require__(5413);
;// CONCATENATED MODULE: ./src/validators/migrate-comparison.ts
/**
 * Migration comparison validator.
 *
 * Compares two ASTs:
 *   - legacy: built from a .lproj directory of .strings + .stringsdict files
 *   - catalog: parsed from a post-migration Localizable.xcstrings
 *
 * Detects translation/plural/comment/placeholder/key drift. Used by the
 * `localelint migrate` command to validate Xcode's auto-migration didn't
 * silently lose data.
 */

function compareMigration(legacy, catalog) {
    const findings = [];
    const legacyByKey = new Map(legacy.units.map((u) => [u.key, u]));
    const catalogByKey = new Map(catalog.units.map((u) => [u.key, u]));
    for (const [key, legacyUnit] of legacyByKey) {
        const catalogUnit = catalogByKey.get(key);
        if (!catalogUnit) {
            findings.push({
                key,
                locale: "*",
                kind: "migration-lost-translation",
                severity: "error",
                message: `key "${key}" present in legacy but not in catalog`,
            });
            continue;
        }
        findings.push(...compareUnit(legacyUnit, catalogUnit));
    }
    for (const [key] of catalogByKey) {
        if (!legacyByKey.has(key)) {
            findings.push({
                key,
                locale: "*",
                kind: "migration-extra-key",
                severity: "warning",
                message: `catalog has key "${key}" that was not in legacy lproj`,
            });
        }
    }
    return findings;
}
function compareUnit(legacy, catalog) {
    const findings = [];
    if (legacy.notes.length > 0) {
        const legacyComment = legacy.notes.find((n) => n.from === "developer")?.content;
        const catalogComment = catalog.notes.find((n) => n.from === "developer")?.content;
        if (legacyComment && legacyComment !== catalogComment) {
            findings.push({
                key: legacy.key,
                locale: "*",
                kind: "migration-comment-drift",
                severity: "warning",
                message: catalogComment
                    ? `developer comment changed during migration (legacy: "${legacyComment}", catalog: "${catalogComment}")`
                    : `developer comment dropped during migration (legacy had: "${legacyComment}")`,
            });
        }
    }
    for (const [locale, legacyTarget] of legacy.targets) {
        // Skip source locale as it's not a target locale
        if (locale === legacy.sourceLocale)
            continue;
        const catalogTarget = catalog.targets.get(locale);
        if (!catalogTarget) {
            findings.push({
                key: legacy.key,
                locale,
                kind: "migration-lost-translation",
                severity: "error",
                message: `legacy ${locale} translation missing from catalog`,
            });
            continue;
        }
        if (legacy.isPlural) {
            const legacyCategories = new Set(legacyTarget.variants.map((v) => v.pluralCategory).filter((c) => c !== undefined));
            const catalogCategories = new Set(catalogTarget.variants.map((v) => v.pluralCategory).filter((c) => c !== undefined));
            for (const cat of legacyCategories) {
                if (!catalogCategories.has(cat)) {
                    findings.push({
                        key: legacy.key,
                        locale,
                        kind: "migration-lost-plural-category",
                        severity: "error",
                        message: `legacy plural category "${cat}" missing from catalog for ${locale}`,
                        pluralCategory: cat,
                    });
                }
            }
            for (const legacyVariant of legacyTarget.variants) {
                const catalogVariant = catalogTarget.variants.find((v) => v.pluralCategory === legacyVariant.pluralCategory);
                if (catalogVariant && legacyVariant.value && catalogVariant.value) {
                    findings.push(...comparePlaceholdersForVariant(legacy.key, locale, legacyVariant.value, catalogVariant.value, legacyVariant.pluralCategory));
                }
            }
        }
        else {
            const legacyValue = legacyTarget.variants[0]?.value;
            const catalogValue = catalogTarget.variants[0]?.value;
            if (legacyValue && catalogValue) {
                findings.push(...comparePlaceholdersForVariant(legacy.key, locale, legacyValue, catalogValue));
            }
        }
    }
    return findings;
}
function comparePlaceholdersForVariant(key, locale, legacyValue, catalogValue, pluralCategory) {
    const legacyPh = (0,placeholders/* detectPlaceholders */.y)(legacyValue);
    const catalogPh = (0,placeholders/* detectPlaceholders */.y)(catalogValue);
    const mismatches = (0,placeholders/* comparePlaceholders */.I)(legacyPh, catalogPh);
    return mismatches.map((mm) => ({
        key,
        locale,
        kind: "migration-placeholder-corrupted",
        severity: "error",
        message: `placeholder ${mm.token} ${mm.kind} in catalog vs legacy (legacy ${mm.sourceCount}, catalog ${mm.targetCount})${pluralCategory ? ` (plural: ${pluralCategory})` : ""}`,
        pluralCategory,
    }));
}

;// CONCATENATED MODULE: ./src/commands/migrate.ts
/**
 * `localelint migrate <lproj-dir> <xcstrings-file>` command.
 *
 * Loads legacy AST from an .lproj directory tree and a catalog AST
 * from a .xcstrings file, then runs the migration comparison validator.
 */



async function runMigrate(lprojDir, xcstringsPath, sourceLocale = "en") {
    const legacy = await parseLproj(lprojDir, sourceLocale);
    const catalog = await (0,xcstrings/* parseXcstrings */.r)(xcstringsPath);
    const findings = compareMigration(legacy, catalog);
    return {
        legacy: {
            unitCount: legacy.metadata.unitCount,
            targetLocales: [...legacy.targetLocales].sort(),
        },
        catalog: {
            unitCount: catalog.metadata.unitCount,
            targetLocales: [...catalog.targetLocales].sort(),
        },
        findings,
    };
}


/***/ })

};
