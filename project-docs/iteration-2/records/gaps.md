# Gaps — Everything NOT RECORDED Across This Record Set

**Date flagged: 2026-10-08** (all items below, unless otherwise noted)
**Updated: 2026-10-08 end of day** — item 8 resolved (PR #82 merged); item 4 reconfirmed still open
(PR #83 repeated the same unlinked-issue pattern and was still approved/merged); item 22 added
(PR #86 opened today, awaiting review).

This file is the honest summary of everything that could NOT be verified from GitHub (`gh`/`git`)
or committed repo docs while building `project-facts.md`, `product-backlog.csv`,
`sprint-backlog.csv`, `deviations.md`, `scrum-meetings.md`, `retrospective.md`, `github-audit.csv`,
`test-log.csv`, `architecture-log.md`, `iteration-3-inputs.md`, and `demo-log.md`. Per the spec's
own rule, nothing below was inferred or invented to fill the gap — it is listed here instead.

Items are grouped by severity for triage, since some block specific report sections outright.

---

## BLOCKING — Cover Page

1. **Report due date.** No document gives an explicit "report due" date distinct from the sprint
   end date (Nov 1) or the "Final Report Review Call" (Oct 31) listed in `scrum-notes.md`'s
   Ceremony Index. **Who can supply it:** whoever (instructor/course) sets the actual due date —
   likely Tharun Swaminathan (Scrum Master) or the team as a whole would know this from the course
   syllabus, which isn't in the repo.

2. **Iteration 3 Scrum Master — single-source confirmation.** Arthur Elly Lim is named in
   `report-cover-page.md` (an Iteration-1-era doc) but no Iteration-3-specific document
   corroborates this independently. **Who can supply it:** Arthur Elly Lim or Tharun Swaminathan
   (current Scrum Master) could confirm/reconfirm this in a fresh doc.

## BLOCKING — GitHub Collaboration / Audit

3. **Arthur Elly Lim's commits are not independently attributable from git/GitHub identity.**
   All of his Oct 2–8 activity is recorded under the shared `Error404IsFound` GitHub login, with
   commit author emails split between a personal Gmail address (`syntx404ae@gmail.com`) and the
   GitHub noreply address tied to that login. There is no way, from `gh`/`git` alone, to prove
   that every one of these commits/PRs/reviews was actually performed by Arthur and not another
   team member also using that shared account. This is flagged explicitly in `project-facts.md`,
   `github-audit.csv`, `deviations.md` (D-4, D-5), and `architecture-log.md`, per the task's
   explicit instruction. **Who can supply resolution:** Arthur Elly Lim would need to start
   committing under his own personal GitHub account for future iterations; retroactively, only
   the team's own memory of who was at the keyboard could resolve past commits, which GitHub
   cannot verify.

4. **Charts feature has zero filed GitHub issues — still true as of 2026-10-08 close, and the
   pattern repeated today.** `gh issue list` returns no `[Charts]`-titled or `feature:charts`-
   labeled issue at all. PR #83 (merged 2026-10-08T15:44:40Z, Raniya Shaikh reviewing) is the Oct 8
   instance: its body has `## Closes` / `Closes #` with the issue number left blank, and it was
   approved and merged without that being raised as a blocker. Every PR touching charts work (#50,
   #69, #70, #76, #83) lacks a "Closes #"/"Part of #" reference. **Who can supply it:** Arthur Elly
   Lim (owner of the charts feature) needs to file these issues retroactively or going forward;
   Tharun Swaminathan (Scrum Master) is positioned to enforce it per the team's own Definition of
   Done — and reviewers (today, Raniya Shaikh) could also decline to approve until an issue link is
   added.

5. **Direct pushes to `main` / force pushes.** `gh`/`git` as queried in this pass surfaced no
   evidence either way beyond what merge-commit history shows (i.e., no bypass of the PR process
   was visible in the commit graph). This is not the same as a confirmed "zero direct pushes"
   finding — a full server-side audit log (e.g. GitHub's organization audit log, which requires
   org-admin access this session does not have) was not queried. **Who can supply it:** a repo/org
   admin (likely Raniya Shaikh, who set up the branch-protection ruleset, or whoever has admin
   rights) could pull the GitHub audit log.

6. **Issue comment authorship/counts per member per day.** `github-audit.csv` notes this was not
   queried per-issue in this pass (would require 44 separate `gh issue view <n> --json comments`
   calls). **Who can supply it:** re-run a per-issue comment query; any team member can also just
   look at the Issues tab.

7. **Branch creation timestamps (as opposed to first-commit timestamps).** `git`/`gh` don't expose
   a branch-creation event distinct from its first commit's timestamp in the data pulled here.
   `github-audit.csv`'s per-day branch columns are therefore inferred from first-commit dates, not
   a true "branch created at" timestamp. **Who can supply it:** GitHub's events API
   (`gh api repos/.../events`) might carry `CreateEvent` records if still within retention —
   not queried in this pass.

## BLOCKING — Quality Assurance / Testing

8. ~~**The "151/152 passing" claim is disputed, not resolved.**~~ **RESOLVED 2026-10-08.** PR #82
   (Sesha Siva Sankar review, APPROVED 2026-10-08T21:46:05Z; merged 2026-10-09T03:20:59Z) retracted
   the claim in `project-docs/testing-framework.md` and replaced it with a dated table of actual
   per-run counts (Oct 5/Oct 7, by project), explicitly attributing the Oct 7 `api` suite failures
   to the PR #72 `withholdingTax` build break rather than real test regressions. `main` no longer
   carries the unverifiable claim.

9. **No coverage report found anywhere in CI.** `gh run list`/`statusCheckRollup` only exposes
   pass/fail per named check (`build`, `build_and_push`); no coverage percentage or per-module
   coverage artifact was found. **Who can supply it:** whoever owns the CI workflow (Raniya
   Shaikh, per PR #49) would need to add a coverage-reporting step if the report wants per-module
   numbers.

10. **"Integration pass #1 / #2" terminology could not be located anywhere** — not in issues, PRs,
    or docs searched. **Who can supply it:** whoever originally used that phrase (not identified)
    — possibly this refers to something not yet written down, or a different project's
    terminology; worth asking the team directly before assuming it applies here.

11. **Individual test names/assertions for `withholding-tax-migration.spec.ts`** were not
    extracted (file's existence was confirmed, content was not read line-by-line in this pass due
    to time). **Who can supply it:** re-run `git show` on that file; Tharun Swaminathan (tax
    owner) would also know its contents directly.

12. **The exact isolated withholding-tax-persistence test count** (as opposed to the full
    `test:api` suite total of 254 tests/58 suites reported in PR #80's body) was not separately
    confirmed. **Who can supply it:** Tharun Swaminathan, or re-run the specific spec file.

## NON-BLOCKING but material

13. **`scrum-notes.md` has no entries for Oct 6, 7, or 8**, despite the Ceremony Index scheduling
    standups on all three dates (Oct 8 additionally marked "Week 1 Check"). This means attendance,
    facilitator, live blockers, and whether the Oct 7 CI incident (PR #72 breaking `main`) was
    raised at a standup are all NOT RECORDED for those three days. **Who can supply it:** Tharun
    Swaminathan (Scrum Master, owns the weekly notes commit per the file's own "Weekly Friday Notes
    Commit" rule — the next one may be due around Oct 9, which could explain rather than excuse
    the gap).

14. **Attendance fields in the Oct 2 and Oct 5 entries that DO exist are also blank templates** —
    the `Sesha:`/`Tharun:`/`Arthur:`/`Raniya:` lines were never filled in with actual names/notes,
    even though the entries exist. **Who can supply it:** whoever ran those two meetings
    (presumably Tharun Swaminathan) would need to backfill from memory, or the team accepts this
    as a permanent gap.

15. **Priority and estimate fields are not set on any of the 44 GitHub issues reviewed** — no
    label or custom field carries this info, so every row of `product-backlog.csv` shows "NOT
    RECORDED" for both. **Who can supply it:** each feature owner, retroactively adding
    priority/estimate labels or fields to their own issues.

16. **Per-issue change history (edits, retitles, reassignments)** was not pulled — would require
    `gh issue view --json timeline` or similar per issue, not done in this pass for all 44 issues.
    **Who can supply it:** re-run a per-issue timeline query if the report needs this level of
    detail.

17. **Retrospective and in-class demo have not happened yet** — both files say so explicitly
    (`retrospective.md`, `demo-log.md`), with planned dates Oct 30 and Oct 29 respectively, per
    `scrum-notes.md`'s Ceremony Index. This is expected given the sprint is only on day 7 of 31,
    not a gap in evidence-gathering.

18. **Deployment view (file #9, architecture-log.md Section 5).** No infra/deployment-config
    change was found in the Oct 2–8 window beyond CI workflow and branch-protection setup, and no
    deployment target (staging/production host, container registry, etc.) was identified in the
    repo to describe. **Who can supply it:** Raniya Shaikh (architecture/CI owner) likely knows
    whether a deployment view exists outside this repo (e.g. in a separate ops doc or hosting
    dashboard) that wasn't searched here.

19. **Architecture diagram source files' last-updated dates** — `architecture-baseline.md`,
    `target-architecture.md`, and the integration design doc were not touched by any Oct 2–8
    commit, so they are stale relative to the code changes logged in `architecture-log.md`, but no
    one has explicitly flagged or scheduled their update. **Who can supply it:** Raniya Shaikh
    (architecture owner) — likely the right person to decide whether/when these need refreshing.

20. **Whether the Oct 7 CI incident (PR #72/#78) was escalated per `scrum-notes.md`'s own rule**
    ("CI red on main -> fix before new work") — the fix did happen same-evening, but no recorded
    decision/triage note confirms this followed a deliberate team process versus one person
    noticing and fixing it solo. **Who can supply it:** Sesha Siva Sankar (who opened the hotfix)
    or Tharun Swaminathan (Scrum Master) could clarify how this was actually handled in real time.

21. **Branch naming for Raniya's `raniya/2026-10-02-setup-ci-governance` branch** has no issue
    number component, unlike the pattern used from Oct 5 onward. Not flagged as a problem by any
    reviewer in the data pulled, but noted here for completeness since the task asked to verify
    naming-pattern compliance.

22. **PR #86 (Tharun Swaminathan, #84 DividendRecord) awaiting review as of 2026-10-08 end of day.**
    Opened same day, reviewer requested is `Error404IsFound` per the reviewer ring, no review
    submitted yet, CI status not re-checked in this update. **Who can supply it:** Arthur Elly Lim
    (via the shared account) to review; status should be re-checked next update pass.

---

## Summary table (quick reference)

| #   | Gap                                        | Severity              | Who can supply          |
| --- | ------------------------------------------ | --------------------- | ----------------------- |
| 1   | Report due date                            | Blocking (Cover Page) | Course/syllabus; Tharun |
| 2   | Iteration 3 SM — single-source confirm     | Blocking (Cover Page) | Arthur / Tharun         |
| 3   | Arthur's shared-account attribution        | Blocking (Audit)      | Arthur (going forward)  |
| 4   | Charts has 0 filed issues                  | Blocking (Audit)      | Arthur / Tharun         |
| 5   | Direct-push/force-push server audit log    | Blocking (Audit)      | Org admin (Raniya?)     |
| 6   | Issue comment authorship per day           | Blocking (Audit)      | Re-query; any member    |
| 7   | True branch-creation timestamps            | Blocking (Audit)      | Re-query events API     |
| 8   | "151/152" claim — RESOLVED 2026-10-08      | Resolved              | Raniya (PR #82 merged)  |
| 9   | No CI coverage report                      | Blocking (QA)         | Raniya (CI owner)       |
| 10  | "Integration pass #1/#2" not found         | Blocking (QA)         | Unknown — ask team      |
| 11  | withholding-tax-migration.spec.ts contents | Blocking (QA)         | Tharun                  |
| 12  | Isolated withholding-tax test count        | Blocking (QA)         | Tharun                  |
| 13  | Oct 6/7/8 standups missing                 | Material              | Tharun                  |
| 14  | Oct 2/5 attendance blank                   | Material              | Tharun                  |
| 15  | No priority/estimate on issues             | Material              | Each feature owner      |
| 16  | Per-issue change history not pulled        | Material              | Re-query if needed      |
| 17  | Retro/demo not yet held                    | Expected, not a gap   | N/A — scheduled later   |
| 18  | Deployment view undocumented               | Material              | Raniya                  |
| 19  | Architecture diagrams stale                | Material              | Raniya                  |
| 20  | CI-incident escalation process unclear     | Material              | Sesha / Tharun          |
| 21  | One branch name off-pattern                | Minor                 | Raniya                  |
| 22  | PR #86 awaiting review (opened Oct 8)      | Material              | Arthur                  |
