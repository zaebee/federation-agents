# UIA-CORE-001 — Repository Status

**Verified at:** commit `c63f288`, 2026-10-31.
**Scope:** the reference implementation and its conformance evidence in this repository.
**Authority:** the audit trail under [`docs/audits/`](docs/audits/). This file summarises it and links to it; it does not replace it.

## Where the project is

Stage: **post-audit disposition**. The implementation through immediate merge closure is complete and the local check matrix is green, but conformance as a whole is not established and a frozen baseline is **NOT READY**.

What remains is not a backlog of missing code paths. It is two kinds of work:

1. **Normative decisions** the specification leaves open. They cannot be implemented without inventing protocol semantics.
2. **Evidence closures** the audits name — C-2 and D-2 blocked, D-1/D-4 partial, §16 independent compatibility absent — plus the open §8.8 reading inventoried as N-176 in audit revision 1.

## At a glance

| Measure            | Value                                                                                                                                                                      | Source                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| §12 cases          | 14 PASS, 2 PARTIAL (D-1, D-4), 2 BLOCKED (C-2, D-2), 0 NOT COVERED                                                                                                         | Task 17 audit, revision 2              |
| Requirements       | 154 PASS, 9 PARTIAL, 8 BLOCKED, 5 NOT COVERED, 0 FAIL (176 total)                                                                                                          | Task 17 audit, revision 2              |
| Decisions          | 4 APPROVED (incl. `T18-DEC-16`/`T18-DEC-17`), 13 OPEN                                                                                                                      | Task 18 decision register              |
| Non-PASS items     | 22 in revision 2 (23 at the Task 17 baseline): N-138 and N-143 closed, N-176 new and not yet dispositioned by Task 18; remediation implemented: 2 tasks (T18-02A, T18-02B) | Task 18 disposition + audit revision 2 |
| Readiness          | `NOT_READY`                                                                                                                                                                | Task 18 §7                             |
| Local check matrix | green — 596 tests, 593 pass, 3 todo, 0 fail, 3713 expectations                                                                                                             | `bun test` at the commit above         |

Four statuses need a caveat:

- **C-1 is PASS in audit revision 1.** Task 17 recorded it as NOT COVERED because at its commit no Assessment recorded `PARENT_UNRESOLVED`; revision 1 re-audits all four C-1 assertions at `1440ca4` and moves the case to PASS. The PASS covers construction and admission only: retention and publication remain caller-managed and `T18-DEC-15` / the publication-ownership question stay OPEN, outside §12 C-1's Expected Result.
- **§8.8 is PARTIAL in audit revision 1.** The revision inventories the §8.8 `MUST NOT` about explicit path enumeration as N-176; `discoverPaths` enumerates every simple path, so the requirement is not satisfied on the literal reading. Whether the public per-path result makes enumeration part of the required result is the open question in #25 / `T18-SPEC-01`.
- **C-2.a2 is PASS in audit revision 2.** T18-02B implemented the approved `T18-DEC-16` Option D emission; revision 2 moves N-143 and `CASE-C-2.a2` to PASS. The C-2 **case** stays BLOCKED on `CASE-C-2.a3` (CORE-003 / `T18-DEC-13`), and the self-loop sub-decision remains OPEN.
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
- **`T18-DEC-16` and `T18-DEC-17` are approved (2026-10-31).** DEC-16 approves Option D — one Assessment per affected lineage edge (`subject_version_id` = child, `parent_version_ids` = `[parent]`, `CYCLE_DETECTED` in `unverified_claims`; adapter constructs, Core validates/admits, caller persists) — and unblocks `T18-02B`. DEC-17 assigns publication and retention to the caller boundary. Approval does not make the subset `parent_version_ids` reading normative (`T18-DEC-15` stays OPEN), and `T18-02B` + AEBE are still required before N-143/CASE-C-2.a2 pass.
- **`T18-DEC-15` remains OPEN.** It asks whether `parent_version_ids` must be the complete declared parent set or may be the covered subset; the `T18-DEC-16` approval permits the local Option D implementation but does not resolve it.
- Thirteen decisions are OPEN in total — see [`decision-register.md`](docs/audits/2026-10-31-core-001-task-18/decision-register.md).

## Where status lives

| Question                                               | Document                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| What does the code do?                                 | [`docs/implementation.md`](docs/implementation.md)                                                           |
| Why is the architecture shaped this way?               | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                               |
| What is the protocol requirement?                      | [`docs/CORE-001.md`](docs/CORE-001.md)                                                                       |
| What was audited, at which commit, and what was found? | [`docs/audits/2026-10-31-core-001-task-17/`](docs/audits/2026-10-31-core-001-task-17/)                       |
| Which audit revision is current, and what changed?     | [`docs/audits/2026-10-31-core-001-task-17-revision-2/`](docs/audits/2026-10-31-core-001-task-17-revision-2/) |
| What is each gap dispositioned to?                     | [`docs/audits/2026-10-31-core-001-task-18/`](docs/audits/2026-10-31-core-001-task-18/)                       |
| What is planned, and in what order?                    | [`docs/ROADMAP.md`](docs/ROADMAP.md) and the Task 18 remediation roadmap                                     |
| How was each plan task closed?                         | [Implementation plan](docs/superpowers/plans/2026-10-30-uia-core-001-implementation.md) — historical tracker |

Open implementation findings that are not part of the conformance audit are filed as GitHub issues. The audit trail remains the authority for conformance status; issues do not change it.

## How to refresh this file

1. Run the check matrix at the commit you are describing.
2. Read the latest audit revision. If a newer revision exists, prefer it over the numbers here and update them.
3. Update "Verified at", the counts and the date. Do not add a number that no run produced.
