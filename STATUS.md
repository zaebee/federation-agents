# UIA-CORE-001 — Repository Status

**Verified at:** commit `f478d5c`, 2026-10-31.
**Scope:** the reference implementation and its conformance evidence in this repository.
**Authority:** the audit trail under [`docs/audits/`](docs/audits/). This file summarises it and links to it; it does not replace it.

## Where the project is

Stage: **post-audit disposition**. The implementation through immediate merge closure is complete and the local check matrix is green, but conformance as a whole is not established and a frozen baseline is **NOT READY**.

What remains is not a backlog of missing code paths. It is two kinds of work:

1. **Normative decisions** the specification leaves open. They cannot be implemented without inventing protocol semantics.
2. **Evidence closures** that a re-audit must sign off, including the C-1 case whose evidence postdates the audit.

## At a glance

| Measure               | Value                                                                    | Source                                      |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| §12 cases             | 13 PASS, 2 PARTIAL (D-1, D-4), 2 BLOCKED (C-2, D-2), 1 NOT COVERED (C-1) | Task 17 conformance matrix                  |
| Requirements          | 152 PASS, 8 PARTIAL, 7 BLOCKED, 8 NOT COVERED, 0 FAIL (175 total)        | Task 17 requirement matrix                  |
| Decisions             | 2 APPROVED, 13 OPEN                                                      | Task 18 decision register                   |
| Non-PASS items closed | 0 of 23; remediation implemented: 1 task (T18-02A)                       | Task 18 disposition and remediation roadmap |
| Readiness             | `NOT_READY`                                                              | Task 18 §7                                  |
| Local check matrix    | green — 553 tests, 550 pass, 3 todo, 0 fail, 3430 expectations           | `bun test` at the commit above              |

Two statuses need a caveat:

- **C-1** is recorded as NOT COVERED by the audit because at the audited commit no Assessment recorded `PARENT_UNRESOLVED`. The evidence now exists (T18-02A: adapter, Core validation and admission, two passing tests). Until a re-audit revision records it, this file reports the audit status, not the code's capability.
- **D-4** gained a future-authorization boundary test after the audit; that test does not assert §12 D-4's second MUST, so the PARTIAL status stands.

## Check matrix

| Command                  | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `bun test`               | all suites: unit, conformance (§12), property, experimental |
| `bun run lint`           | ESLint                                                      |
| `bun run typecheck`      | `tsc --noEmit` for `tsconfig.json` and `tsconfig.core.json` |
| `bun run format:check`   | Prettier, check only (never `format` during verification)   |
| `bun run build`          | emit `./build`                                              |
| `bun run check:lockfile` | lockfile matches `package.json`                             |

All of them must be green before a change is "done". CI runs exactly this sequence (`.github/workflows/ci.yml`).

## Blocked semantics — do not schedule as implementation

These are undefined in Rev 0.3.3. Implementing them silently would turn an interpretation into a protocol rule:

| ID   | Item                                     | Current behaviour                                                                                   |
| ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A-4b | Contradiction / `CONTESTED` detection    | No default rule; reachable only through an explicitly configured policy hook                        |
| A-5  | Recursive merge closure inside branches  | Immediate closure only; nested-merge behaviour pinned only by an experimental, non-conformance test |
| A-11 | Closure over a `MERGED_FROM` origin node | Conservative default; experimental test only                                                        |
| A-9  | Trusted-time mechanism                   | Trust arrives only as an external assessment; the core never derives it                             |

## Open decisions blocking progress

- **Two P1 decisions have prepared recommendations and await approval:** `T18-DEC-06` (contradiction predicate) and `T18-DEC-07` (closure depth).
- **The C-2 subject model has no decision ID at all.** It blocks `T18-02B`, and therefore C-2.
- **Publication and retention ownership** of an Assessment is open; it decides where an assessor's record may live.
- Thirteen decisions are OPEN in total — see [`decision-register.md`](docs/audits/2026-10-31-core-001-task-18/decision-register.md).

## Where status lives

| Question                                               | Document                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| What does the code do?                                 | [`docs/implementation.md`](docs/implementation.md)                                                           |
| Why is the architecture shaped this way?               | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                               |
| What is the protocol requirement?                      | [`docs/CORE-001.md`](docs/CORE-001.md)                                                                       |
| What was audited, at which commit, and what was found? | [`docs/audits/2026-10-31-core-001-task-17/`](docs/audits/2026-10-31-core-001-task-17/)                       |
| What is each gap dispositioned to?                     | [`docs/audits/2026-10-31-core-001-task-18/`](docs/audits/2026-10-31-core-001-task-18/)                       |
| What is planned, and in what order?                    | [`docs/ROADMAP.md`](docs/ROADMAP.md) and the Task 18 remediation roadmap                                     |
| How was each plan task closed?                         | [Implementation plan](docs/superpowers/plans/2026-10-30-uia-core-001-implementation.md) — historical tracker |

Open implementation findings that are not part of the conformance audit are filed as GitHub issues. The audit trail remains the authority for conformance status; issues do not change it.

## How to refresh this file

1. Run the check matrix at the commit you are describing.
2. Read the latest audit revision. If a newer revision exists, prefer it over the numbers here and update them.
3. Update "Verified at", the counts and the date. Do not add a number that no run produced.
