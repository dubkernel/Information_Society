---
name: information-society-svelte-validator
description: Project-specific validator workflow for ~/Developer/IS Information Society Svelte app. Use when validating mission worker output in this project; runs Svelte MCP Autofixer on changed Svelte files, reviews diffs/suggestions, checks patterns in worker mistakes, and optionally consults Svelte docs.
---

# Information Society Svelte Validator

This skill augments `missions-validator` for the Information Society project at `~/Developer/IS`.

Use it whenever acting as a Mission Validator for this project, especially after a worker changes Svelte/SvelteKit code.

## Project Scope

- Repository root: `/Users/off/Developer/IS`
- Svelte app root: `/Users/off/Developer/IS/app`
- Svelte MCP server: `svelte`
- Autofixer tool: `svelte_svelte-autofixer`

## Required Validator Add-on: Svelte Autofixer Pass

During scrutiny validation, after normal tests/typechecks/linting and before final validator success/escalation reporting, run an Autofixer review on worker-touched Svelte files.

### 1. Identify Files to Check

From `/Users/off/Developer/IS`, identify changed files relative to the validation baseline. Prefer:

```bash
git status --short
git diff --name-only HEAD~1..HEAD -- app/src
```

If the worker did not commit, use:

```bash
git diff --name-only -- app/src
git diff --cached --name-only -- app/src
```

Include:

- `*.svelte`
- `*.svelte.js`
- `*.svelte.ts`
- Svelte-adjacent files that may contain snippets/runes when relevant

Prioritize changed files. Do not run a repository-wide autofix sweep unless the validator repair request explicitly requires it.

### 2. Determine Svelte Version

Read `/Users/off/Developer/IS/app/package.json` and use the installed Svelte major version. Default to `5` if unclear.

### 3. Call the Svelte Autofixer

For each selected Svelte file, read the full file and call:

```js
mcp({
  tool: "svelte_svelte-autofixer",
  args: JSON.stringify({
    code: "<full file contents>",
    desired_svelte_version: 5,
    filename: "ComponentName.svelte"
  })
})
```

Rules:

- `filename` must be only the basename, not the full path.
- Set `async: true` only when the component/module is intentionally async and the project config supports it.
- If the Svelte MCP server is not connected, run `mcp({ connect: "svelte" })` first.

### 4. Produce and Inspect a Diff

The autofixer may return suggested fixed code, textual suggestions, or diagnostics. Treat it as advisory, not automatically authoritative.

If fixed code is returned:

1. Write the proposed output to a temporary file outside the source tree, e.g. `/tmp/is-autofix/<basename>`.
2. Run a diff against the original:

```bash
diff -u /Users/off/Developer/IS/app/src/path/to/File.svelte /tmp/is-autofix/File.svelte
```

3. Review the diff manually.
4. Decide whether each change is:
   - **Accept**: clearly fixes Svelte correctness, accessibility, reactivity, typing, or idiomatic Svelte 5 usage
   - **Reject**: changes intended behavior, style, copy, data flow, or project conventions incorrectly
   - **Question**: needs documentation confirmation

If only suggestions/diagnostics are returned, map each suggestion to the relevant source lines and classify it the same way.

Do **not** blindly apply Autofixer output. Validators normally do not fix code. Use the diff/suggestions to create a scoped Validator Repair Request unless the mission explicitly permits validator edits.

### 5. Consult Svelte Documentation When Needed

When the Autofixer suggestion conflicts with project code, looks suspicious, or involves nuanced Svelte 5/SvelteKit behavior, consult Svelte MCP documentation before judging it.

Useful tools:

```js
mcp({ search: "svelte rune effect derived props bind" })
mcp({ tool: "svelte_get-documentation", args: '{"section":"..."}' })
mcp({ tool: "svelte_list-sections", args: '{}' })
```

Prefer docs for:

- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`)
- Event handling and bindings
- Snippets/render tags
- SvelteKit load/functions/forms/navigation
- Accessibility warnings
- Compiler/runtime warnings

### 6. Detect Worker Mistake Patterns

In addition to per-assertion validation, summarize any recurring Svelte-specific mistakes made by the worker, such as:

- Using legacy Svelte 4 patterns where Svelte 5 runes are expected
- Incorrect `$derived`/`$effect` usage
- Mutating non-reactive state
- Broken prop typing or `$props` destructuring
- Incorrect event handler syntax
- Accessibility regressions
- SvelteKit data-loading or form-action misuse
- Avoidable hydration/SSR assumptions

Feed these patterns back into the next scoped Validator Repair Request. Example:

```md
Worker pattern to correct in this repair pass:
- You repeatedly used legacy `export let` props in new Svelte 5 components. For the remaining unresolved item E, use `$props()` and verify with the Svelte Autofixer.
```

### 7. Integrate With the Scoped Remediation Loop

The Autofixer pass participates in the validator ledger:

- If Autofixer confirms changed files are clean, record that evidence under the relevant verified assertions.
- If Autofixer finds issues related to unresolved assertion D/E, include them in the repair request for D/E only.
- If Autofixer finds an unrelated issue in already verified A/B/C, only reopen A/B/C if the issue is a real regression or correctness problem, not stylistic churn.
- If the Autofixer is unavailable, document that as validation evidence and continue with normal tests/docs review; do not block success solely because MCP was unavailable unless Svelte correctness is central to the assertion.

## Validator Repair Request Addition

When sending a repair request for this project, include a Svelte Autofixer section:

```md
## Svelte Autofixer Review

Files checked:
- app/src/.../Component.svelte

Accepted Autofixer findings to address:
- <file>: <finding and expected fix>

Rejected/questioned Autofixer findings:
- <file>: <finding, why rejected or docs consulted>

Worker mistake patterns to avoid:
- <pattern>
```

## Final Success Report Addition

When all assertions pass, include:

- Which Svelte files were checked with `svelte_svelte-autofixer`
- Whether autofixer produced no findings, accepted findings that were repaired, or findings intentionally rejected
- Any documentation consulted to resolve disputed autofixer suggestions
- Any worker mistake patterns observed and corrected during repair passes
