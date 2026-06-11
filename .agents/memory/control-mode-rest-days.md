---
name: Control Mode rest-day scheduling
description: Why isRestDayForDate is wrong for Control Mode users (day 84+) and where to fix it
---

## The rule
`isRestDayForDate` always wraps `daysSinceStart % 84` back into the 12-week program cycle.
For a user in Control Mode (day 84+ from program start), this maps their date to the WRONG week,
returning false for actual rest days and breaking the streak counter.

## Where it bites
- `calculateStreak` fallback path (`dayIsActive` → `isRestDayForDate`)
- `backfillRestDays` loop (adds wrong rest days to COMPLETED_DATES / REST_DATES)

## Fix applied
Both functions now branch on `daysSinceStart >= 84`:
- **maintain / build / precision** paths: weekday-anchored — check `(d.getDay() + 6) % 7` (Mon=0) against `pinnedRestWeekdays`
- **rebuild** path: mirrors the source week anchored to `controlModeStartDate`, so call `isRestDayForDate(d, controlModeStartDate)` instead of `programStartDate`

`getProgress()` reads `getProgramProgress()` in parallel and passes a `ControlModeStreakInfo` to `calculateStreak`.
`backfillRestDays` reads `getProgramProgress()` internally (no signature change).

## Weekly review early-return bug
`HomeScreen.loadData` had a bare `return;` inside the Control Mode block (line ~202), exiting before the
`shouldShowWeeklyReview` call at line 237. Fix: remove `return`, wrap 12-week workout setup in `else`.

**Why:** Any future work that adds logic after the Control Mode block in `loadData` must verify the block
does NOT have an early return, or Control Mode users will silently miss it.
