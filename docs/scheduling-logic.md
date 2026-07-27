# How the scheduling logic actually works

This is a working-notes doc from a code review pass (2026-07), not original design docs — the
codebase doesn't have any. All line numbers refer to `legacy/admin_portal_current_m46.gs`.

## The core engine is genuinely solid

The heart of it is `buildAssignmentsV5_(model)` (~line 2676), called once per bell schedule
item (period). It's a **multi-pass greedy priority assignment**, not a full constraint solver
(no backtracking) — passes run in this fixed order per period, each filling in whatever the
previous pass left unassigned:

1. `applyPriorityHoldsV5_` — honors any pre-locked/held assignments.
2. `assignForcedRestStaffDirectSupportV5189_` — staff on forced rest can still provide direct
   support under specific rules.
3. `assignByPreferenceV5_` — tries each student's preferred primary/secondary staff first.
4. `assignByGeneralPoolV5_` — falls back to the general staff pool.
5. If `model.config.shuffleStaffToAvoidUncovered` is on: `runIndividualStarRescueV5_` and
   `runSimpleSwapRescueV5_` — rescue passes that reshuffle existing assignments to try to
   cover students still unassigned after the first four passes.
6. `applyAssignmentOptimizationPostPeriodV5_` — applies any accepted "Assignment Genie"
   optimization (see below) for this period.

Students are processed in priority order via `compareNeedPriority_` (~line 4764): lower
`priority` number goes first, ties broken alphabetically by name. Room "structure" (highly
structured vs. not) and support type (`Individual` vs `Group`) both factor into which passes
can place a student.

**Every unassigned student gets a real explanation, not just a "no."** For each one,
`buildUnassignedDecisionContextV512_` (~line 3180) records which staff were considered and why
each was rejected (`rejectionSummary`), plus a top-line `decisionReason`. That's genuinely good
engineering — it's the difference between "the algorithm failed" and "here's exactly why, and
which lever to pull." It's surfaced in the Admin UI as the Assignment Analyzer.

**Lunch has its own outer loop.** `buildAssignmentsBreaksWithEmergencyLunchV5_` (~line 2613)
runs the full assignment once, and if lunch still has uncovered students and emergency lunch
coverage is enabled, adds overtime-interested staff one at a time, reruns the *entire*
assignment after each addition, and keeps whichever run left the fewest students uncovered.

**"Assignment Genie"** (`runAssignmentGenieV5`, ~line 19915) is a second, separate feature: it
runs the base assignment, looks at everyone still unassigned, and generates ranked *suggestions*
for temporarily relaxing specific rules (raise a group cap, reclassify a student from
Individual to Group for one period, etc.) — each suggestion shows exactly which rule change
would cover which students, ranked by how invasive the change is. The admin picks one, it gets
applied, and the assignment reruns.

None of this core model/engine code (the `V5_`-suffixed functions above) appeared duplicated
during this review — it looks like it was written carefully and largely left alone. That's not
true of the layer around it (next section).

## The problem isn't the engine — it's ~3,300 lines of dead code shadowing it

The *display and API layer* wrapping that engine — status lookups, dashboard tiles, fast-path
cache readers (`...FastV686m17`, `...FastV5195`, etc.) — has been rewritten in place over and
over by giving the new version the **same function name** instead of editing or removing the
old one. In JavaScript, when a script declares `function foo(){}` twice at the top level, the
second declaration silently wins — the first is fully unreachable dead code, not just "old,"
but code that literally cannot execute even though it reads like it's live.

A scan of the file found **97 function names defined more than once** at the top level — some
up to 8 times (`getSchedulePublishStatusV5`). Counting from the start of each shadowed
definition to the start of the next top-level function as a rough size estimate:

| | |
|---|---|
| Shadowed (dead) function definitions | 181 |
| Estimated dead lines | ~3,331 |
| Share of the 40,745-line file | ~8.2% |

Worst offenders by dead line count: `getStudentManagerDataV5` (3 defs), `getAttendanceManagerDataV542`
(4 defs), `getStaffManagerDataV5` (5 defs), `getPortalScheduleViewsFastV5256` (6 defs),
`getScheduleDisplayPageFastV686j` (7 defs), `getSchedulePublishStatusV5` (8 defs).

This is why the period-label bug (see `CHANGELOG.md`, v0.54.18aq1) took 5 patch files to not
quite fix: the working pattern in this codebase has been "add a new version" rather than "fix
the existing one," which is exactly how you end up with a correct-looking old copy sitting
right next to the one that actually runs, fooling anyone who edits the wrong one.

**This is safe to clean up but wasn't done in this pass** — it needs care per function (confirm
brace boundaries, confirm nothing outside the shadowed body is referenced, e.g. a helper
defined only inside the dead copy) rather than a blind bulk delete. Happy to do it as a
dedicated pass if useful — it's mechanical but needs to be done one function at a time with a
syntax/behavior check after each.
