# Yearly Tax summary React view — Issue #244

This folder contains a read-only presentation of `TaxService.getYearlySummary()`.
It does not calculate tax, infer withholding, convert currencies, or use JavaScript
floating-point arithmetic on financial values. `null` means **unavailable**, not
zero. The screen reports incomplete-history and missing-FX warnings rather than
presenting partial results as complete.

## Integration blocker (November 9, 2026)

`TaxController` does **not** expose a yearly-summary HTTP endpoint on `main`.
The `YearlyTaxSummaryData` interface in this folder is a **proposed serialized
contract**, not a claim that the endpoint exists. The backend presently returns
`Big` and `Date` domain values. The eventual API must serialize money as plain
decimal strings (no JS numbers or exponent notation) and dates as ISO UTC text.
It must preserve nullable totals and diagnostics.

`YearlyTaxSummaryScreen` therefore takes a required `load` callback from the
host; `createYearlyTaxSummaryLoader(authenticatedRequest, buildPath)` uses the
shared API envelope and authenticated request adapter, but deliberately does
not specify a URL. Raniya must approve the route, response schema, and
host-mounted authentication integration before this can be used with live data.
Only tests use synthetic responses. A passing component test is **not** a live
integration or demo acceptance check.

## Known design assumption

The year input uses the same 1970–2100 bounds as the existing public dividend
records endpoint. The yearly service currently validates only integer years;
confirm the public yearly-summary endpoint's year bounds in its contract before
merging.

## Tests

- `npx nx test react-ui --runInBand --skip-nx-cache`
- `npx nx lint react-ui --skip-nx-cache`
- `npx tsc -p libs/react-ui/tsconfig.lib.json --noEmit`
- `npx nx format:check`

Do not modify shared API adapters or mounting code without coordinating with
Raniya. Do not merge until host integration, endpoint and live smoke evidence
exist, Arthur has independently approved, and CI is green.
