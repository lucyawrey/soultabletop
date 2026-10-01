# Sheet formulas: sandboxed JavaScript as an alternative

Written 2026-10-01 by a planning agent, as the comparison the baseline plan (`sheet-formulas.md`, next to this file) asks for. Nothing in the repo was changed; all experiments ran in a throwaway scratchpad. Numbers marked **measured** come from those experiments; numbers marked **docs** come from the linked sources.

## Summary and recommendation

Sandboxed JavaScript is feasible here, but only one sandbox fits the app's constraints: **QuickJS compiled to WebAssembly** (`quickjs-emscripten`, preferably the quickjs-ng build). It is the only option that is synchronous, runs the same engine in the browser and in Vercel's Node functions, and can enforce CPU, memory and stack limits. It is not the "real, fast engine" the idea hopes for. QuickJS is an interpreter with no JIT. On a D&D-sized sheet (80 formulas plus 60 table-row formulas over 33 KB of data) it took about 0.5 ms per whole-sheet run with the data already inside the sandbox, and about 1 ms when the data had to be copied in. A minimal tree-walking evaluator of the kind the baseline proposes took about 0.14 ms. Neither is a bottleneck while editing: on a 4× CPU-throttled browser that was 2 ms vs 0.5 ms per keystroke. What actually costs something with QuickJS is everything around the evaluation:

- about 200 KB (brotli) of WebAssembly on any page that shows a sheet;
- about 70 ms and about 25 MB of memory the first time a cold server instance evaluates a sheet;
- asynchronous loading that has to finish before hydration;
- static checking that is lost: unknown paths, type and result-type checks, cycles, and the `confirmBrokenSheets` diff;
- a sandbox, its marshaling rules and its upgrades that the team would own;
- two hostile-input problems found while testing. The original QuickJS build overran a 50 ms deadline by 1 to 3 seconds. A stack limit set too high crashed out through the host's stack.

The ways sandboxed JS is better are real, but they are about expressiveness, not speed: loops, local variables, data structures, and a language that programmers and AI agents already know.

**Recommendation: build the baseline formula language now, and keep a QuickJS "Script" backend as a possible later, opt-in addition (the hybrid).** Section 5 lists the few cheap decisions that keep that option open. What would change this recommendation is in section 6.

---

## 0. What the alternative would look like

So the comparison is concrete, assume this shape:

