# AGENTS.md

## Purpose

This repository is for **Information Society**, an open-source agentic networking application. The product helps a user understand who they know, who those people know, which companies matter, what interactions have happened, and what the next high-value networking action should be. The app is not a generic chatbot and not a generic CRM. It is a relationship-intelligence system with agentic workflows layered on top of a strongly typed product stack.

The intended architecture is **Svelte + TypeScript + Convex**. The frontend should feel like a serious product UI for managing people, companies, relationship paths, notes, opportunities, and suggested actions. The backend should expose a narrow, validated, secure API and keep most business logic in plain TypeScript helper functions rather than bloated endpoint wrappers.

## Primary goals for coding agents

When working in this codebase, optimize for the following in order:

1. **Preserve domain meaning.** Always understand whether a change affects people, companies, relationships, interactions, introductions, follow-ups, or recommendations.
2. **Preserve type safety.** Do not “fix” difficult TypeScript errors by widening types to `any`, deleting validators, or weakening data contracts.
3. **Respect Convex architecture.** Keep public functions thin, validated, access-controlled, and index-aware.
4. **Respect Svelte idioms.** Prefer small composable components, explicit props, and framework-native patterns over React-isms.
5. **Prefer inspectable agent behavior.** The system should make recommendations and automations understandable rather than magical.
6. **Make small, testable edits.** Agentic coding performs best when tasks are scoped, verified, and iterated with compiler/runtime feedback.

## What strong coding agents are good at

Strong coding agents are most useful when they can perform long-horizon interaction with tools, reason over repo-scale context, and work through execution-feedback loops. Many modern model families support long context windows and have been trained or tuned on repository-level code, pull requests, code review data, and diverse tool-call formats rather than only single-file completion tasks.

That matters for this project because the stack combines a typed frontend framework, a generated API surface, and a backend model with runtime validation and deployment semantics. Different coding agents will have different strengths, but all of them are more likely to succeed when tasks are scoped clearly, tool use is grounded in the local repository, and changes are verified with compiler or runtime feedback.

## Known weaknesses to compensate for

### TypeScript weaknesses common to coding agents

Coding agents often struggle with strict TypeScript projects in recurring ways: they omit imports, misuse utility types, overcomplicate generics, ignore `tsconfig` constraints, and replace uncertainty with `any` or loose object types. They also do worse when they do not get immediate compiler feedback, which means speculative edits must be followed by typechecking and linting rather than trusted on first draft.

For this repository, the correct response to a type error is usually one of the following:

- Add or correct imports.
- Narrow the type at the source.
- Extract a reusable domain type.
- Align runtime validators and TypeScript types.
- Refactor the function boundary.

The wrong response is to silence the problem with `as any`, non-null assertions, or by deleting useful strictness.

### Svelte weaknesses common to coding agents

Coding agents are often overfit to React examples. In Svelte codebases they may introduce React-like mental models, over-centralized state, unnecessary abstractions, or component patterns that fight the framework. Convex’s Svelte integration also uses generated API imports and Svelte-specific client hooks, so agents must check real local usage patterns before copying assumptions from React/Next.js ecosystems.

In this repository, agents should:

- Prefer existing project conventions over generic web advice.
- Reuse local Svelte patterns for stores, props, derived values, and data fetching.
- Avoid inventing React-only concepts such as hook wrappers unless a local equivalent already exists.
- Keep UI logic simple and let Convex own the server-side truth where appropriate.
- Keep track of created files and their purposes
- Maintain a clean working directory throughout execution

### Convex weaknesses common to coding agents

Convex is straightforward once its rules are respected, but coding agents commonly break those rules. The major failure modes are: using `.filter` when an index or plain TypeScript filtering is more appropriate, collecting unbounded result sets, skipping argument validators, skipping access control, overusing `ctx.runQuery`/`ctx.runMutation`, and placing too much logic directly inside public functions.

Agents also frequently miss the distinction between public and internal functions. Convex recommends that scheduled work and `ctx.run*` calls target internal functions, and that most real logic live in plain TypeScript helpers, often in a model layer, with query/mutation/action wrappers kept thin.

## Local stack documentation

