# Yearly Tax summary React view — Issue #244

This folder contains a read-only presentation of `TaxService.getYearlySummary()`.
It does not calculate tax, infer withholding, convert currencies, or use JavaScript
floating-point arithmetic on financial values. `null` means **unavailable**, not
zero. The screen reports incomplete-history and missing-FX warnings rather than
presenting partial results as complete.

## Agreed API contract (November 9, 2026)

The public endpoint is `GET /api/v1/tax/yearly-summary?year=YYYY&method=FIFO|AVERAGE_COST`.
`year` is required (1970–2100, UTC); `method` defaults to `FIFO`.
The server converts `Big` amounts using `.toFixed()` (not exponent notation),
retains `null` as unavailable, emits UTC ISO dates, and echoes year/method.
Invalid queries return `400 TAX_INVALID_QUERY`; calculation failures return
`422 TAX_YEARLY_SUMMARY_FAILED` with a generic public message.

`createYearlyTaxSummaryLoader(authenticatedRequest)` calls that route through
`requestApi` and the host's authenticated fetch adapter. React never reads
authentication tokens or recomputes tax amounts.

## Remaining integration work

This route is added by the PR #245 backend change, not yet available on `main`.
Arthur's shared React host (#227) and Raniya's Portfolio → Tax mount remain
separate integration dependencies. Use a real authenticated API smoke test and
UI screenshots before claiming demo acceptance. Mock responses are for tests only.

## Tests

- `npx nx test react-ui --runInBand --skip-nx-cache`
- `npx nx lint react-ui --skip-nx-cache`
- `npx tsc -p libs/react-ui/tsconfig.lib.json --noEmit`
- `npx nx format:check`

Do not modify shared API adapters or mounting code without coordinating with
Raniya. Do not merge until host integration, endpoint and live smoke evidence
exist, Arthur has independently approved, and CI is green.
