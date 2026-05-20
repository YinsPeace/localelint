/**
 * LocaleLint GitHub Action entrypoint.
 *
 * Reads input files, runs parsers + validators in-process (no spawn),
 * reports findings to the action log, and posts or updates a single PR
 * comment with a Markdown summary.
 *
 * Exit code is set via core.setFailed when:
 *   - any error-severity finding is present, OR
 *   - fail-on-warning is true AND any warning-severity finding is present.
 */

import * as core from "@actions/core";
import * as github from "@actions/github";

import type { LocalizationAST } from "../src/ast.js";
import { parseXcstrings } from "../src/adapters/xcstrings.js";
import { parseXliff } from "../src/adapters/xliff.js";
import type { Finding, Severity } from "../src/validators/findings.js";
import { runChecks } from "../src/validators/runChecks.js";

const COMMENT_MARKER = "<!-- localelint-pr-comment -->";
const MAX_ROWS_PER_FILE = 50;

interface FileResult {
  file: string;
  ast: LocalizationAST;
  findings: Finding[];
}

async function run(): Promise<void> {
  try {
    const filesInput = core.getInput("files", { required: true });
    const failOnWarning = core.getBooleanInput("fail-on-warning");
    const postComment = core.getBooleanInput("post-comment");
    const token = core.getInput("github-token");
    const mode = (core.getInput("mode") || "check").toLowerCase();
    const lprojDir = core.getInput("lproj-dir");

    const files = filesInput
      .split(/[\n,]/)
      .map((f) => f.trim())
      .filter(Boolean);

    if (files.length === 0) {
      core.warning("No input files provided.");
      return;
    }

    if (mode === "migrate") {
      if (!lprojDir) {
        core.setFailed("migrate mode requires `lproj-dir` input");
        return;
      }
      if (files.length !== 1) {
        core.setFailed("migrate mode requires exactly one .xcstrings file in `files`");
        return;
      }
      const xcstringsPath = files[0]!;
      const { runMigrate } = await import("../src/commands/migrate.js");
      const result = await runMigrate(lprojDir, xcstringsPath);
      const findings = result.findings;

      for (const f of findings) {
        const annotation = { file: xcstringsPath, title: `${f.kind} (${f.locale})` };
        if (f.severity === "error") core.error(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
        else if (f.severity === "warning") core.warning(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
        else core.notice(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
      }

      const totals = countSeveritiesFlat(findings);
      core.setOutput("errors", String(totals.error));
      core.setOutput("warnings", String(totals.warning));
      core.setOutput("info", String(totals.info));

      core.info("");
      core.info(`LocaleLint migrate summary: ${totals.error} error(s), ${totals.warning} warning(s), ${totals.info} info`);

      if (postComment && token && github.context.payload.pull_request) {
        try {
          await postOrUpdateMigrationComment(token, lprojDir, xcstringsPath, findings);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          core.warning(`Failed to post PR comment: ${msg}`);
        }
      }

      if (totals.error > 0 || (failOnWarning && totals.warning > 0)) {
        core.setFailed(
          `LocaleLint migrate found ${totals.error} error(s)` +
            (failOnWarning && totals.warning > 0 ? ` and ${totals.warning} warning(s)` : ""),
        );
      }
      return;
    }

    const results: FileResult[] = [];

    for (const file of files) {
      try {
        const ast = await parseFile(file);
        const findings = runChecks(ast);
        results.push({ file, ast, findings });

        for (const f of findings) {
          const annotation = { file, title: `${f.kind} (${f.locale})` };
          if (f.severity === "error") {
            core.error(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
          } else if (f.severity === "warning") {
            core.warning(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
          } else {
            core.notice(`[${f.locale}] ${f.key}: ${f.message}`, annotation);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.error(`Failed to parse ${file}: ${msg}`);
      }
    }

    const totals = countSeverities(results);
    core.setOutput("errors", String(totals.error));
    core.setOutput("warnings", String(totals.warning));
    core.setOutput("info", String(totals.info));

    core.info("");
    core.info(`LocaleLint summary: ${totals.error} error(s), ${totals.warning} warning(s), ${totals.info} info`);

    if (postComment && token && github.context.payload.pull_request) {
      try {
        await postOrUpdateComment(token, results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to post PR comment: ${msg}`);
      }
    }

    if (totals.error > 0 || (failOnWarning && totals.warning > 0)) {
      core.setFailed(
        `LocaleLint found ${totals.error} error(s)` +
          (failOnWarning && totals.warning > 0 ? ` and ${totals.warning} warning(s)` : ""),
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    core.setFailed(msg);
  }
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

function countSeverities(results: FileResult[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const r of results) {
    for (const f of r.findings) {
      counts[f.severity]++;
    }
  }
  return counts;
}

function formatComment(results: FileResult[]): string {
  const totals = countSeverities(results);
  let body = `${COMMENT_MARKER}\n## LocaleLint\n\n`;
  body += `**${totals.error} error(s) · ${totals.warning} warning(s) · ${totals.info} info**\n\n`;

  if (totals.error + totals.warning + totals.info === 0) {
    body += "All checks passed.\n\n";
    body += "<sub>Generated by LocaleLint</sub>\n";
    return body;
  }

  for (const r of results) {
    if (r.findings.length === 0) continue;

    body += `### \`${r.file}\`\n`;
    const targets = [...r.ast.targetLocales].sort().join(", ") || "(none)";
    body += `${r.ast.metadata.unitCount} units · source \`${r.ast.sourceLocale}\` · targets \`${targets}\`\n\n`;
    body += "| Severity | Locale | Key | Kind | Message |\n";
    body += "|---|---|---|---|---|\n";

    const rows = r.findings.slice(0, MAX_ROWS_PER_FILE);
    for (const f of rows) {
      const sev = f.severity.toUpperCase();
      body += `| ${sev} | \`${f.locale}\` | \`${f.key}\` | \`${f.kind}\` | ${escapePipe(f.message)} |\n`;
    }
    if (r.findings.length > MAX_ROWS_PER_FILE) {
      body += `\n_…and ${r.findings.length - MAX_ROWS_PER_FILE} more. Full output in the action logs._\n`;
    }
    body += "\n";
  }

  body += "<sub>Generated by LocaleLint</sub>\n";
  return body;
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function countSeveritiesFlat(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

async function postOrUpdateComment(token: string, results: FileResult[]): Promise<void> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const pr = github.context.payload.pull_request;
  if (!pr) return;

  const body = formatComment(results);

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body,
    });
  }
}

async function postOrUpdateMigrationComment(
  token: string,
  lprojDir: string,
  xcstringsPath: string,
  findings: Finding[],
): Promise<void> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const pr = github.context.payload.pull_request;
  if (!pr) return;
  const totals = countSeveritiesFlat(findings);
  let body = `${COMMENT_MARKER}\n## LocaleLint migrate\n\n`;
  body += `Validating \`${xcstringsPath}\` against legacy \`${lprojDir}\`\n\n`;
  body += `**${totals.error} error(s) · ${totals.warning} warning(s) · ${totals.info} info**\n\n`;
  if (findings.length === 0) {
    body += "No migration drift detected.\n";
  } else {
    body += "| Severity | Locale | Key | Kind | Message |\n";
    body += "|---|---|---|---|---|\n";
    for (const f of findings.slice(0, 50)) {
      body += `| ${f.severity.toUpperCase()} | \`${f.locale}\` | \`${f.key}\` | \`${f.kind}\` | ${f.message.replace(/\|/g, "\\|")} |\n`;
    }
    if (findings.length > 50) {
      body += `\n_...and ${findings.length - 50} more. Full output in action logs._\n`;
    }
  }
  body += "\n<sub>Generated by LocaleLint</sub>\n";
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: pr.number, body });
  }
}

run();
