// Runs the project's checks in parallel and prints one line per check, with
// the full output only for the ones that fail (so a passing run is a few lines):
//   pnpm check                       typecheck, lint, test (what CI runs)
//   pnpm check typecheck lint        only those
//   pnpm check format:check          the Prettier check is opt-in: the user formats code themselves
// CI runs the same scripts one by one (.github/workflows/ci.yml). A failing
// check's output is cut to its last MAX_LINES lines; run `pnpm <check>` for all of it.
import { spawn } from "node:child_process";

const DEFAULT = ["typecheck", "lint", "test"];
const ALL = [...DEFAULT, "format:check"];
const MAX_LINES = 60;
const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !ALL.includes(name));
if (unknown.length) {
  console.error(`Unknown check: ${unknown.join(", ")} (known: ${ALL.join(", ")})`);
  process.exit(1);
}
const names = requested.length ? requested : DEFAULT;

const elapsed = (started) => ((Date.now() - started) / 1000).toFixed(1);

function run(name) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["run", "--silent", name], {
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => resolve({ name, ok: false, output: String(error), seconds: elapsed(started) }));
    child.on("close", (code) => resolve({ name, ok: code === 0, output, seconds: elapsed(started) }));
  });
}

const results = await Promise.all(names.map(run));
let failed = false;
for (const { name, ok, output, seconds } of results) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name} (${seconds}s)`);
  if (!ok) {
    failed = true;
    const lines = output.trimEnd().split("\n");
    if (lines.length > MAX_LINES) console.log(`... ${lines.length - MAX_LINES} earlier lines cut`);
    console.log(lines.slice(-MAX_LINES).join("\n"));
    console.log("");
  }
}
process.exit(failed ? 1 : 0);