Context7 snapshots for this project’s primary stack are saved in `.dev/docs/`:

- `.dev/docs/sveltekit-context7.md`
- `.dev/docs/convex-context7.md`

Consult these local docs before making SvelteKit or Convex changes, and refresh them with Context7 when stack behavior is uncertain or version-sensitive.

## Architecture assumptions

Unless the repository clearly proves otherwise, assume the following design:

- **Frontend:** Svelte or SvelteKit with TypeScript.
- **Backend:** Convex with generated API bindings.
- **Domain model:** people, companies, relationships, interactions, notes, opportunities, recommendations, and possibly communication-channel events.
- **Product direction:** relationship intelligence, recommended next actions, and inspectable agent workflows rather than freeform chat alone.

If the repository’s actual structure differs, follow the code over this document. This file is a steering document, not a license to overwrite local truth.

## Non-negotiable coding rules

### 1. Never weaken the type system casually

Do not introduce `any`, broad `Record<string, unknown>`, or type assertions unless there is a concrete, explained reason. Prefer `unknown` over `any` when handling external or partially trusted data, then narrow it intentionally.

When a function is hard to type, first try reducing its surface area. Split long functions, name intermediate types, and move validation to the boundary.

### 2. Convex public functions must be validated

All public `query`, `mutation`, and `action` functions must define argument validators. If a function is externally reachable, assume hostile inputs and validate accordingly.

If an edit introduces a new public API without validators, that edit is incomplete.

### 3. Convex public functions must enforce access control

Public functions should check identity and authorization using `ctx.auth.getUserIdentity()` or another unspoofable capability. Never rely on user-supplied identifiers like email for authorization decisions.

If a change touches relationship data, notes, or communication history, perform an explicit authorization review.

### 4. Keep business logic out of endpoint wrappers

Most reusable logic should live in plain TypeScript helper functions. Convex wrappers should mostly validate input, authorize access, and call helper functions. This improves testability, reduces duplicated `ctx.run*` chains, and gives coding agents a clearer place to edit domain logic.

A good default layout is:

- `convex/schema.ts` for tables and indexes.
- `convex/<domain>.ts` for thin public/internal wrappers.
- `convex/model/<domain>.ts` for core logic.
- `src/lib/` or `src/lib/domain/` for frontend/domain utilities.

### 5. Query by index, not by wishful thinking

Do not scan whole tables unless the result set is guaranteed small. Use `withIndex`, pagination, limits, denormalization, or feature redesign before accepting unbounded `.collect()` patterns.

If a feature needs sorting or filtering by a field repeatedly, add or revise indexes deliberately. When adding an index, also check whether it makes an older prefix index redundant.

### 6. Prefer internal functions for internal orchestration

Scheduled work, background processing, and `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` flows should use `internal.*` functions unless there is a clear reason not to. Public functions are attack surfaces and should remain tightly audited.

### 7. Use `runAction` sparingly

If code can be a plain TypeScript helper function in the same runtime, do that instead of introducing `runAction`. Convex explicitly recommends using `runAction` mainly when crossing runtimes, such as Node-specific requirements.

### 8. Await promises explicitly

Do not leave floating promises in Convex or frontend code. Convex specifically warns that unawaited promises can cause missed scheduling, missed errors, and surprising behavior.

## Agent workflow for safe edits

For any non-trivial task, follow this loop:

1. **Read before writing.** Inspect adjacent files, generated API imports, schema/index definitions, and the nearest existing feature with similar behavior.
2. **Find the true boundary.** Decide whether the change belongs in the Svelte UI, frontend domain logic, Convex wrapper, Convex model helper, or schema.
3. **Make the smallest complete edit.** Avoid cross-cutting rewrites unless the task explicitly calls for them.
4. **Run verification immediately.** At minimum run TypeScript checks, lint, and any relevant tests after the edit.
5. **Repair root causes, not symptoms.** If one change causes widespread type failures, identify the contract mismatch instead of papering over downstream sites.
6. **Summarize assumptions.** If a design choice is ambiguous, leave a concise note in the commit/PR summary or task log.

