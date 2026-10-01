import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "test-results");
const playwrightJson = path.join(outputDir, "playwright-results.json");
const htmlPath = path.join(outputDir, "test-report.html");
const markdownPath = path.join(outputDir, "test-report.md");
const reporterPath = path.join(root, "scripts", "test-event-reporter.mjs");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

const integrationFiles = new Set([
  "notificationFlow.test.ts",
  "poller.test.ts",
  "priceRepository.test.ts",
  "pushFanout.test.ts",
  "routes.test.ts",
  "serviceWorker.test.ts",
  "webPush.test.ts",
]);

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.stack}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function parseNodeEvents(output, category) {
  const results = [];
  for (const line of output.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const item = JSON.parse(line);
      results.push({ ...item, category, attempt: 1 });
    } catch {
      // Ignore non-reporter output from the runtime or loader.
    }
  }
  return results;
}

function flattenPlaywright(report) {
  const results = [];
  const visit = (suite, parents = []) => {
    const titles = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const attempts = test.results?.length ? test.results : [{ status: "skipped", duration: 0 }];
        attempts.forEach((attempt, index) => {
          const failed = ["failed", "timedOut", "interrupted"].includes(attempt.status);
          results.push({
            category: "Browser E2E",
            status: failed ? "failed" : attempt.status === "skipped" ? "skipped" : "passed",
            name: [...titles, spec.title].filter(Boolean).join(" › "),
            file: spec.file ?? "",
            durationMs: attempt.duration ?? 0,
            attempt: index + 1,
            error: attempt.error
              ? { message: attempt.error.message ?? "Browser test failed", stack: attempt.error.stack ?? "" }
              : null,
          });
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, titles);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return results;
}

function syntheticFailure(category, name, error) {
  return {
    category,
    status: "failed",
    name,
    file: "",
    durationMs: 0,
    attempt: 1,
    error: { message: error || `${category} runner failed`, stack: "" },
  };
}

function summary(results) {
  return results.reduce(
    (out, result) => {
      out.total += 1;
      out[result.status] = (out[result.status] ?? 0) + 1;
      out.durationMs += result.durationMs || 0;
      return out;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, durationMs: 0 },
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function duration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`;
}

function makeHtml(results, generatedAt) {
  const totals = summary(results);
  const categories = [...new Set(results.map((result) => result.category))];
  const sections = categories
    .map((category) => {
      const rows = results.filter((result) => result.category === category);
      const group = summary(rows);
      const body = rows
        .map((result) => {
          const details = result.error
            ? `<details><summary>${escapeHtml(result.error.message)}</summary><pre>${escapeHtml(result.error.stack)}</pre></details>`
            : "";
          return `<tr class="${result.status}">
            <td><span class="status">${result.status === "passed" ? "✓" : result.status === "failed" ? "✕" : "–"} ${escapeHtml(result.status)}</span></td>
            <td>${escapeHtml(result.name)}${details}</td>
            <td>${escapeHtml(result.file)}</td>
            <td>${result.attempt}</td>
            <td>${duration(result.durationMs || 0)}</td>
          </tr>`;
        })
        .join("\n");
      return `<section>
        <h2>${escapeHtml(category)} <small>${group.passed}/${group.total} passed</small></h2>
        <div class="table-wrap"><table><thead><tr><th>Result</th><th>Test</th><th>Source</th><th>Attempt</th><th>Duration</th></tr></thead><tbody>${body}</tbody></table></div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CTF Gold Test Report</title><style>
:root{color-scheme:light dark;--bg:#f7f7f8;--card:#fff;--text:#202124;--muted:#667085;--border:#e4e7ec;--pass:#067647;--pass-bg:#ecfdf3;--fail:#b42318;--fail-bg:#fef3f2;--skip:#475467;--skip-bg:#f2f4f7}
@media(prefers-color-scheme:dark){:root{--bg:#111318;--card:#1b1e25;--text:#f2f4f7;--muted:#98a2b3;--border:#344054;--pass:#6ce9a6;--pass-bg:#073d2b;--fail:#fda29b;--fail-bg:#4a1714;--skip:#d0d5dd;--skip-bg:#344054}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1280px;margin:auto;padding:32px 20px 60px}h1{margin:0;font-size:30px}h2{margin:0 0 14px;font-size:20px}h2 small{color:var(--muted);font-size:13px;font-weight:500;margin-left:8px}.meta{color:var(--muted);margin:5px 0 24px}.cards{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:12px;margin-bottom:28px}.card,section{background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 1px 2px #0000000d}.card{padding:16px}.card strong{display:block;font-size:25px}.card span{color:var(--muted)}.card.pass strong{color:var(--pass)}.card.fail strong{color:var(--fail)}section{padding:20px;margin-top:18px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:10px 12px;border-top:1px solid var(--border);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}td:first-child{width:110px}.status{display:inline-flex;padding:3px 8px;border-radius:999px;font-weight:650}.passed .status{color:var(--pass);background:var(--pass-bg)}.failed .status{color:var(--fail);background:var(--fail-bg)}.skipped .status,.todo .status{color:var(--skip);background:var(--skip-bg)}details{margin-top:6px;color:var(--fail)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--bg);padding:10px;border-radius:6px;color:var(--text)}@media(max-width:700px){.cards{grid-template-columns:repeat(2,1fr)}.page{padding:20px 12px}section{padding:14px}}
</style></head><body><main class="page">
<h1>CTF Gold Test Report</h1><p class="meta">Generated ${escapeHtml(generatedAt)} · Node ${escapeHtml(process.version)} · ${escapeHtml(os.platform())} ${escapeHtml(os.arch())}</p>
<div class="cards"><div class="card"><strong>${totals.total}</strong><span>Total runs</span></div><div class="card pass"><strong>${totals.passed}</strong><span>Passed</span></div><div class="card fail"><strong>${totals.failed}</strong><span>Failed</span></div><div class="card"><strong>${totals.skipped + totals.todo}</strong><span>Skipped / todo</span></div><div class="card"><strong>${duration(totals.durationMs)}</strong><span>Test time</span></div></div>
${sections}</main></body></html>`;
}

function makeMarkdown(results, generatedAt) {
  const totals = summary(results);
  const lines = [
    "# CTF Gold Test Report",
    "",
    `Generated ${generatedAt} · Node ${process.version} · ${os.platform()} ${os.arch()}`,
    "",
    `**${totals.passed}/${totals.total} passed** · **${totals.failed} failed** · **${totals.skipped + totals.todo} skipped/todo** · ${duration(totals.durationMs)} test time`,
  ];
  for (const category of [...new Set(results.map((result) => result.category))]) {
    const rows = results.filter((result) => result.category === category);
    const group = summary(rows);
    lines.push("", `## ${category} — ${group.passed}/${group.total} passed`, "", "| Result | Test | Attempt | Duration |", "| --- | --- | ---: | ---: |");
    for (const result of rows) {
      const icon = result.status === "passed" ? "✅" : result.status === "failed" ? "❌" : "⏭️";
      lines.push(`| ${icon} ${result.status} | ${escapeMarkdown(result.name)} | ${result.attempt} | ${duration(result.durationMs || 0)} |`);
      if (result.error?.message) lines.push(`|  | ${escapeMarkdown(result.error.message)} |  |  |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

await mkdir(outputDir, { recursive: true });
const testFiles = (await readdir(path.join(root, "test")))
  .filter((file) => file.endsWith(".test.ts"))
  .sort();
const groups = [
  { category: "Unit Tests", files: testFiles.filter((file) => !integrationFiles.has(file)) },
  { category: "Integration Tests", files: testFiles.filter((file) => integrationFiles.has(file)) },
];

const allResults = [];
let failed = false;
for (const group of groups) {
  process.stdout.write(`Running ${group.category.toLowerCase()}... `);
  const execution = await run(process.execPath, [
    "--import",
    "tsx",
    "--test",
    `--test-reporter=${reporterPath}`,
    ...group.files.map((file) => path.join("test", file)),
  ]);
  const results = parseNodeEvents(execution.stdout, group.category);
  if (results.length === 0 || (execution.code !== 0 && results.every((result) => result.status !== "failed"))) {
    results.push(syntheticFailure(group.category, `${group.category} runner`, execution.stderr || "No test results were produced"));
    failed = true;
  }
  allResults.push(...results);
  failed ||= execution.code !== 0;
  const totals = summary(results);
  console.log(`${totals.passed}/${totals.total} passed`);
}

process.stdout.write("Running browser E2E tests... ");
const e2e = await run(process.execPath, [playwrightCli, "test", "--reporter=json"], {
  env: { PLAYWRIGHT_JSON_OUTPUT_FILE: playwrightJson },
});
let e2eResults = [];
try {
  e2eResults = flattenPlaywright(JSON.parse(await readFile(playwrightJson, "utf8")));
} catch (error) {
  e2eResults = [syntheticFailure("Browser E2E", "Browser E2E runner", `${error.message}\n${e2e.stderr}`)];
  failed = true;
}
allResults.push(...e2eResults);
failed ||= e2e.code !== 0;
const e2eTotals = summary(e2eResults);
console.log(`${e2eTotals.passed}/${e2eTotals.total} passed`);

const generatedAt = new Date().toISOString();
await Promise.all([
  writeFile(htmlPath, makeHtml(allResults, generatedAt)),
  writeFile(markdownPath, makeMarkdown(allResults, generatedAt)),
]);
const totals = summary(allResults);
console.log(`Report: ${path.relative(root, htmlPath)}`);
console.log(`Overall: ${totals.passed}/${totals.total} passed, ${totals.failed} failed`);
if (failed) process.exitCode = 1;