- **A `<Script>` section** in the sheet markup (raw text, like HTML's `<script>`) defines plain functions: `function mod(score) { return Math.floor((score - 10) / 2); }`.
- **`<Define name="pb" js="Math.ceil(data.level / 4) + 1" />`** and **`formula="mod(data.abilities.str)"`** attributes hold JS expressions.
- **Provided functions** (`sum`, `count`, `signed`, `coalesce`, ...) are a prelude written in JS and loaded into the sandbox.
- **Execution:** each render evaluates everything inside a fresh sandbox context that holds the viewer's data and loaded `refs`, and the results come back as JSON values.

The baseline's decisions still apply unchanged:

- computed at render time and never stored;
- `field` + `formula` as an override;
- missing values make the result empty;
- errors are shown to editors only;
- `get(record, key)`, which in JS is simply `record[key]` (see section 4).

---

## 1. Sandbox options

Constraints that rule options in or out:

- Sheet markup is written by one user and executed for every viewer.
- It runs in the browser and during SSR on Vercel's Node functions. `ContentDetail.vue` renders `SheetRenderer` outside `<ClientOnly>`.
- It runs on the server when a sheet is saved (`assertValidSheetMarkup`) and when a schema change is checked (`findSheetsBrokenBy`).
- Rendering is synchronous. Vue computeds in `useSheet()`/`Field.vue` must return a value on the spot, and SSR and client output must match.

| Option                                                                               | Security model                                                                                                                                                                                                                                                                                                                                      | CPU / memory limits, termination                                                                                                                               | Sync API                                                | Browser            | Vercel Node SSR                                                                                                                                                  | Size                                                                                                       | Maintenance (npm, 2026-10-01)                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **QuickJS → WASM** (`quickjs-emscripten` + `@jitl/quickjs-ng-wasmfile-release-sync`) | Separate interpreter; the guest's whole heap is in WASM linear memory, and it has no host globals at all (**measured**: `fetch`, `process`, `document`, `Image`, `WebAssembly` all `undefined`). The guest reaches the host only through functions the host injects. README: "makes every effort to be secure, but has not been audited" (**docs**) | Interrupt handler (deadline), `setMemoryLimit`, `setMaxStackSize`; a runtime can be thrown away (**measured**, section 2f)                                     | Yes (the "sync" variants; only module loading is async) | Yes                | Yes (plain WASM, no native addon)                                                                                                                                | WASM 503–529 KB raw, **199–212 KB brotli**, 231–247 KB gzip; JS glue 54 KB min / 15 KB gzip (**measured**) | 0.32.0, Feb 2026; one main maintainer (justjake)      |
| **isolated-vm** (native V8 isolate)                                                  | Real V8 isolate. Critical guest→host escape GHSA-864f-rcv7-6rh4 (type confusion in `ExternalCopy`), fixed in 7.0.1 in Aug 2026; CVE-2022-39266 before that (**docs**). The README warns that leaking any `Reference`/`ExternalCopy` "is usually trivial" to turn into full control of the process                                                   | `memoryLimit`, `timeout`, isolate disposal                                                                                                                     | Yes                                                     | **No** (Node only) | Native addon: needs the right prebuilt binary; the README requires `--no-node-snapshot` on Node ≥ 20 (it ran without it on Node 26 here; not verified on Vercel) | 21 MB installed, server only                                                                               | 7.0.1; README: "currently in _maintenance mode_"      |
| **Node `vm`**                                                                        | **Not a security boundary.** Node's docs say not to use it for untrusted code. **Measured:** `this.constructor.constructor('return process')()` reaches the host `process`                                                                                                                                                                          | `timeout` covers synchronous code only. **Measured:** a microtask loop started inside the context hung the host process (killed after 10 s; a timer never ran) | Yes                                                     | No                 | Unsafe                                                                                                                                                           | —                                                                                                          | core                                                  |
| **Web Worker**                                                                       | Separate thread; with a `blob:` URL it shares the page's origin, so it has `fetch` with the user's cookies unless a CSP blocks it. Not an isolation boundary for data on its own                                                                                                                                                                    | `worker.terminate()` stops anything                                                                                                                            | **No** (postMessage)                                    | Yes                | No (Node has `worker_threads`, also async)                                                                                                                       | —                                                                                                          | platform                                              |
| **Sandboxed iframe** (`sandbox="allow-scripts"`, opaque origin)                      | Real origin isolation; with a strict CSP no network access                                                                                                                                                                                                                                                                                          | Can't stop a busy loop in a same-process iframe; out-of-process iframes aren't guaranteed                                                                      | **No**                                                  | Yes                | No                                                                                                                                                               | —                                                                                                          | platform                                              |
| **SES / Endo `ses` Compartments**                                                    | Hardened realm: `lockdown()` freezes every intrinsic in the **host** realm, and Compartments get separate globals. Sound object-capability design                                                                                                                                                                                                   | **No CPU limit** (`for(;;){}` hangs the thread); no memory limit                                                                                               | Yes                                                     | Yes                | Yes, but lockdown changes the whole Nuxt server realm. **Measured:** it removed properties another library (js-interpreter) had added to built-ins               | 86 KB min / 28 KB gzip (**measured**)                                                                      | 2.3.0, Aug 2026, active                               |
| **js-interpreter** (Neil Fraser)                                                     | Interpreter written in JS; the guest sees only pseudo-objects                                                                                                                                                                                                                                                                                       | Step-by-step, so a step budget is easy                                                                                                                         | Yes                                                     | Yes                | Yes                                                                                                                                                              | 99 KB min / 27 KB gzip (**measured**)                                                                      | 6.0.2; ES5 only (no arrows, `let`, optional chaining) |
| **`new Function` / `eval`**                                                          | None: full access to the page or server                                                                                                                                                                                                                                                                                                             | None                                                                                                                                                           | Yes                                                     | —                  | —                                                                                                                                                                | —                                                                                                          | **Rejected**                                          |

**What runs on both sides:** QuickJS-WASM and js-interpreter (both safely), and SES (not safely: no CPU limit). Only QuickJS combines sync calls, limits and acceptable speed.

- isolated-vm on the server with QuickJS in the browser would mean two engines, with differences in number formatting, sorting and error text that can break hydration. It would also add a native dependency with a fresh escape history.
- A Worker or iframe is asynchronous, so values would arrive after the render: a flash of empty values, and SSR would need a separate engine anyway.

**Cold start and memory on Vercel.** Vercel functions get 2 GB / 1 vCPU by default and 250 MB of uncompressed bundle (**docs**), so neither size nor memory is a hard limit. With Fluid compute one instance serves concurrent requests, and CPU time is billed. Measured costs for QuickJS (section 2):

- about 70 ms from process start to the first evaluated sheet, vs 3–6 ms for the tree walker;
- about 25 MB more RSS, of which 6.5 MB is the module itself;
- WASM linear memory grows but never shrinks (a property of WebAssembly), so one memory-hungry sheet raises the instance's footprint until it is recycled.

---

## 2. Measurements

**Setup.**

- Machine: AMD Ryzen 7 3700X, Linux, Node 26.10.0.
- Packages: `quickjs-emscripten-core` 0.32.0 with the `@jitl/quickjs-wasmfile-release-sync` (Bellard's QuickJS) and `@jitl/quickjs-ng-wasmfile-release-sync` variants, `isolated-vm` 7.0.1, `ses` 2.3.0, `js-interpreter` 6.0.2, `@vue/reactivity` (current).
- Browser: Playwright 1.63 headless Chromium shell, with CDP CPU throttling ×1 and ×4 (×4 stands in for a mid-range phone).
- Timing: medians of 1,000–2,000 runs after a warmup (fewer for slow cases). Browser timers are coarsened to 100 µs, so each browser sample timed a batch of 20 calls.

**Workload.**

- Data: a D&D-like character of **32.9 KB JSON**: 6 abilities, saves, 18 skills, 60 inventory items with descriptions, 40 spells, 5 weapons, 15 features.
- **80 formulas** in the baseline syntax: modifiers, saves, skills, passives, spell DC, attacks, encumbrance, counts, `concat`, and so on, all using the plan's `$pb`, `$mod`, `$skill`, `$castMod` and `$load` definitions.
- **60 row formulas** (`qty * item.weight`).
- One source: a minimal Pratt parser produced the AST for the tree walker, and a printer turned the same AST into idiomatic JS (`mod(d, d?.abilities?.str)`, `sum(d?.inventory, (it) => ...)`).
- Both engines produced identical results for all 80 formulas.

### (a) QuickJS instantiation

|                                                                           | QuickJS (Bellard)    | quickjs-ng           |
| ------------------------------------------------------------------------- | -------------------- | -------------------- |
| Import JS glue                                                            | 3.1 ms               | 3.1 ms               |
| Compile + instantiate WASM module (Node, first time)                      | 15.2 ms              | 5.3 ms               |
| New runtime + context                                                     | 2.4 ms               | 2.7 ms               |
| First eval of the sheet program (prelude + 5 defs + 80 formula functions) | 8.7 ms               | 8.5 ms               |
| Warm: new runtime + context + program, then dispose                       | 1.55 ms              | 1.48 ms              |
| RSS after module / after context + program                                | +6.6 / +12.2 MB      | +6.5 / +12.3 MB      |
| QuickJS's own heap accounting for the context                             | 129 KB               | 138 KB               |
| **Fresh process → first sheet evaluated** (7 runs)                        | ~71 ms, RSS 74–79 MB | ~70 ms, RSS 79–86 MB |
| Same for the tree walker                                                  | 3–6 ms, RSS 54 MB    |                      |
| Browser ×1: load module / context + program + first sheet                 |                      | 13.7 ms / 18.9 ms    |
| Browser ×4                                                                |                      | 28.9 ms / 69.6 ms    |
| Bytes on the wire (WASM, brotli)                                          | 199 KB               | 212 KB               |

The browser numbers exclude the download: the WASM was served from memory.

### (b) Evaluating the whole workload (80 formulas + 60 rows), Node, median

| Strategy                                                                                                          | QuickJS       | quickjs-ng    |
| ----------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| 1 call; host `JSON.stringify` → string in → guest `JSON.parse` → run → guest `JSON.stringify` → host `JSON.parse` | 1,093 µs      | 1,065 µs      |
| 1 call; data already resident in the guest                                                                        | 471 µs        | 508 µs        |
| 80 calls, one per formula, resident data, `vm.dump` each result                                                   | 536 µs        | 566 µs        |
| 80 calls, data re-sent as JSON for each call                                                                      | **43.8 ms**   | 39.7 ms       |
| 1 call, data built with handles (`newObject`/`setProp`)                                                           | 1,142 µs      | 1,269 µs      |
| Marshal in only: handles vs JSON string                                                                           | 579 vs 590 µs | 622 vs 515 µs |

Reading:

- Copying the data in costs about as much as evaluating the sheet: about 0.55 ms, mostly the guest's own `JSON.parse` of 33 KB.
- Handles are no faster than JSON.
- One call per formula is fine only if the data stays resident. Re-marshaling per formula is about 80× worse.
- The boundary is a fixed cost per crossing, so the design has to be "one crossing per render or edit".

| Other engines, same workload                        | Median                                             |
| --------------------------------------------------- | -------------------------------------------------- |
| Native V8, no sandbox (reference only)              | 15.5 µs                                            |
| isolated-vm, JSON in/out                            | 137 µs (isolate + context 1.5 ms)                  |
| SES Compartment, on a `structuredClone` of the data | 156 µs (plus `lockdown()` 11.7 ms, import 23.7 ms) |
| js-interpreter (ES5 port of the same formulas)      | **20.7 ms** (56,000 steps)                         |

### (c) Baseline: minimal tree walker over a pre-parsed AST, Node

|                                                  | Median                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Parse 80 formulas (warm / first time)            | 204 µs / 1.2 ms (parsing happens once per markup change, inside `compileSheet`)                                                     |
| Whole sheet, 80 formulas, memoised definitions   | 147 µs                                                                                                                              |
| Whole sheet + 60 row formulas                    | 135 µs                                                                                                                              |
| One formula (`$skill(...)`)                      | 1.1 µs                                                                                                                              |
| Browser ×1 / ×4: whole sheet + rows              | 135 µs / 545 µs                                                                                                                     |
| Minified size of this minimal parser + evaluator | 4.5 KB (1.8 KB gzip). The real engine with checker and messages will be several times that, but still tens of KB at most (estimate) |

My walker copies `env` on every call and runs a regex per path segment, so it is not tuned; a careful one would be faster.

### (d) Re-evaluating after one field changes (keystroke → recompute)

Baseline, one Vue `computed` per formula site over the reactive draft (as the plan proposes). Times include re-reading all 140 computeds:

| Edit                           | Median | Why                                                    |
| ------------------------------ | ------ | ------------------------------------------------------ |
| `coins.gp`                     | 17 µs  | 1 formula depends on it                                |
| `abilities.str`                | 263 µs | ~30 formulas re-run through Vue proxies                |
| one `inventory[3].qty`         | 463 µs | every `sum(inventory, …)` re-runs over 60 proxied rows |
| First evaluation of everything | 146 µs |                                                        |

QuickJS has no dependency tracking across the boundary, so every edit re-runs the whole sheet:

| Edit path                                                                     | Node            | Browser ×1 | Browser ×4 |
| ----------------------------------------------------------------------------- | --------------- | ---------- | ---------- |
| Forward the one changed path into resident data (`setPath`), re-run, JSON out | 477 µs (ng 513) | 500 µs     | 2.0 ms     |
| Re-send the full draft as JSON, re-run                                        | 1,075 µs        | ~1,005 µs  | 4.1 ms     |

- Forwarding single writes works because `Renderer.vue` funnels every edit through `context.update` → `setSheetValue`.
- Anything that replaces the draft (reload, discard, a 409 reload, adding a ref) needs a full resend.
- Both designs are comfortably under a frame. The baseline's fine-grained tracking doesn't make it dramatically cheaper for heavy edits on this data, but it is 3–4× cheaper in the typical case and needs no copy.

### (e) Copy costs for the data object (Worker or iframe boundary)

|                                                                  | Node        | Browser ×1 | Browser ×4 |
| ---------------------------------------------------------------- | ----------- | ---------- | ---------- |
| `JSON.stringify` (raw object)                                    | 17 µs       | 15 µs      | 70 µs      |
| `JSON.parse`                                                     | 66 µs       |            |            |
| `structuredClone`                                                | 124 µs      | 110 µs     | 455 µs     |
| `JSON.stringify` of the **reactive** draft (through Vue proxies) | **659 µs**  |            |            |
| Worker round trip (structured clone both ways)                   |             | 280 µs     | 910 µs     |
| Worker round trip (JSON string both ways)                        |             | 130 µs     | 460 µs     |
| Worker round trip, tiny message                                  |             | 10 µs      | 60 µs      |
| 146 KB data: stringify / structuredClone                         | 75 / 533 µs |            |            |

- JSON strings cross boundaries more cheaply than structured clone.
- Any boundary must serialize `toRaw(draft)`, never the reactive proxy, which is 40× slower.

### (f) Hostile input against QuickJS

Settings: 8 MB memory limit, 256 KB stack limit, 50 ms deadline.

| Attack                                                           | Bellard QuickJS                                                                                                                                                                                        | quickjs-ng    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `for(;;){}`, also inside `try/catch`                             | Interrupted at 50 ms; the interrupt can't be caught; the context stays usable                                                                                                                          | same          |
| String doubling                                                  | "string too long" at 0.4 ms                                                                                                                                                                            |               |
| `push` loop                                                      | Interrupted at 51 ms                                                                                                                                                                                   |               |
| Deep recursion                                                   | "stack overflow" at 3 ms                                                                                                                                                                               |               |
| Recursion that **catches** the stack overflow and recurses again | **Overran the deadline: 0.94 s with a 64 KB stack, 3.3–3.6 s with 256 KB.** The interrupt handler was polled only twice                                                                                | 83 ms / 61 ms |
| Stack limit unset, or 1 MB                                       | **The host's stack overflowed inside WASM**: a `RangeError` thrown in the host (Node). Catchable, and the module still worked afterwards, but WASM state after a host stack overflow is not guaranteed | same          |
| Catastrophic regex `/^(a+)+$/`                                   | Interrupted at 50 ms                                                                                                                                                                                   |               |
| `this.constructor.constructor('return process')`                 | Stays inside the guest; host objects aren't reachable                                                                                                                                                  |               |
| `Object.prototype.polluted = 1`                                  | Affects the guest only; the host's prototype is untouched                                                                                                                                              |               |
| Promise-job loop                                                 | Bounded by `executePendingJobs(maxJobs)`, never run implicitly                                                                                                                                         |               |
| `Date.now()`, `Math.random()`                                    | Available. They must be removed in the prelude or SSR and hydration will differ                                                                                                                        |               |

What this proves and what it doesn't:

- Termination works for the common bombs. The interrupt is polled coarsely, and Bellard's build had a measured multi-second overrun on a simple pattern. **Use quickjs-ng and test the limits per release.**
- The safe stack limit depends on the host's own stack, which varies by browser, so it has to be set conservatively (≤ 256 KB) and tested in Safari and Firefox. That wasn't done here.
- These tests say nothing about memory-safety bugs in QuickJS itself. Recent CVEs include heap overflows in `JS_ReadString`/`JS_ReadBigInt` (CVE-2025-46687/46688, quickjs-ng ≤ 0.9.0), use-after-frees (CVE-2025-62490/62491, CVE-2026-1144) and a `js_array_buffer_slice` over-read (CVE-2025-12745) (**docs**). Inside WASM, such a bug corrupts only the guest's linear memory: it can't reach the page or the server without a host function to abuse. That containment is the main reason WASM sandboxes are preferred over isolated-vm and vm2, whose escapes are host takeovers.

### Not measured

- Real phones; Safari's and Firefox's WASM compile time and stack depth.
- Download time over a real network.
- A Vercel cold start, as opposed to a local fresh process.
- Bundling quickjs-ng through Nitro or Vite: the WASM file has to be traced into the function and served as a client asset. This is not done here, but both are standard.
- isolated-vm on Vercel.
- A tuned production tree walker; Vue's own render cost, which dominates both designs.
- Memory after a memory bomb on a long-lived server instance.

---

## 3. Effect on the product design

| Concern                                                                                                | Baseline formula language                                                                                                                                                               | Sandboxed JS (QuickJS)                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unknown paths** (strict: error, non-strict: warning, hidden by "hide sheet warnings")                | Every path is a parsed `SheetPath` resolved through the existing `Validator.resolve()`/`step()`, so strictness, free-form `object`, `content-too-deep` and the hide flag apply for free | Paths are arbitrary JS (`data.skills[name].training`, destructuring, helper functions). Only literal `data.a.b` chains can be found, with a JS parser (acorn, ~100 KB) and a hand-written scan. Anything computed is unknown, so the checks become best effort                                                                           |
| **Type and result-type checks** (`Number` needs a number)                                              | Static (`formula-type`, `formula-result-type`)                                                                                                                                          | Runtime only: a wrong type shows up when some viewer's data triggers it                                                                                                                                                                                                                                                                  |
| **Cycles**                                                                                             | Static DFS over `$name` references                                                                                                                                                      | Runtime "stack overflow" or interrupt, with a sandbox error as the message                                                                                                                                                                                                                                                               |
| **`confirmBrokenSheets`** (`findSheetsBrokenBy` diffs error messages before and after a schema change) | Covers formulas, since their messages contain the path                                                                                                                                  | Covers only what the best-effort scan finds; a field rename silently breaks `data.oldName` in JS, which gives `undefined` → NaN/empty                                                                                                                                                                                                    |
| **Save-time validation** (`assertValidSheetMarkup`)                                                    | Parse + check, sub-millisecond, no extra dependency                                                                                                                                     | Needs QuickJS on the server to compile, and a trial run against `defaultContentData` to catch anything more (~2 ms warm, ~70 ms cold)                                                                                                                                                                                                    |
| **Editor** (CodeMirror)                                                                                | Completion for paths, functions and `$names` from the registry; diagnostics with exact positions                                                                                        | `@codemirror/lang-javascript` gives highlighting. Data-aware completion and type errors need TypeScript in a worker (several MB) or a custom scan. Positions inside `formula="…"` still need the attribute-position work                                                                                                                 |
| **Markup quoting**                                                                                     | Spreadsheet syntax avoids `&&` and `<` in attributes                                                                                                                                    | JS uses `&&`, `<`, `=>` constantly: in attributes they need `&amp;&amp;`/`&lt;`, and the `<Script>` body needs a new raw-text element in the parser (`parts()`/`text()`)                                                                                                                                                                 |
| **Vue reactivity**                                                                                     | One `computed` per formula site; Vue tracks exactly what each read; definitions memoised                                                                                                | One whole-sheet evaluation per change (a deep watch on the draft or hooks on `context.update`), then results fanned out to the field components through a reactive map. Fine at 0.5–2 ms, but every keystroke re-runs everything                                                                                                         |
| **SSR determinism and hydration**                                                                      | Pure functions, no clock, locale or random; sync; same code on both sides                                                                                                               | Same engine on both sides (good), but `Date`/`Math.random`/`toLocaleString` must be removed. **The client can only evaluate after the WASM has loaded asynchronously**: either block hydration on it (a 212 KB download plus 14–70 ms to compile) or put the server's results in the Nuxt payload and hydrate from them, a new mechanism |
| **`field` + `formula` override**                                                                       | Field value when set, else the formula; result type checked against the field type statically                                                                                           | Same rule, but the type is checked at runtime only                                                                                                                                                                                                                                                                                       |
| **`get(record, key)`**                                                                                 | Needs hardening (own keys only, no `__proto__`); the type is `any`                                                                                                                      | Native (`record[key]`), and prototype tricks stay in the guest. But it can't be checked statically, and every lookup is dynamic, which is the point of JS                                                                                                                                                                                |
| **`<Define>` with `$name`**                                                                            | First-class: named, parameterised, statically acyclic, memoised                                                                                                                         | Becomes JS functions; `$name` is redundant (JS has its own scoping), so two naming styles compete                                                                                                                                                                                                                                        |
| **Errors visible only to editors**                                                                     | Errors are values with a code, a message and the formula's position                                                                                                                     | Exceptions with QuickJS stack traces (`eval.js:1:24`). Usable for editors if each definition is compiled with a sheet line/column offset as its filename; never shown to viewers                                                                                                                                                         |
| **Missing values**                                                                                     | `null` propagates and the result is empty (decision 6)                                                                                                                                  | `undefined - 10` is `NaN` and `undefined.x` throws. To get decision 6 you need optional chaining everywhere, a guarding prelude, or a Proxy wrapper (slow in QuickJS)                                                                                                                                                                    |
| **Authoring check and AI agents**                                                                      | The skill's vitest check (`check-sheet.tmp.test.ts`) catches path and type errors before upload                                                                                         | Agents write JS fluently but reach for APIs that aren't there (`console`, `Date`, `fetch`), and only a trial run catches logic errors                                                                                                                                                                                                    |
| **Non-technical authors**                                                                              | Spreadsheet-like, small, errors at the formula                                                                                                                                          | A programming language; errors like "TypeError: cannot read property 'training' of undefined"                                                                                                                                                                                                                                            |
| **Expressiveness**                                                                                     | Fixed function list; no loops, no local variables, no data structures; aggregates over one list with one expression                                                                     | Loops, local variables, arrays and objects, recursion, string handling, any custom rule (multiclass spell slots, encumbrance variants, dice-pool logic). **The real advantage**                                                                                                                                                          |
| **API and other consumers**                                                                            | Not in the API either way (render-time)                                                                                                                                                 | Same. Later schema-level computed fields would need QuickJS for every content GET that includes them (~0.5–1 ms each, plus cold start)                                                                                                                                                                                                   |
| **What the team maintains**                                                                            | A small parser, evaluator and checker (the plan's PRs 1–2), with fuzz tests                                                                                                             | Prelude, marshaling, limits, async loading, a payload or hydration mechanism, upgrades of a WASM engine with CVEs, per-browser stack testing                                                                                                                                                                                             |

---

## 4. Security threat model (hostile sheet author vs every viewer)

| Threat                                                             | Baseline                                                                                          | Sandboxed JS (QuickJS)                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CPU exhaustion, server SSR** (one sheet, every viewer's request) | Step budget of 20,000 per evaluation, no loops or recursion; cost bounded by sheet size           | Interrupt deadline per render (it must be wall-clock and per request). Measured overrun: up to 3.3 s on Bellard's build, ~80 ms on ng. A hostile sheet costs every view up to the deadline, which is billed CPU on Fluid compute; you'd want a per-sheet "disabled after N timeouts" circuit breaker |
| **CPU exhaustion, browser**                                        | Same budget                                                                                       | Same deadline; the main thread is blocked until it fires (no Worker, since that's async)                                                                                                                                                                                                             |
| **Memory**                                                         | No constructors; strings capped at 10,000 characters                                              | `setMemoryLimit` per runtime works; WASM memory grows and never shrinks on a long-lived instance                                                                                                                                                                                                     |
| **Stack**                                                          | Call depth 16, no recursion                                                                       | `setMaxStackSize` **must** stay below the host's stack, or the host overflows (measured). It varies by browser                                                                                                                                                                                       |
| **Data exfiltration over the network**                             | No network; formulas can't feed URLs (`Image` excluded); CSS bans `url()`                         | No network inside QuickJS (measured). The same output rules are needed: results go only into text, never URLs, HTML, styles or attributes that load anything. Never give the guest a host `fetch` (quickjs-emscripten's own fetch helper is documented as sending the host's cookies)                |
| **Timing or rendering side channels**                              | Not useful without a way to send data out                                                         | Same; the author never receives the viewer's results unless output reaches a URL                                                                                                                                                                                                                     |
| **Leaks between viewers**                                          | Stateless                                                                                         | **New risk:** a context reused across viewers lets a sheet stash viewer A's data in a global and show it to viewer B in SSR. You need a fresh runtime/context per render (1.5 ms warm) or frozen globals plus a reset                                                                                |
| **Reading data the viewer can't read**                             | Only `data` plus the `refs` filtered by `loadContentRefs`                                         | Same, as long as only those are marshaled in. No host callbacks that query the database                                                                                                                                                                                                              |
| **Prototype pollution**                                            | The plan's PR 0 (`Object.hasOwn`, refuse `__proto__`) is needed anyway; it's also an existing bug | Contained in the guest (measured), but results coming out must be copied as plain JSON (not handles) and keys checked before `setSheetValue`                                                                                                                                                         |
| **Sandbox escapes (history)**                                      | No sandbox: an interpreter over its own AST that never calls anything taken from data             | QuickJS: memory-safety CVEs every year, contained by WASM. isolated-vm: guest→host escapes (2022, Aug 2026). vm2: repeated host RCEs (2023, Jan 2026), discontinued then revived. Node `vm`: not a boundary. SES: no known escapes found here, but no CPU limit                                      |
| **Supply chain**                                                   | No new dependency                                                                                 | `quickjs-emscripten-core` + one variant package + a ~500 KB opaque WASM binary from one maintainer; must be pinned and reviewed on upgrade (pnpm's `minimumReleaseAge` helps)                                                                                                                        |

The baseline's attack surface is the code the team writes and can test exhaustively (grammar, functions, budget). The JS surface is a third-party engine plus the glue around it. QuickJS-WASM is the best option of that kind, but the glue is where the bugs would be: what gets marshaled in, how results come out, context reuse, limits, and the async load.

---

## 5. A hybrid path: a later, opt-in QuickJS "Script" backend

Ship the baseline now and add, if real sheets need it, a `<Script>` section whose functions the formula language can call.

How it fits:

- The baseline already plans a function registry (`formula-functions.ts`: name, arity, parameter kinds, result type) and an `env` with `definition(name, args)`.
- A script function would be registered as a call whose implementation crosses into QuickJS: `script.multiclassSlots(classes)`, or `$name` backed by a script.
- The formula language stays the default and keeps all its static checks. Only script calls are `any` and checked at runtime.

Decide now, so this stays possible (cheap):

1. **Value model:** formula values are JSON-compatible (number, string, boolean, null, arrays, plain records). That is already the plan, so values can cross by JSON.
2. **Errors are values** (`FormulaError { code, message }`), so a script exception maps to one without changing the renderer. Already the plan.
3. **Reserve names:** the `Script` tag and `script` attribute in the registry, and a call namespace (`script.` or `@name`) in the lexer, next to the `roll`/`dice` reservations.
4. **Keep evaluation pure and synchronous, with an explicit `env`**, so a backend can be called with the same inputs. Don't let Vue objects leak into the engine: it reads plain values passed in, and `toRaw` happens at the boundary.
5. **Results are rendered only as text**, never URLs or HTML (already rule 7 of the plan). This is what keeps a JS backend safe.
6. **The `any` type and the "hide sheet warnings" policy** already cover unchecked results (`get()` set the precedent).

What the hybrid would cost when built (estimate): one Opus-tier PR of roughly the size of baseline PR 2.

- Parser support for a raw-text `<Script>` element.
- A QuickJS module loaded lazily, only for sheets that have a script (other pages pay nothing).
- A fresh context per render with limits (ng, 256 KB stack, ~20–50 ms deadline, ~8 MB memory) and a prelude that deletes `Date`/`Math.random`.
- One JSON crossing per render, or per edit with path forwarding.
- Server results in the payload, so hydration doesn't wait for the WASM.
- A size cap on script text, an editor-only error panel with line mapping, and hostile-input tests in vitest.

It could also be **client-only**: the server renders "—" for script results, and the client computes them after loading. That saves the server cold start but brings back a visible flash and a hydration special case. Not recommended unless SSR cost turns out to matter.

---

## 6. Recommendation

| Criterion                                                              | Baseline formula language                    | Sandboxed JS only (QuickJS)                                            | Hybrid later (baseline + opt-in Script)                  |
| ---------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Evaluation speed (D&D sheet)                                           | ~0.14 ms; edits 0.02–0.5 ms                  | ~0.5 ms resident / ~1 ms with copy; edits 0.5 ms (2 ms on ×4)          | Baseline speed; scripts pay QuickJS cost only where used |
| Cold start / payload                                                   | None / tens of KB                            | ~70 ms + ~25 MB per server instance; 212 KB brotli WASM on sheet pages | Only on sheets that use scripts                          |
| Static checks (paths, types, cycles, broken-sheet diff, hide-warnings) | Full                                         | Best effort, mostly lost                                               | Full for formulas; scripts are `any`                     |
| Editor support                                                         | Completion and diagnostics from the registry | Highlighting easy; data-aware help expensive                           | Both                                                     |
| SSR and hydration                                                      | Sync, deterministic                          | Needs an async-load strategy and removal of nondeterministic APIs      | Same, but only for script sheets                         |
| Expressiveness                                                         | Bounded by design                            | High                                                                   | High where needed                                        |
| Non-technical authors                                                  | Good                                         | Poor                                                                   | Good by default                                          |
| AI agents                                                              | Good with the skill's reference              | Good at writing, weaker at checking                                    | Good                                                     |
| Security surface                                                       | Own code, small, fully testable              | Third-party engine + glue; new cross-viewer and stack risks            | Same as JS, but opt-in and smaller                       |
| Team maintenance                                                       | Parser, evaluator, checker                   | Sandbox, marshaling, limits, engine upgrades                           | Both, the second only if built                           |
| Time to first useful version                                           | Plan PRs 0–2                                 | Similar or larger (sandbox + loading + checks)                         | Plan PRs 0–2, then later                                 |

**Recommendation: the baseline now, with the section 5 decisions taken so a hybrid stays possible.** Sandboxed JS alone would trade away the static checking that the schema-change confirmation, the hide-warnings option and the authoring check all depend on. It would add an engine, a WASM payload and a cold start, and buy expressiveness the planned D&D sheet doesn't need. The performance worry ("marshaling is a bottleneck") is real only for per-formula marshaling. With one crossing per render the boundary is about 0.5 ms, so performance does not decide this either way.

**Evidence that would change it:**

- Real sheets repeatedly needing what the function list can't express (loops over nested lists, per-class tables, custom dice-pool logic), or the function list growing past ~60 entries to keep up. → Build the hybrid.
- A wish for **actions and automation** (buttons that change data, macros, rolls with side effects), which is a programming problem, not a formula problem. → Script backend, probably in a Worker for interactive actions only.
- Field tests where non-technical authors mostly copy agent-written sheets anyway, so JS's unfamiliarity matters less. → JS becomes more attractive.
- quickjs-ng's WASM shrinking a lot, or a JIT-capable WASM engine appearing, together with a clean security record. → Weakens the cost argument.

**Open questions for the owner:**

1. Baseline now with the hybrid hooks (recommended), sandboxed JS only, or baseline only with no hybrid hooks?
2. If a Script backend ever ships: server and client (recommended, results in the payload) or client-only?
3. Who may write scripts: everyone, or only some users (for example site admins and official groups) at first?
4. Is "the sheet works for non-programmers" a product goal, or are sheets expected to be written by technical users and agents?

---

## Sources

- Vercel Functions limits (memory, duration, bundle size, Fluid compute billing): https://vercel.com/docs/functions/limitations
- quickjs-emscripten README (variants, limits, "has not been audited", fetch warning): https://github.com/justjake/quickjs-emscripten
- isolated-vm escape GHSA-864f-rcv7-6rh4 (fixed in 7.0.1/6.2.0): https://www.endorlabs.com/learn/ghsa-864f-rcv7-6rh4-critical-type-confusion-vulnerability-in-isolated-vm and https://thehackernews.com/2026/08/isolated-vm-flaw-lets-sandboxed.html; earlier CVE-2022-39266: https://cvefeed.io/vuln/detail/CVE-2022-39266; maintenance mode and `--no-node-snapshot`: the package README (`isolated-vm` 7.0.1)
- vm2 escapes and revival: https://nvd.nist.gov/vuln/detail/cve-2023-37466, https://thehackernews.com/2026/01/critical-vm2-nodejs-flaw-allows-sandbox.html, https://www.heise.de/en/news/JavaScript-Sandbox-vm2-Critical-Vulnerability-Allows-Escape-11158187.html
- Node `vm` is not a security mechanism: https://nodejs.org/api/vm.html
- QuickJS CVEs: https://app.opencve.io/cve/CVE-2025-46687, https://www.strix.ai/cve/CVE-2025-46688, https://www.strix.ai/cve/CVE-2025-62496, https://security.snyk.io/vuln/SNYK-CONAN-QUICKJS-13611034, https://vulners.com/search/vendors/bellard/products/quickjs
- SES / Hardened JS: https://github.com/endojs/endo/blob/master/packages/ses/docs/guide.md
- Package versions and dates: `npm view` on 2026-10-01 (quickjs-emscripten 0.32.0 Feb 2026, isolated-vm 7.0.1 Aug 2026, ses 2.3.0 Aug 2026, js-interpreter 6.0.2 Jun 2026, vm2 3.12.2 Sep 2026)

## User decisions

- Lets do baseline formulas only, with a small possibility of hybrid later if new evidence shows it would be particularly useful. We can add hybrid hooks but only if they do not pollute the codebase in the likely chance we never impliment the js side.
- If it ever ships we should do client and server.
- If it ships anyone can write scripts.
- Sheets work for non programmers is kind of a product goal. They might not know how to make modern js apps but will need to understand markup and formula languages reguardless.
- Lets go over the decisions i made last session reguarding the formula approach breifly specifially with examples to how sheet code will end up looking.
- In order to prevent neededing to add js later, it would be good to prepare the formula system to be as useful as possible. Additionally, we should be prepared to add new site-level sheet features to close gaps that would otehrwise need to be filled by custom JS. As one example, we might have build in support for an item/spell picker in content arrays so it doesnt need to be hand rolled by the user. Another example is the ability for a character to set their current class and level, and have data automatically fill the sheet based on class and level. Very complex, but could be acheiveable with enough built in sheet features and good formulas.
- We will want to test the formula system by updating the current D&D character sheet to use them. Because we lack the CLI we can write a one time script to upload it using an api key.
