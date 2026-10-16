# Summary of Scrum Meetings — Iteration 2

Source: `project-docs/iteration-2/scrum-notes.md`, read in full (485 lines) and extracted faithfully.
Per the task instructions, anything the notes don't cover is marked NOT RECORDED rather than inferred.

**Important finding:** `scrum-notes.md` contains only two dated entries — October 2 and October 5, 2026. No entries exist in the committed file for October 6, 7, or 8, even though the file's own
"Iteration 2 Ceremony Index" schedules standups on all of those dates (Oct 8 is additionally
labeled "Standup + Week 1 Check"). This is logged as deviation D-7 in `deviations.md`.

---

## Meeting 1 — 2026-10-02 — Daily Standup (implicit) + Sprint Planning

- **Date:** October 2, 2026
- **Start time / duration:** Daily Standup scheduled 9:30–9:45 AM CT (15 min, per the recurring template); Sprint Planning scheduled 3:30–5:00 PM CT (90 min). Whether the standup itself actually ran, and for how long, is NOT RECORDED — the file shows the Oct 2 entry labeled "Sprint Start" with sprint-planning content but the standup's own attendance/content block was left as the unfilled template.
- **Meeting type:** Sprint Start / Sprint Planning (first day of Iteration 2)
- **Facilitator:** NOT RECORDED (no facilitator field is filled in the notes; Tharun Swaminathan is the named Scrum Master for the iteration generally)
- **Attendees present:** NOT RECORDED. The template fields `Sesha:`, `Tharun:`, `Arthur:`, `Raniya:` under both "Attendance" (standup) and "Sprint Planning Notes — 2026-10-02 > Attendance" are present in the file but left blank — exactly as the template was written, with no names filled in.
- **Absences / reasons:** NOT RECORDED.
- **Per-member yesterday's merged PR / today's issue / blockers:**
  - **Tharun (Tax / Scrum Master):** Today's issue: `#45` ([Tax][Iteration 2] Close DR-1-3 and create Scrum notes template). Task: create scrum notes template; close DR-1, DR-2, DR-3; file first withholding-tax issue and first FIFO issue. Branch: `tharun/2026-10-02-45-tax-decisions`. Reviewer: Arthur. Coding gate noted: "No tax implementation before DR-1-6 are closed; DR-4-6 scheduled for Oct 5." Yesterday's merged PR / blockers: NOT RECORDED (fields not filled).
  - **Sesha (Risk):** Not written up as a standup block in the Oct 2 entry (no "Sesha" standup section exists for Oct 2 in the file — his day's work is instead documented in the separate `2026-10-02-risk-issue-plan-update.md` doc, read in full: synced `sesha` branch to main, retroactively reviewed PR #28/#29 as GitHub PR comments, confirmed risk issues #18-26 were already correctly milestoned, and filed issues #30-43 for the Oct 5-22 daily risk tasks).
  - **Arthur (Charts):** NOT RECORDED — no Oct 2 standup block for Arthur exists in `scrum-notes.md`.
  - **Raniya (Architecture/QA/Dashboard):** NOT RECORDED in `scrum-notes.md` directly, though GitHub shows she opened PR #49 (CI/governance setup) the same day.
- **PRs not yet merged from previous day:** NOT RECORDED (Iteration 1 close-out state not captured in this entry).
- **GitHub snapshot (open PRs / PRs awaiting review / issues closed / CI status on main):** NOT RECORDED — the "GitHub State Readout" block in the template was not filled for Oct 2.
- **Decisions made:** DR-1 (net-dividend nullability), DR-2 (currency handling), DR-3 (same-date ordering tie-breaker) — see `project-docs/iteration-2/tax-decision-record.md` for full text, closed via PR #48.
- **Substitute reviewers assigned:** NOT RECORDED for Oct 2 specifically (the "Reviewer substitutes" field under Sprint Planning's Capacity/Absences section was left blank).
- **Next actions (with owner / due date):** Tharun's own "Evidence To Add Before Closing Oct 2" checklist lists: withholding issue #46, FIFO issue #47, decision-record commit, PR, Arthur review, CI/check result, merge commit, issue #45 closed — all of which were in fact completed per GitHub (PR #48, merged 2026-10-03T14:56:46Z, issue #45 closed same timestamp). No explicit due dates beyond "before closing Oct 2" are given in the text.
- **"No commit today" entries:** None recorded for Oct 2.
- **Sprint Planning — Iteration 1 Controls Confirmed checklist:** present in the file as an unchecked checklist (`[ ] daily issue -> branch -> commit -> PR -> review -> merge`, etc.) — NOT RECORDED whether these were actually checked off live; the markdown shows all boxes unchecked.
- **Sprint Planning — Dependencies/Shared Files, Capacity/Absences, Monday Tasks Confirmed, Decisions/Actions, Evidence sections:** all present as blank templates in the file — NOT RECORDED.

## Meeting 2 — 2026-10-05 — Daily Standup / Tax Decision Gate

- **Date:** October 5, 2026
- **Start time / duration:** 9:30–9:45 AM CT (per template; actual start/duration NOT RECORDED beyond the scheduled slot).
- **Meeting type:** Daily Standup (also the day the DR-4–6 tax decision gate was scheduled to close).
- **Facilitator:** NOT RECORDED.
- **Attendees present:** NOT RECORDED — the `Sesha:` / `Tharun:` / `Arthur:` / `Raniya:` attendance block is again left blank in the committed file.
- **Absences / reasons:** NOT RECORDED.
- **Previous-day PR check:** Verified from GitHub and written up: PR #48 — status merged, merge commit `c80ad512a36513da28fd1f1c64deed87f78274cf`, issue #45 linked and closed. The notes explicitly flag: "GitHub records the approval on PR #48 under the shared `Error404IsFound` account. If the team attributes that review to Arthur, keep the repository identity limitation visible in the evidence rather than rewriting the GitHub record" — this is the team's own documented acknowledgement of the shared-account issue.
- **Per-member yesterday's merged PR / today's issue / blockers:**
  - **Sesha — Risk review assigned to Tharun:** PR #51 (Issue #30, single-stock concentration), reviewer Tharun. Notes record that the initial review found duplicate same-symbol positions were not aggregated, fixed in commit `2c062a0`, re-review found the AAPL 6%+6%=12% regression test correct. Notes say "Final approval/merge evidence should be added only after GitHub shows the submitted approval and green checks" (written before the merge happened — GitHub shows it merged later the same day, 2026-10-05T18:04:14Z).
  - **Tharun — Tax / Scrum Master:** Today's issue `#52` ([Tax][Mon Oct 5] Close DR-4-6 and file remaining tax issues). Branch `tharun/2026-10-05-52-tax-decisions`. Task: close DR-4 (fee treatment), DR-5 (average-cost pool scope), DR-6 (decimal-safe rounding); file remaining tax issues; update tax decision record. Notes also record a correction: the authoritative Iteration 2 sprint plan specifies the average-cost pool as `user + asset`, so issue #52's acceptance criteria (which said "account-aware") needed correcting in GitHub before closure.
  - **Arthur:** NOT RECORDED in this entry (no Arthur standup block present for Oct 5; separately, GitHub shows Tharun's `CHANGES_REQUESTED` review of Arthur's PR #50 was submitted later that same day at 2026-10-05T21:17:04Z, outside the 9:30-9:45 standup window).
  - **Raniya:** NOT RECORDED in this entry (GitHub shows PR #61, issue #60, work happening this day, but it is not written up in the standup notes text itself).
- **PRs not yet merged from previous day:** NOT RECORDED as an explicit list (implicitly PR #51 was still open going into the standup, per the "final approval/merge evidence... added only after" phrasing, and did merge later that day).
- **GitHub snapshot (open PRs / awaiting review / issues closed / CI status):** NOT RECORDED as a discrete block for Oct 5 — the entry is organized by task rather than by this template section.
- **Decisions made:** DR-4 (fee treatment: gross values and activity fees kept separate), DR-5 (average-cost pool scope = `userId + symbolProfileId`, explicitly superseding the Iteration 1 account-aware proposal), DR-6 (decimal-safe rounding: convert to `Big` at the tax-engine boundary, round only once for presentation). Full text in `tax-decision-record.md`.
- **Substitute reviewers assigned:** NOT RECORDED for this date specifically.
- **Next actions (with owner/due date):** Tharun's own list: "1. Finalize DR-4-6... 2. File remaining tax implementation issues... 3. Run documentation checks. 4. Commit with #52 reference. 5. Push branch and open PR. 6. Request Arthur review. 7. Merge only after approval and green CI. 8. Pull latest main before starting #46 on Oct 6." No explicit calendar due dates beyond "Oct 6" for the last item.
- **"No commit today" entries:** None recorded.
- **Blockers/Risks recorded:** "No tax calculation code should start until #52 is reviewed and merged"; "Shared decimal/API serialization belongs to Raniya; tax code must consume the shared convention rather than edit the shared contract independently"; the #52 wording-correction item above.

## Meetings for 2026-10-06, 2026-10-07, 2026-10-08

**NOT RECORDED.** No entries exist in `project-docs/iteration-2/scrum-notes.md` for these three
scheduled standup dates (Oct 8 was additionally scheduled as "Standup + Week 1 Check" per the
Ceremony Index). This means, for these three days, the following are all NOT RECORDED from the
team's own evidence log (though some of the same facts can be independently reconstructed from
raw GitHub data elsewhere in this record set — see `sprint-backlog.csv`, `github-audit.csv`,
`deviations.md`):

- attendance and absences
- facilitator
- per-member stated blockers and next actions (as opposed to what can be inferred from PR activity)
- whether the Oct 7 CI incident (PR #72 breaking `main`) was raised live at a standup
- substitute reviewer assignments
- "no commit today" entries and reasons
- explicit decisions made in a meeting (as opposed to decisions visible only as PR review outcomes)

See `gaps.md` for who can supply this (Tharun Swaminathan, as Scrum Master, is the person who
would hold or be able to reconstruct any notes taken outside the committed file).