Coding agents perform best when they can interact with tools, receive feedback, and iterate. Do not ask an agent to do “one giant perfect rewrite” if a sequence of verified edits is possible.

## How to work well with Svelte + Convex

### Frontend rules

- Prefer strongly typed props and exported component APIs.
- Keep components focused; extract repeated UI, not speculative abstractions.
- Treat server data as authoritative and minimize duplicate client-side canonical state.
- Reuse generated Convex API bindings rather than hardcoding names or ad hoc fetch layers.

### Data-fetching rules

- Use the project’s existing Convex-Svelte integration patterns for queries and mutations.
- Verify import paths for generated `api` modules relative to the real file location; do not guess them.
- In SvelteKit contexts, be aware that Convex setup may need framework-specific path/layout choices, especially when source directories are constrained by the framework.

### Schema rules

- Name tables and indexes to reflect domain concepts, not UI screens.
- Prefer composable indexes that support the most important product questions: by user, by company, by relationship strength/state, by recency, by recommendation status, and by next-action timing.
- Add indexes only when justified by real query shapes, and review whether any prefix indexes become redundant.

## Domain modeling guidance for Information Society

When the repository is ambiguous, bias toward a domain model that supports these objects cleanly:

- `people`
- `companies`
- `relationships`
- `interactions`
- `notes`
- `opportunities`
- `recommendations`
- `introductions` or introduction edges/events

Likely relationship-oriented queries include:

- recent interactions for a person
- all people connected to a company
- warm paths from current user to target person/company
- stale relationships needing follow-up
- recommendations awaiting user review

That means agent changes should usually preserve or improve:

- traceability of why a recommendation exists
- recency-aware querying
- explicit ownership and authorization
- future support for messaging/import/enrichment integrations

## Prompting and task decomposition guidance for agent harnesses

When assigning work to coding agents in this repository, use prompts that are:

- **Local:** name the exact files or folders likely involved.
- **Contract-aware:** mention the relevant schema, API, or component interface.
- **Verification-bound:** require `tsc`, lint, and test output or at least note which checks were run.
- **Scoped:** ask for one coherent feature or one bugfix, not a repo-wide cleanup.
- **Framework-specific:** explicitly say “Svelte, not React” and “Convex with validators and internal/public distinction” when relevant.

Good task framing example:

> Add a `recommendations.listForInbox` Convex query with argument validators and auth checks, implement the core selection logic in `convex/model/recommendations.ts`, use an index rather than table scan if recommendation status is filtered, then wire the existing Svelte inbox view to consume it. Finish by running typecheck and lint and report any remaining issues.

Bad task framing example:

> Refactor the networking app backend and improve the UI.

## PR review checklist for agent-authored changes

Reject or revise changes that do any of the following:

- Replace specific types with `any`.
- Add public Convex functions without validators.
- Add public Convex functions without auth checks.
- Use `api.*` for internal scheduling/orchestration where `internal.*` is appropriate.
- Introduce unbounded `.collect()` or `.filter()` misuse on queries.
- Copy React patterns into Svelte without clear local precedent.
- Hardcode generated API paths or names without checking the repository.
- Put large amounts of business logic directly in query/mutation/action wrappers.
- Fix a type issue by suppressing strictness rather than aligning contracts.

Prefer changes that:

- reduce wrapper complexity
- strengthen types and validators
- improve index usage
- make recommendation logic easier to inspect
- add narrow, meaningful tests
- preserve product-domain clarity

## Repository hygiene expectations

Agents should leave the repo in a better state than they found it, but only within the task scope. That means:

- no dead imports
- no stale commented-out code
- no unexplained TODOs
- no generated files committed unless the repo expects them
- no mixed unrelated refactors bundled into one change

When editing generated Convex surfaces, respect the generator workflow and do not hand-edit generated artifacts unless the repository explicitly documents that approach.

## Final instruction to all agents

This project sits at the intersection of a strict TypeScript codebase, a Svelte frontend, and a Convex backend with strong architectural opinions. Coding agents can succeed here across multiple model families, but only if they work with the stack rather than against it: read the local patterns, make narrow edits, validate aggressively, and treat types, validators, indexes, and auth as part of the product itself rather than incidental ceremony.
