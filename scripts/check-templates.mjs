// Compiles Vue templates to catch broken structure (a missing closing tag, a
// bad directive) that typecheck and lint don't:
//   pnpm check:templates                 .vue files changed since origin/main, plus untracked ones
//   pnpm check:templates <file>...       those files
//   node scripts/check-templates.mjs --hook   Claude Code PostToolUse hook: reads the edited file
//                                         from stdin, exits 2 with the errors if it doesn't compile
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// `vue` and its compiler are not direct dependencies, so find them through nuxt.
const require = createRequire(import.meta.url);
const fromNuxt = createRequire(require.resolve("nuxt/package.json"));
const { parse, compileTemplate } = createRequire(fromNuxt.resolve("vue/package.json"))(
  "@vue/compiler-sfc",
);

const args = process.argv.slice(2);
const hook = args.includes("--hook");

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8" }).split("\n").filter(Boolean);
}

async function readHookFile() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  try {
    return JSON.parse(input)?.tool_input?.file_path;
  } catch {
    return undefined;
  }
}

let files;
if (hook) {
  const file = await readHookFile();
  files = file?.endsWith(".vue") ? [file] : [];
} else if (args.length) {
  files = args;
} else {
  const base = git("merge-base", "HEAD", "origin/main")[0];
  files = [
    ...git("diff", "--name-only", "--diff-filter=d", base),
    ...git("ls-files", "--others", "--exclude-standard"),
  ].filter((file) => file.endsWith(".vue"));
}

const problems = new Set();
for (const file of files.filter((file) => existsSync(file))) {
  const path = resolve(file);
  const source = readFileSync(path, "utf8");
  const { descriptor, errors } = parse(source, { filename: path });
  for (const error of errors) problems.add(`${file}: ${error.message}`);
  if (descriptor.template) {
    const { errors: templateErrors } = compileTemplate({
      source: descriptor.template.content,
      filename: path,
      id: "check",
    });
    for (const error of templateErrors) {
      problems.add(`${file}: ${typeof error === "string" ? error : error.message}`);
    }
  }
}

if (problems.size) {
  console.error([...problems].join("\n"));
  process.exit(hook ? 2 : 1);
}
if (!hook) console.log(`ok   ${files.length} template(s) compile`);
