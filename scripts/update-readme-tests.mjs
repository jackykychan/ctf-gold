/**
 * Run the test suite with coverage, then write a one-line summary into the
 * marked block of README.md. Used by CI to publish live results on each push.
 *   node scripts/update-readme-tests.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CMD = "node --import tsx --test --experimental-test-coverage test/*.test.ts";

let out = "";
try {
  out = execSync(CMD, { encoding: "utf8" });
} catch (err) {
  // `node --test` exits non-zero when a test fails — keep its output to report it.
  out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
}

const grab = (re, fallback = "?") => {
  const m = out.match(re);
  return m ? m[1] : fallback;
};
const tests = grab(/\btests (\d+)/);
const pass = grab(/\bpass (\d+)/);
const fail = grab(/\bfail (\d+)/);
const coverage = grab(/all files\s*\|\s*([\d.]+)/);
const ok = fail === "0";
const today = new Date().toISOString().slice(0, 10);

const summary =
  `${ok ? "✅" : "❌"} **${pass}/${tests} tests passing** · ` +
  `**${coverage}% line coverage** · updated ${today}`;

const block = `<!-- TEST-RESULTS:START -->\n\n${summary}\n\n<!-- TEST-RESULTS:END -->`;
const marker = /<!-- TEST-RESULTS:START -->[\s\S]*?<!-- TEST-RESULTS:END -->/;

const readme = readFileSync("README.md", "utf8");
if (!marker.test(readme)) {
  console.error("README.md is missing the TEST-RESULTS markers; nothing updated.");
  process.exit(0);
}
writeFileSync("README.md", readme.replace(marker, block));
console.log(summary);
