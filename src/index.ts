#!/usr/bin/env node

/**
 * LocaleLint CLI entrypoint.
 *
 * Phase B: `check` command runs validators and emits findings. Human and
 * JSON output modes. Exit code 1 if any error-severity finding, 0 otherwise.
 */

import { parseXcstrings } from "./adapters/xcstrings.js";
import { parseXliff } from "./adapters/xliff.js";
import type { LocalizationAST } from "./ast.js";
import type { Finding } from "./validators/findings.js";
import { runChecks } from "./validators/runChecks.js";

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "check") {
    const jsonMode = rest.includes("--json");
    const filePath = rest.find((arg) => !arg.startsWith("--"));
    if (!filePath) {
      console.error("usage: localelint check <file.xliff|file.xcstrings> [--json]");
      return 1;
    }
    const ast = await parseFile(filePath);
    const findings = runChecks(ast);

    if (jsonMode) {
      printJson(filePath, ast, findings);
    } else {
      printHuman(filePath, ast, findings);
    }

    return findings.some((f) => f.severity === "error") ? 1 : 0;
  }

  if (command === "migrate") {
    const jsonMode = rest.includes("--json");
    const positional = rest.filter((arg) => !arg.startsWith("--"));
    const [lprojDir, xcstringsPath] = positional;
    if (!lprojDir || !xcstringsPath) {
      console.error("usage: localelint migrate <lproj-dir> <file.xcstrings> [--json]");
      return 1;
    }

    const { runMigrate } = await import("./commands/migrate.js");
    const result = await runMigrate(lprojDir, xcstringsPath);

    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `legacy: ${result.legacy.unitCount} units, locales ${result.legacy.targetLocales.join(", ")}`,
      );
      console.log(
        `catalog: ${result.catalog.unitCount} units, locales ${result.catalog.targetLocales.join(", ")}`,
      );
      if (result.findings.length === 0) {
        console.log("");
        console.log("no migration drift detected.");
      } else {
        const byLocale = new Map<string, typeof result.findings>();
        for (const f of result.findings) {
          const list = byLocale.get(f.locale) ?? [];
          list.push(f);
          byLocale.set(f.locale, list);
        }
        for (const [locale, list] of [...byLocale.entries()].sort()) {
          console.log("");
          console.log(`[${locale}] ${list.length} finding(s):`);
          for (const f of list) {
            const sev = f.severity === "error" ? "ERR " : f.severity === "warning" ? "WARN" : "INFO";
            console.log(`  ${sev} ${f.kind.padEnd(32)} ${f.key}: ${f.message}`);
          }
        }
        console.log("");
        const errors = result.findings.filter((f) => f.severity === "error").length;
        const warnings = result.findings.filter((f) => f.severity === "warning").length;
        console.log(`${errors} error(s), ${warnings} warning(s)`);
      }
    }

    return result.findings.some((f) => f.severity === "error") ? 1 : 0;
  }

  console.error(`unknown command: ${command}`);
  printHelp();
  return 2;
}

async function parseFile(filePath: string): Promise<LocalizationAST> {
  if (filePath.endsWith(".xliff") || filePath.endsWith(".xlf")) {
    return parseXliff(filePath);
  }
  if (filePath.endsWith(".xcstrings")) {
    return parseXcstrings(filePath);
  }
  throw new Error(`unknown format for ${filePath}`);
}

function printHuman(filePath: string, ast: LocalizationAST, findings: Finding[]): void {
  const locales = [...ast.targetLocales].sort().join(", ") || "(none)";
  console.log(`${filePath}: ${ast.metadata.unitCount} units, source ${ast.sourceLocale}, targets ${locales}`);

  if (findings.length === 0) {
    console.log("");
    console.log("no findings.");
    return;
  }

  const byLocale = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = byLocale.get(finding.locale) ?? [];
    list.push(finding);
    byLocale.set(finding.locale, list);
  }

  for (const [locale, list] of [...byLocale.entries()].sort()) {
    console.log("");
    console.log(`[${locale}] ${list.length} finding(s):`);
    for (const f of list) {
      const sev = f.severity === "error" ? "ERR " : f.severity === "warning" ? "WARN" : "INFO";
      console.log(`  ${sev} ${f.kind.padEnd(20)} ${f.key}: ${f.message}`);
    }
  }

  console.log("");
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  console.log(`${errors} error(s), ${warnings} warning(s), ${infos} info`);
}

function printJson(filePath: string, ast: LocalizationAST, findings: Finding[]): void {
  const output = {
    file: filePath,
    summary: {
      format: ast.metadata.formats[0],
      unitCount: ast.metadata.unitCount,
      sourceLocale: ast.sourceLocale,
      targetLocales: [...ast.targetLocales].sort(),
    },
    findings,
    counts: {
      error: findings.filter((f) => f.severity === "error").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    },
  };
  console.log(JSON.stringify(output, null, 2));
}

function printHelp(): void {
  console.log(`
localelint, localization CI for iOS apps

usage:
  localelint check <file> [--json]                          Parse and validate a file
  localelint migrate <lproj-dir> <file.xcstrings> [--json]  Validate Xcode auto-migration
  localelint --help                                         Show this help

supported formats in v1:
  iOS XLIFF 1.2 (.xliff, .xlf)
  Xcode String Catalog (.xcstrings)
  Legacy iOS (.strings + .stringsdict) for migrate command

exit codes:
  0  no errors
  1  one or more error-severity findings
  2  invalid usage
`);
}

main(process.argv).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
