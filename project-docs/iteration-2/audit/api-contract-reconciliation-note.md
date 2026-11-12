# API Contract Reconciliation Note

Checked the chart specs against the real upstream Ghostfolio API (not just against each other). Two mismatches found, both fixed:

## 1. Preset value: `'today'` → `'1d'`

The zoom/pan spec's `TimeRangeSelection` type used `'today'` as a preset. The real Ghostfolio `DateRange` type (`libs/common/src/lib/types/date-range.type.ts`) never has that value, it's `'1d'`, `'wtd'`, `'mtd'`, `'ytd'`, `'1y'`, `'5y'`, `'max'`. The UI labels `1d` as "Today," but the wire value is `1d`. A DTO validated against the real enum would have rejected every request built from the old spec.

Fixed in `zoom-pan-time-range-data-spec.md` and reflected in `TimeRangeSelectionDto` (`DATE_RANGE_PRESETS`).

## 2. Endpoint version: `/api/v1/portfolio/performance` → `/api/v2/portfolio/performance`

The specs assumed the reused performance endpoint was unversioned (`v1`). The real route is versioned, `PortfolioController.getPerformanceV2` serves `GET /api/v2/portfolio/performance`. This doesn't affect the four genuinely new chart endpoints, those are new surface area and correctly live under `/api/v1/charts/...` per the shared API convention Tharun flagged separately. It only affects the one endpoint this work extends rather than replaces.

Fixed in `zoom-pan-time-range-data-spec.md` and `charts-module-README.md`.

## Also noted, not a mismatch but worth stating explicitly

The real `v2` performance endpoint already accepts `accounts`, `assetClasses`, `dataSource`, `symbol`, `holdingType`, and `query` as filters. `kind` and the custom `startDate`/`endDate` params are additive alongside those, not a replacement, the DTO and the endpoint table now say so.

## What's still unverified

I confirmed the route, method name, and preset enum against search results and community documentation of the upstream repo, not by reading the controller source directly (no repo access from here). Worth a quick `grep -r "getPerformanceV2"` and a look at the actual `DateRange` type definition in your checked-out copy before merging, just to be certain nothing's drifted between what's documented and what's actually in your fork's `main`.

## Deliverables in this batch

- `time-range-selection.dto.ts`: the `TimeRangeSelectionDto` with validation (mutual exclusivity of preset vs. custom, required pairing of startDate/endDate, date ordering, ISO-8601 format, preset enum matching the real `DateRange` type).
- `time-range-selection.dto.spec.ts`: Jest tests covering all of the above, plus two tests that deliberately document what's _out_ of scope for the DTO (future-date and earliest-history clamping), so that boundary stays a visible decision rather than silently drifting.

Both files assume a path like `apps/api/src/app/charts/dto/`, adjust to wherever the charts feature module actually lives in your tree.
