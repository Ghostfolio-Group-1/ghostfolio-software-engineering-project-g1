# Tax Metrics and Tax Calculations — Final Implementation Report

- **Contributor:** Tharun Swaminathan
- **Team:** TA Breakers
- **Project:** Ghostfolio Extension — Portfolio Risk, Tax, Performance & Income Analytics
- **Iteration:** 3 — Frontend, Visualization, Testing and Refinement
- **Initial draft:** November 26, 2026
- **Revised draft:** November 27, 2026
- **Repository baseline:** `3b1179fe1` (main, after PR #362)
- **Issue:** #366

## 1. Objective and Individual Contribution

My primary responsibility in the Ghostfolio extension project was the design, development, integration and testing of the Tax Metrics and Calculations module. The objective was to extend Ghostfolio's existing portfolio management capabilities by providing users with reliable and traceable tax-related financial information.

The module focuses on realized capital gains, dividend withholding, tax-lot tracking, yearly tax summaries and financial record exports. It was designed as a portfolio analytics tool rather than a jurisdiction-specific tax filing system.

The development process was divided into three iterations. During Iteration 1, I focused on the financial data models, calculation specifications and architectural design. During Iteration 2, I implemented the backend calculation engines and reporting services while also serving as the Scrum Master. During Iteration 3, my work focused on developing the React Tax interface, connecting it to live backend APIs, expanding automated test coverage and addressing issues identified during quality assurance.

Throughout the project, I prioritized financial accuracy, decimal precision, transaction traceability, maintainability and separation of responsibilities between the frontend and backend.

## 2. Development Across the Three Iterations

### 2.1 Iteration 1 — Design and Data Modelling

The first iteration focused on understanding Ghostfolio's existing transaction model and determining how tax-related functionality could be introduced without replacing its existing portfolio calculation system.

The design work included:

- Reviewing the existing transaction and dividend data models.
- Designing the withholding-tax field and its validation requirements.
- Specifying FIFO and Average Cost capital-gain calculation methods.
- Designing the derived tax-lot data model.
- Defining the yearly tax summary structure.
- Specifying tax-relevant activity filtering.
- Designing deterministic CSV and PDF export formats.
- Preparing implementation backlog documentation.
- Reviewing the proposed chart data model developed by another team member.

An important design decision was to reuse Ghostfolio's existing financial activities as the source of truth. Tax lots, realized gains and yearly summaries would be derived from these activities rather than maintained as separate authoritative transaction records.

This approach reduces the risk of inconsistencies between the original portfolio information and the calculated tax results.

**Supporting pull requests:** #1, #4, #6, #7, #9, #10, #11, #12, #13, #15 and #16.

### 2.2 Iteration 2 — Backend Development

The second iteration converted the design specifications into working backend functionality.

Before implementing the calculation engines, I resolved six outstanding design decisions concerning withholding-tax nullability, currency handling, activity ordering, transaction fees, Average Cost pool scope and decimal rounding.

The implemented backend functionality included:

- Withholding-tax persistence and dividend record generation.
- FIFO tax-lot creation and consumption.
- FIFO realized capital-gain calculations.
- Average Cost pool management and realized-gain calculations.
- Calculation method selection.
- Derived tax-lot tracking.
- Tax-relevant activity filtering.
- Yearly tax summary generation.
- Historical base-currency conversion.
- Deterministic CSV and PDF generation services.

The backend was developed to ensure that all financial calculations remained independent of the user interface and export rendering layers. This allowed the React frontend introduced in Iteration 3 to reuse authoritative calculation results.

I also served as the Scrum Master during this iteration. My responsibilities included sprint coordination, progress documentation, peer reviews, retrospective preparation and maintaining evidence of the team's development activities.

**Supporting pull requests:** #48, #59, #72, #80, #86, #92, #98, #104, #109, #117, #120, #126, #132, #139, #147, #148, #152, #159, #164, #169 and #180.

### 2.3 Iteration 3 — Frontend Development and Quality Assurance

The third iteration focused on making the implemented backend functionality accessible through the React-based user interface.

I developed and integrated four primary Tax views:

1. Tax Lots
2. Realized Gains
3. Dividend Withholding
4. Yearly Summary

These views were combined into a unified TaxWorkspace and integrated into Ghostfolio's Portfolio section.

The frontend communicates with authenticated backend endpoints and displays calculated financial results rather than independently performing tax calculations.

Additional development included preserving asset identity in yearly tax results, improving monetary formatting, reviewing test coverage, expanding component testing, implementing live integration tests and developing browser-based end-to-end tests.

The final stage focused on manual QA, regression testing, documentation and resolving issues before the November 25 bug-fix freeze.

**Supporting pull requests:** #195, #210, #216, #229, #231, #243, #245, #252, #262, #277, #284, #301, #309, #316, #321, #331, #339 and #349.

## 3. Software Architecture

The Tax module follows the project's modular three-tier architecture, separating presentation, business logic and data access responsibilities.

### 3.1 Presentation Layer

The presentation layer consists of the React TaxWorkspace and its associated components.

Its responsibilities include:

- Displaying tax lots and their consumption status.
- Displaying realized capital gains.
- Supporting calculation method selection where available.
- Displaying dividend and withholding-tax information.
- Providing yearly tax summaries.
- Formatting financial values for readability.
- Handling loading, error, empty and successful response states.

The frontend consumes backend-provided financial values and does not independently implement FIFO, Average Cost, withholding-tax or currency-conversion calculations.

### 3.2 Business Logic Layer

The business logic layer is implemented within the NestJS Tax module.

The Tax controller provides authenticated HTTP endpoints, while the associated services and calculation functions perform financial processing.

The business logic includes FIFO and Average Cost calculations, dividend record generation, tax-lot tracking, fee allocation, yearly aggregation, currency conversion and reporting services.

The calculation engines remain separate from the frontend and report-rendering components. This ensures that financial results can be reused consistently across different parts of the application.

### 3.3 Data Access Layer

The data access layer uses Ghostfolio's existing financial activity model and shared data-access infrastructure.

The TaxDataService retrieves the activities required for tax calculations while respecting Ghostfolio's existing analysis eligibility rules and additional tax-relevance requirements.

The existing PostgreSQL database and Prisma infrastructure remain the source of persisted financial activities. Tax-related calculated records are derived from these activities.

This architecture preserves the existing application infrastructure while providing a clear separation between the Tax module and other portfolio analytics features.

## 4. Tax Calculation Methodology

### 4.1 FIFO Capital-Gain Calculation

The First-In, First-Out method determines the cost basis of a sale by consuming the oldest available acquisition lots first.

Each eligible BUY activity creates a derived acquisition lot. When a SELL activity occurs, the calculation engine consumes quantities from the oldest available lots until the sale quantity is satisfied.

The FIFO calculation scope includes the user, account and asset identity. This prevents a sale from consuming acquisition lots belonging to another user, account or asset. Eligible activities are ordered by timestamp and then activity ID in ascending order. There is no separate BUY-before-SELL override for identical timestamps; insufficient holdings produce an explicit error rather than silently discarding unmatched sale quantities.

The gross realized gain is calculated as:

Gross Realized Gain = Gross Sale Proceeds − Gross Cost Basis

Allocated BUY and SELL fees are then deducted separately to determine the realized gain after activity fees.

The implementation supports partial lot consumption, multiple acquisition lots, fractional quantities and traceability to the original transactions.

### 4.2 Average Cost Capital-Gain Calculation

The Average Cost method maintains a running pool of quantities, acquisition costs and acquisition fees.

Unlike FIFO, the Average Cost implementation does not associate each disposal with individual acquisition lots. Instead, the disposed quantity receives a proportional share of the accumulated cost pool.

The implemented Average Cost pool is scoped by user and asset. Account identity is not included in this pool, allowing holdings of the same asset across the user's accounts to contribute to the average cost.

After a complete liquidation, the remaining quantity, gross cost and acquisition-fee pool are reset to zero.

### 4.3 Calculation Example

Consider the following synthetic transactions, with all amounts expressed in USD and no activity fees.

| Activity | Quantity | Unit price |
| -------- | -------: | ---------: |
| BUY      |       10 |     100.00 |
| BUY      |       10 |     120.00 |
| SELL     |       15 |     130.00 |

The two methods produce different cost-basis and realized-gain results.

| Calculation                |     FIFO | Average Cost |
| -------------------------- | -------: | -----------: |
| Sale proceeds              | 1,950.00 |     1,950.00 |
| Cost basis                 | 1,600.00 |     1,650.00 |
| Realized gain              |   350.00 |       300.00 |
| Remaining quantity         |        5 |            5 |
| Remaining acquisition cost |   600.00 |       550.00 |

This example demonstrates that both methods use the same sale proceeds while allocating acquisition costs differently.

Both calculation methods are supported by the realized-gains and yearly-summary APIs.

### 4.4 Dividend Withholding

Dividend information is derived from Ghostfolio's existing dividend activities.

Gross dividend is calculated by multiplying the activity quantity by its unit price.

Gross Dividend = Quantity × Unit Price

When withholding-tax information is available:

Net Dividend = Gross Dividend − Withholding Tax

An important requirement is distinguishing an unknown withholding amount from a known-zero amount.

A known-zero withholding value indicates that no tax was withheld. An unknown value indicates that the necessary information was not provided.

When withholding is unknown, the associated net dividend also remains unavailable. The system does not substitute zero for missing financial information. The persisted withholding amount uses the transaction currency. The activity fee remains separate from withholding. A withholding-tax rate is not part of the current public dividend or yearly-summary contract and is not inferred by the frontend.

### 4.5 Yearly Tax Summary

The yearly tax summary aggregates dividend and realized-gain information for a selected UTC calendar year.

The summary includes financial measures such as gross dividends, withholding tax, net dividends, gross sale proceeds, cost basis, realized gains, allocated activity fees and realized gains after fees.

Historical acquisition activities are retained when necessary to determine the cost basis of assets disposed of during the selected year.

The summary also supports historical base-currency conversion using Ghostfolio's exchange-rate service. Dividend amounts use the dividend activity date; realized-gain amounts, including cost basis and allocated fees, use the SELL date under the implemented reporting convention. This is not a separate acquisition-date FX calculation or a jurisdiction-specific tax rule. Yearly allocated activity fees cover BUY and SELL fees associated with realized disposals, not dividend fees or unlinked standalone FEE activities. If a required historical exchange rate is unavailable, the affected converted amount remains unavailable and the summary includes an appropriate diagnostic. Known transaction-currency amounts are retained.

This ensures that missing information is communicated rather than silently producing a misleading financial result.

## 5. React User Interface Implementation

### 5.1 Tax Lots View

The Tax Lots view displays acquisition lots derived from the FIFO calculation engine.

The information includes acquisition details, original quantities, consumed quantities, remaining quantities and lot status.

The supported lot states are:

- OPEN
- PARTIALLY_CONSUMED
- CLOSED

Users can filter the displayed lots by their consumption status.

The public tax-lot endpoint currently supports FIFO acquisition lots only. Average Cost selection is therefore disabled for this view rather than displaying unsupported or artificially generated acquisition lots.

**Implementation evidence:** PRs #195 and #210.

### 5.2 Realized Gains View

The Realized Gains view displays the calculated financial results associated with asset disposals.

Users can select either FIFO or Average Cost to review how the selected method affects cost basis and realized gains.

Financial results are retrieved from the backend and include sale proceeds, cost basis, realized gains, allocated fees and fee-adjusted realized gains.

The dedicated tax-relevance UI filter remains incomplete because the necessary API contract has not been finalized. This limitation is tracked under Issue #242.

**Implementation evidence:** PR #243.

### 5.3 Dividend Withholding View

The Dividend Withholding view displays dividend activities for the selected year, including gross dividends, withholding-tax amounts and net dividends.

The view preserves the distinction between known-zero values and unavailable information.

The initial React component was subsequently connected to a public authenticated dividend endpoint, replacing the need for development-only data in the production interface.

**Implementation evidence:** PRs #216, #229 and #231.

### 5.4 Yearly Summary View

The Yearly Summary view provides an aggregated overview of the user's tax-related financial information.

Users can select a calendar year and a supported calculation method.

The view retrieves authoritative backend results, including yearly totals, currency information and diagnostics relating to incomplete or unavailable financial data.

Asset identity preservation was also improved to maintain traceability between yearly results and their associated financial assets.

**Implementation evidence:** PRs #245 and #277.

### 5.5 TaxWorkspace Integration

The four React views were combined into a TaxWorkspace and mounted within Ghostfolio's Portfolio section.

This integration allows users to navigate between tax lots, realized gains, dividend withholding and yearly summaries within a common interface.

The implementation follows the shared React architecture and authenticated data-access approach used across the project.

**Implementation evidence:** PRs #252 and #262.

## 6. Backend API Integration

The Tax module currently exposes four authenticated HTTP GET endpoints.

| Endpoint                     | Purpose                                       | Supported methods  |
| ---------------------------- | --------------------------------------------- | ------------------ |
| `/api/v1/tax/lots`           | Retrieve derived acquisition lots             | FIFO               |
| `/api/v1/tax/realized-gains` | Retrieve realized capital gains               | FIFO, Average Cost |
| `/api/v1/tax/dividends`      | Retrieve dividend records for a selected year | Not applicable     |
| `/api/v1/tax/yearly-summary` | Retrieve yearly tax totals                    | FIFO, Average Cost |

All four endpoints require the `portfolio:read` permission scope.

FIFO is the default calculation method where method selection is supported.

The dividend and yearly-summary endpoints require an explicit UTC calendar year (`year=YYYY`, 1970–2100). The optional `method` parameter for realized gains and yearly summaries accepts `FIFO` or `AVERAGE_COST`. Financial amounts are transferred as decimal strings, with unavailable information represented using null values where applicable.

No public CSV or PDF download endpoints are currently exposed. The existence of backend export services does not mean that the browser download workflow has been completed.

**As-built references:** [Tax backend README](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/apps/api/src/app/tax/README.md), [Tax controller](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/apps/api/src/app/tax/tax.controller.ts), and [TaxWorkspace](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/libs/react-ui/src/lib/tax-workspace/tax-workspace.tsx).

## 7. Financial Precision and Monetary Formatting

Financial precision was a major consideration throughout the development of the Tax module.

The backend uses decimal arithmetic to minimize floating-point precision errors. The React interface preserves the authoritative decimal strings received from the API.

During the November 23 manual QA session, several monetary formatting issues were identified. Some values appeared without thousands separators or consistent decimal places, while certain Average Cost results contained excessively long decimal representations.

To address these issues, I implemented a reusable, decimal-safe monetary formatter using the project's existing Big.js dependency.

The formatter provides thousands separators and two decimal places using half-up rounding for monetary presentation. The examples below illustrate the formatter's behavior; they are not evidence of a fresh manual browser retest.

| Original value           | Formatted value |
| ------------------------ | --------------: |
| 4611.6                   |        4,611.60 |
| 3733.2                   |        3,733.20 |
| 371.7                    |          371.70 |
| 36.4                     |           36.40 |
| 3883.7828571428571428571 |        3,883.78 |

The formatting is applied only at the presentation layer. Original decimal precision is preserved, and formatted monetary values are not used as inputs to subsequent financial calculations.

Internal diagnostic code prefixes were also removed from the yearly-summary presentation while retaining readable diagnostic messages.

The implementation preserves the distinction between numeric zero and unavailable values.

These improvements were introduced through PR #349, which was merged on November 25 before the bug-fix freeze.

## 8. Testing and Quality Assurance

### 8.1 Backend Unit Testing

Backend unit tests were developed throughout Iterations 2 and 3 to verify the financial calculations and reporting behavior.

The test strategy focused on meaningful numerical assertions, transaction ordering, fee allocation, quantity handling, missing information and deterministic output.

The November 20 local Tax backend regression completed successfully with 271 passing tests across 19 test suites.

Additional testing covered the CSV and PDF export services, including deterministic formatting and numeric representation.

The November 23 targeted export regression recorded 15 passing CSV tests and 18 passing PDF tests.

These export results demonstrate service-level functionality and do not establish that browser downloads are available.

### 8.2 React Component Testing

The React Tax components were tested for successful data presentation, loading states, error states and empty responses.

Component testing also verified the presentation of backend-provided financial values and the behavior of calculation method and year selection.

PR #309 added a populated yearly-summary regression test through the TaxWorkspace, ensuring that a valid financial response is displayed rather than an empty-state message.

Following the monetary formatting improvements, the targeted Tax React regression suite completed with 174 passing tests across 13 suites.

### 8.3 Live Integration Testing

Live integration tests were introduced to verify communication between the React interface and the running Ghostfolio backend.

The tests used synthetic financial activities and authenticated API responses.

The integration tests checked:

- FIFO lot consumption and associated transaction identities.
- Sale proceeds, cost basis and realized gains.
- Allocated activity fees.
- Consistency between realized gains and yearly summaries.
- Preservation of unknown withholding-tax information.
- Accurate presentation of authoritative backend financial values.

The November 18 integration session recorded seven passing tests across two suites.

The broader November 20 integration regression subsequently recorded nine passing tests across two suites.

These results represent separate test executions and are not added together as unique test cases.

**Implementation evidence:** PR #316.

### 8.4 Browser End-to-End Testing

Playwright was used to verify the Tax module through the actual browser interface.

The browser tests exercised the authenticated Portfolio section using both empty and populated synthetic portfolios.

The tests covered navigation between the four Tax views, supported calculation methods, lot-status filtering, year selection and financial values displayed from live API responses.

The November 19 Tax-specific browser test execution completed successfully with two passing Chromium tests.

The November 20 full local Chromium run recorded ten passing tests across the project, including the two Tax tests.

Browser CSV/PDF download verification and the dedicated tax-relevance filtering journey remain blocked by incomplete implementation dependencies. The incomplete-history diagnostic state also lacks a verified browser fixture. The local November 20 browser run used an existing Docker image whose exact source commit was not verified.

**Implementation evidence:** PR #321.

### 8.5 Regression Test Results

The following table summarizes the recorded Tax testing evidence.

| Test category               | Recorded result                   | Date              |
| --------------------------- | --------------------------------- | ----------------- |
| Tax backend regression      | 271/271 passed                    | Nov 20 and Nov 25 |
| Tax React regression        | 174/174 passed                    | Nov 25            |
| CSV export service          | 15/15 passed                      | Nov 23            |
| PDF export service          | 18/18 passed                      | Nov 23            |
| Live integration regression | 9/9 passed                        | Nov 20            |
| Tax browser E2E             | 2/2 passed                        | Nov 19–20         |
| Full local Chromium E2E     | 10/10 passed                      | Nov 20            |
| Full local Nx coverage run  | 1,507 passed, 1 failed, 1 skipped | Nov 20            |

The combined November 25 targeted Tax backend and React regression count was 445 passing tests.

The other test executions listed above may overlap with these test suites and should not be added to this total.

The unsuccessful full local Nx coverage run contained a five-second timeout in a shared Dashboard test. The exact cause was not confirmed. The initial targeted backend run also encountered a timeout; the recorded 271 passing tests are from the subsequent run with a longer timeout. The local full-project run reported shared React-host parsing errors and Angular warnings despite passing client test summaries. Additional high-load local testing was deferred following workstation instability.

Subsequent successful CI runs are separate verification evidence and do not change the historical failed local test result.

**Supporting evidence:** [November 20 regression log](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/docs/testing/tax/2026-11-20-regression.md).

### 8.6 Manual Quality Assurance

Manual QA was performed on November 23 to assess the usability and presentation of the implemented Tax screens. The session used an existing demo Docker image whose source commit was not verified. Visual observations are therefore not equivalent to a fresh build or independent API-response comparison.

The shared QA log initially recorded eleven Tax checks:

- Seven passed.
- Two failed.
- Two were blocked.

The failed checks concerned monetary formatting and shared dark-theme behavior.

The monetary formatting defect was addressed through PR #349. However, this change was merged after the shared November 25 regression session, and the QA log does not record a subsequent manual retest of that fix.

The shared dark-theme issue, tracked under Issue #342, was resolved through shared React-host changes. The shared QA regression records a successful retest of dark-theme rendering.

The two blocked checks concerned browser CSV/PDF downloads and dedicated tax-relevance filtering.

These checks remain blocked rather than being counted as passed. The separate Tax QA checklist records the Open/All lot-status filter check (TAX-QA-03) as partial. The dropdown was successfully changed to All lots, and the table remained populated, but no closed lots or exact row-count differences were verified. Other outstanding checks include exact mobile-width behavior, external CSV/PDF viewer checks and controlled API failure/retry verification. These should not be represented as completed manual checks.

**Supporting evidence:** [November 23 Tax QA checklist](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/docs/testing/tax/2026-11-23-tax-qa.md), [shared QA log](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/3b1179fe1/docs/testing/qa-log.md), and [Issue #337](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/337).

### 8.7 Continuous Integration Verification — November 26 Snapshot

Following the November 25 bug-fix freeze, main commit `5d6e4b00f` was verified on November 26, 2026. The figures in this subsection refer to that historical CI snapshot, not to later main commits.

The GitHub Actions Build Code and Demo Environment workflows completed successfully, providing verification of the integrated application after the final merged changes.

| CI check               | Result | Execution time |
| ---------------------- | ------ | -------------- |
| Unit tests             | PASS   | 3m 28s         |
| Component tests        | PASS   | 2m 12s         |
| Application build      | PASS   | 4m 14s         |
| Lint and format        | PASS   | 3m 26s         |
| Live integration tests | PASS   | 8m 05s         |
| Browser E2E tests      | PASS   | 8m 18s         |

All six build and testing jobs completed successfully.

The separate Extract Locales workflow failed because GitHub Actions did not have permission to create or approve pull requests. Dependency installation, locale extraction and change detection completed successfully before the automated pull-request creation step failed.

This failure was related to repository automation permissions rather than a failed financial calculation or application test. Node.js 20 deprecation warnings were also reported during the workflows.

The November 25 local Tax regression results of 271 backend tests and 174 React tests were obtained at commit `52258870d`. These results are reported separately from the subsequent CI verification at commit `5d6e4b00f`.

**CI evidence:**

- [Build Code — Run #45736515597](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45736515597)
- [Demo Environment — Run #45736515821](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45736515821)
- [Extract Locales — Run #45736515607](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45736515607)

#### Automated Test Counts for `5d6e4b00f`

The detailed GitHub Actions execution logs were reviewed on November 26, 2026, to obtain the actual number of tests executed against main commit `5d6e4b00f`.

| Test category            | Passed | Failed | Skipped | Result |
| ------------------------ | -----: | -----: | ------: | ------ |
| Full-project Jest tests  |  1,560 |      0 |       1 | PASS   |
| React component tests    |    492 |      0 |       0 | PASS   |
| Live integration tests   |     14 |      0 |       0 | PASS   |
| Browser end-to-end tests |     14 |      0 |       0 | PASS   |

The full-project Jest workflow completed with 184 passing test suites and one skipped suite. The separate React component workflow completed with 63 passing test suites. Live integration testing completed with four passing test suites, while the Playwright browser tests completed successfully in 44.8 seconds.

The React component tests are also included in the full-project Jest workflow. Therefore, the 492 component tests should not be counted again when calculating the overall number of distinct tests.

Compared with the November 20 local regression, the recorded React test count increased from 456 to 492, while the browser end-to-end test count increased from 10 to 14.

This CI execution also completed without the Dashboard test timeout encountered during the November 20 local regression. However, the original local failure remains documented for transparency.

These results provide project-wide verification of the integrated application. The Tax-specific regression results of 271 backend tests and 174 React tests are reported separately to demonstrate the validation performed specifically for the Tax module.

#### November 27 Baseline Update

Main advanced to `3b1179fe1` following the merge of [PR #362](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/362). The incoming changes affect Risk and shared synthetic demo seed data rather than Tax production files.

On November 27, 2026, I verified the GitHub Actions results associated with this updated main baseline.

| Workflow or check      | Result |
| ---------------------- | ------ |
| Application build      | PASS   |
| Unit tests             | PASS   |
| Component tests        | PASS   |
| Lint and format        | PASS   |
| Live integration tests | PASS   |
| Browser E2E tests      | PASS   |
| Daily PR fallback      | PASS   |
| Extract locales        | FAIL   |

All six application build and testing jobs passed. The separate Extract Locales workflow failed during automated pull-request creation because GitHub Actions was not permitted to create or approve pull requests. This is a repository automation permission issue rather than an application test failure.

The previously reported test counts and coverage statistics remain attributed to commit `5d6e4b00f`. No new local regression run or coverage calculation was performed on November 27.

**Supporting CI evidence:**

- [Build Code — Run #45935650133](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45935650133)
- [Demo Environment — Run #45935650134](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45935650134)
- [Extract Locales — Run #45935650176](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45935650176)
- [Daily PR Fallback — Run #45942019733](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45942019733)

### 8.8 Code Coverage Analysis

In addition to verifying successful test execution, I analyzed the code coverage artifact generated by GitHub Actions to evaluate the extent to which the automated tests exercised the implemented Tax functionality.

The coverage analysis was performed on November 26, 2026, using the `coverage-report` artifact from GitHub Actions run #45736515597, associated with main commit `5d6e4b00f`.

#### 8.8.1 Project-Level Coverage

The following table summarizes the coverage reported across the five project libraries and applications.

| Project           | Statement coverage | Branch coverage | Function coverage | Line coverage |
| ----------------- | -----------------: | --------------: | ----------------: | ------------: |
| API               |             63.98% |          49.61% |            55.04% |        63.23% |
| Angular Client    |             69.33% |          63.30% |            47.29% |        71.16% |
| Common Library    |             77.82% |          56.03% |            62.77% |        77.80% |
| React UI          |             95.69% |          89.21% |            96.45% |        96.09% |
| Legacy UI Library |             21.02% |           9.72% |             5.26% |        19.45% |

These figures represent project-wide coverage and include functionality outside the Tax module. Therefore, a separate module-specific analysis was performed to evaluate the Tax implementation more accurately.

#### 8.8.2 Tax-Specific Coverage Methodology

The Tax-specific coverage analysis followed the module grouping defined in the project's existing `scripts/coverage-summary.mjs` reporting script.

Backend coverage was obtained from the following directory:

`apps/api/src/app/tax/`

Frontend coverage was obtained from the following React component directories:

- `dividend-withholding/`
- `realized-gains/`
- `tax-lots/`
- `tax-workspace/`
- `yearly-tax-summary/`

The coverage analysis included 22 backend files and 14 React frontend files appearing in the corresponding CI coverage summaries.

Coverage percentages were calculated by dividing the total number of covered items by the total number of measurable items and multiplying by 100. Individual file percentages were not averaged because files contain different numbers of statements, branches, functions and lines.

The analysis used the existing CI coverage artifact rather than executing a separate local test run.

#### 8.8.3 Tax Backend Coverage

| Coverage metric | Covered | Total | Coverage |
| --------------- | ------: | ----: | -------: |
| Statements      |     920 |   995 |   92.46% |
| Branches        |     319 |   391 |   81.59% |
| Functions       |     201 |   213 |   94.37% |
| Lines           |     909 |   984 |   92.38% |

The Tax backend achieved 92.38% line coverage and 81.59% branch coverage across the 22 included files.

The backend coverage results provide evidence that a substantial portion of the instrumented Tax calculation and reporting implementation was exercised by automated tests.

Branch coverage remains lower than statement, function and line coverage, indicating that additional conditional paths could benefit from future testing.

#### 8.8.4 Tax React Frontend Coverage

| Coverage metric | Covered | Total | Coverage |
| --------------- | ------: | ----: | -------: |
| Statements      |     339 |   349 |   97.13% |
| Branches        |     343 |   377 |   90.98% |
| Functions       |     127 |   128 |   99.22% |
| Lines           |     332 |   342 |   97.08% |

The Tax React frontend achieved 97.08% line coverage and 90.98% branch coverage across the 14 included files.

Function coverage reached 99.22%, with 127 of the 128 measured functions exercised.

The frontend testing strategy included successful responses, loading states, error states, empty responses, financial value presentation and user interactions with the supported Tax views.

#### 8.8.5 Comparison Against Proposed Quality Targets

The Iteration 3 QA Execution Plan, aligned with Sprint Plan Revision 2, proposed module-level targets of at least 85% line coverage and 75% branch coverage.

| Metric               | Proposed target | Actual coverage |               Difference |
| -------------------- | --------------: | --------------: | -----------------------: |
| Tax backend lines    |             85% |          92.38% |  +7.38 percentage points |
| Tax backend branches |             75% |          81.59% |  +6.59 percentage points |
| Tax React lines      |             85% |          97.08% | +12.08 percentage points |
| Tax React branches   |             75% |          90.98% | +15.98 percentage points |

Both the Tax backend and React frontend exceeded the proposed line and branch coverage targets.

These targets were proposed internal quality goals rather than confirmed mandatory instructor requirements.

#### 8.8.6 Comparison with Week 3 Coverage

| Module and metric    | Week 3 coverage | Nov 26 CI coverage |
| -------------------- | --------------: | -----------------: |
| Tax backend lines    |           92.4% |             92.38% |
| Tax backend branches |           81.6% |             81.59% |
| Tax React lines      |           97.0% |             97.08% |
| Tax React branches   |           91.0% |             90.98% |

The November 26 CI coverage results remained consistent with the previously recorded Week 3 coverage figures. Small differences should be interpreted with consideration of rounding, changes to the implementation and the number of measurable source lines.

#### 8.8.7 Coverage Limitations

Although the measured coverage percentages are high, code coverage alone does not guarantee financial correctness or the absence of software defects.

The coverage summaries include files instrumented during test execution. Consequently, these percentages do not necessarily represent every production source file associated with the Tax feature.

The frontend coverage grouping also excludes shared components and data-access utilities located outside the selected Tax-specific directories. Although the downloaded artifact contains a report for `format-tax-money.ts`, the module percentages above apply to the defined grouping rather than automatically including every Tax-related utility.

Additionally, high coverage does not demonstrate completion of functionality that remains unimplemented. Browser-based CSV/PDF downloads, dedicated tax-relevance UI filtering and the complete engine-to-export trace integration remain outstanding.

For these reasons, coverage results are considered alongside numerical assertions, component tests, live integration tests, browser testing, manual QA and documented implementation limitations.

**Supporting evidence:**

- [GitHub Actions coverage artifact — Run #45736515597](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/actions/runs/45736515597)
- [Project coverage reporting script](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/scripts/coverage-summary.mjs)
- [Week 3 Test Report](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/docs/testing/week3-test-report.md)
- Iteration 3 QA Execution Plan, aligned with Sprint Plan Revision 2, Section 6 — Quality Gates.

## 9. GitHub Collaboration and Development Process

Development was tracked through GitHub issues, feature branches, pull requests and automated CI workflows.

My contributions across the three iterations consisted of 50 authored and merged pull requests according to the November 26 contribution inventory.

| Iteration                               | Authored and merged PRs |
| --------------------------------------- | ----------------------: |
| Iteration 1 — Design and Data Modelling |                      11 |
| Iteration 2 — Backend Development       |                      21 |
| Iteration 3 — Frontend and QA           |                      18 |
| **Total**                               |                  **50** |

These figures exclude pull requests authored by other team members that I reviewed or helped merge.

During Iterations 2 and 3, Arthur was my assigned pull-request reviewer, while I was responsible for reviewing Sesha's contributions.

Peer review helped identify issues relating to financial calculations, documentation consistency, testing and integration requirements.

AI-assisted development was used to support implementation, debugging, test preparation and documentation. Generated changes were reviewed and validated through the applicable development and testing processes.

The final GitHub collaboration statistics should be reconciled against the team audit before submission.

### 9.1 Scrum Master Responsibilities During Iteration 2

In addition to my technical responsibilities for the Tax module, I served as the Scrum Master during Iteration 2, which focused on backend development.

My responsibilities included maintaining the Scrum documentation structure, monitoring development progress, identifying blockers, tracking pull-request review status and preparing evidence for sprint checkpoints and the retrospective.

At the beginning of the iteration, I prepared a Scrum notes template that provided a consistent structure for recording attendance, current tasks, completed pull requests, outstanding reviews, CI results, blockers and next actions.

The development process emphasized a clear Definition of Done. A task was not considered complete simply because its implementation had been committed or a pull request had been opened. Completion required the associated issue, implementation and tests, independent review, successful CI checks, merge into the main branch and recorded supporting evidence.

I also contributed to maintaining the issue-based development process. For the Tax module, this included resolving outstanding design decisions before implementation and preparing the backend development backlog with clearly defined dependencies.

During the iteration, development progress was reviewed through GitHub issues, pull requests, corrective commits, review comments and CI results. This approach helped distinguish completed implementation from work that was still awaiting review or integration.

At the end of Iteration 2, I prepared a GitHub-based contribution audit, Scrum meeting summary and retrospective documentation. These records were used to assess completed work, review-driven improvements, outstanding blockers and progress against actions identified during the previous iteration.

Where direct meeting records were unavailable, the documentation explicitly distinguished GitHub-reconstructed development evidence from verified meeting information. Attendance and exact meeting discussions were not inferred from repository activity.

This experience helped me understand that Scrum coordination requires more than assigning tasks and monitoring deadlines. It also involves managing dependencies, maintaining transparent development records, encouraging meaningful peer review and ensuring that completed work satisfies the agreed quality requirements.

**Supporting evidence:**

- [Issue #45 — Tax decisions and Scrum notes](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/45)
- [PR #48 — Tax decision records and Scrum documentation](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/48)
- [Issue #173 — Iteration 2 retrospective and meeting summary](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/173)
- [PR #180 — Iteration 2 retrospective and reporting contributions](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/180)
- [Iteration 2 Scrum Notes](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/project-docs/iteration-2/scrum-notes.md)
- [Iteration 2 Scrum Meetings Summary](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/project-docs/iteration-2/scrum-meetings-summary.md)
- [October 30 GitHub Audit](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/project-docs/iteration-2/evidence/github-audit-2026-10-30.md)
- [Iteration 2 Retrospective Summary](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/project-docs/iteration-2/retrospective-summary.md)

### 9.2 Peer Review and Cross-Module Contributions

Peer review was another important part of my contribution throughout the project.

During Iteration 1, I reviewed Arthur's proposed performance-chart data model against Ghostfolio's existing architecture and API contracts. The review identified inconsistencies involving historical portfolio data, invested-capital definitions, date-range values and existing response structures.

Rather than proposing an unnecessary replacement of the existing architecture, I recommended reusing and extending Ghostfolio's established contracts wherever practical.

During Iterations 2 and 3, I was primarily responsible for reviewing Sesha's Risk module contributions. My reviews focused on numerical correctness, implementation scope, API contract consistency, meaningful regression testing and integration with the existing application.

The following examples demonstrate how independent review contributed to improving the project's implementation.

#### Single-Stock Concentration — PR #51

During the review of the single-stock concentration calculation, I identified that the implementation evaluated individual positions rather than aggregating holdings of the same stock across multiple accounts.

For example, a stock representing 6% of a portfolio in one account and another 6% in a second account should represent a combined concentration of 12%.

Without aggregation, the implementation could incorrectly report that both positions satisfied a 10% concentration threshold.

I requested that eligible positions be aggregated by symbol and that a numerical regression test be added.

The subsequent implementation corrected the calculation, and the new test verified the expected 12% concentration result. I approved the PR after reviewing the correction.

#### Risk Health Score — PR #113

While reviewing the Risk health-score calculator, I identified severity-band logic that belonged to a separate warning-threshold implementation task.

I also identified a missing regression test for the case in which every rule within a category was inactive.

The implementation was subsequently corrected to preserve the intended issue scope and verify that fully inactive categories did not affect the remaining weighted score.

After these corrections were reviewed and CI was confirmed successful, I approved the PR.

#### Risk What-If Simulation — PR #138

The what-if simulation required several review rounds before approval.

My initial review identified that the implementation did not yet provide the complete shocked-holdings calculation pipeline required by the issue.

Further reviews identified problems involving warning changes, endpoint validation, scenario information and the treatment of unavailable risk data.

One particularly important finding was that risk rules with unavailable data were being treated as successful rules. This could incorrectly increase the calculated health score.

I requested that unavailable rules be excluded from score weighting and that numerical regression tests verify that missing data did not inflate the resulting score.

The subsequent implementation addressed these concerns. The final review confirmed the corrections and successful CI before approval.

#### Volatility and Covariance Calculation — PR #144

During the review of the volatility-cache implementation, I identified two issues that could affect reported portfolio volatility.

First, the historical data retrieval window used calendar days without providing sufficient observations for the required trading-day calculation window.

Second, returns were aligned using their ending dates even when the returns represented different time intervals.

I requested corrections to the historical lookback and return-alignment methodology, together with regression tests covering missing trading-day observations and insufficient historical data.

The revised implementation addressed these issues, and I approved the PR after verifying the updated tests and CI results.

#### Post-Freeze Risk Regression Review — PR #365

On November 26, I reviewed a regression test intended to verify a previously identified Risk what-if portfolio-value discrepancy.

Although the proposed regression test checked the corrected portfolio value and its CI checks were passing, I identified overlapping changes from another pull request and requested stronger failing-before test evidence.

I also requested additional numerical assertions for the simulation results, confirmation of Scrum Master approval for post-freeze work and coordination with the owner of the shared QA documentation.

A changes-requested review was submitted. Sesha subsequently reported a numerical failing-before result of 10,640 instead of 10,140 and added assertions for the corrected before/after values (10,140 and 9,240), change (−900), and percentage change (approximately −8.88%). After PR #362 merged, PR #365 was rebased to contain only its intended regression test and QA-log update. All seven checks on the rebased head `b6469ce50` passed. As of the November 27 review, the PR remains open; Arthur's post-freeze approval and Raniya's confirmation of the shared QA-log update have not been verified. Issue #355 remains open for the unresolved Overview discrepancy.

This review demonstrates the importance of verifying implementation scope, numerical test quality and agreed development controls even during the final stages of the project.

### 9.3 GitHub Collaboration Evidence

The November 26 contribution audit identified 50 pull requests authored by me and merged across the three development iterations.

A separate GitHub reviewer search returned 58 pull requests associated with my reviewer identity.

These two figures represent different forms of contribution and should not be added together as a count of unique development tasks. The reviewer-search result counts returned pull requests, not individual review submissions or approvals. Some returned PRs may overlap with the authored inventory.

The detailed review history demonstrates that my peer-review contributions included identifying calculation defects, requesting regression tests, improving API contract alignment and verifying corrective changes.

This collaborative process was particularly important because the Risk, Tax, Charts and Dashboard modules share common application infrastructure and financial data.

**Supporting evidence:**

- [Iteration 1 Chart Data Model Peer Review](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/blob/5d6e4b00f/project-docs/iteration-1/tax/peer-review-arthur-chart-data-model.md)
- [PR #51 — Single-stock concentration](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/51)
- [PR #113 — Risk health-score calculation](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/113)
- [PR #138 — Risk what-if simulation](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/138)
- [PR #144 — Volatility and covariance cache](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/144)
- [PR #365 — Risk what-if regression review](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pull/365)
- [Authored and merged pull requests](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pulls?q=is%3Apr+is%3Amerged+author%3ATharunSwaminathan)
- [Pull requests associated with reviewer identity](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/pulls?q=is%3Apr+reviewed-by%3ATharunSwaminathan)

The contribution figures and outstanding review statuses will be refreshed before the final December 5 submission.

## 10. Final Feature Status and Limitations

| Feature                                 | Implementation status                         |
| --------------------------------------- | --------------------------------------------- |
| FIFO capital-gain engine                | Implemented                                   |
| Average Cost capital-gain engine        | Implemented                                   |
| Dividend withholding records            | Implemented                                   |
| FIFO tax-lot tracking                   | Implemented                                   |
| Backend tax-relevant activity filtering | Implemented                                   |
| Yearly tax summary                      | Implemented                                   |
| Historical base-currency conversion     | Implemented with unavailable-rate diagnostics |
| React Tax Lots view                     | Implemented                                   |
| React Realized Gains view               | Implemented                                   |
| React Dividend Withholding view         | Implemented                                   |
| React Yearly Summary view               | Implemented                                   |
| Monetary display formatting             | Implemented; final manual retest pending      |
| Backend CSV generation service          | Implemented and tested                        |
| Backend PDF generation service          | Implemented and tested                        |
| Browser CSV/PDF downloads               | Blocked — Issue #190                          |
| Dedicated tax-relevance UI filter       | Blocked — Issue #242                          |
| Engine-to-export trace adapter          | Incomplete — Issue #155                       |

The primary remaining limitation is the absence of authenticated public CSV and PDF download endpoints. The unfinished browser export work is tracked in [Issue #190](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/190) and remains separate from this documentation PR. Although the backend generation services exist and have been tested, users cannot complete the intended browser-based export workflow.

The dedicated tax-relevance UI filter also remains incomplete because the required frontend and backend contract has not been finalized ([Issue #242](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/242)).

Additionally, the engine-to-export trace adapter requires further work to ensure that all method-specific export trace records are connected directly to the authoritative calculation results ([Issue #155](https://github.com/Ghostfolio-Group-1/ghostfolio-software-engineering-project-g1/issues/155)).

Average Cost acquisition lots are not available through the current tax-lot endpoint. This limitation is explicitly represented in the user interface.

These limitations are recorded to distinguish implemented functionality from planned or partially completed functionality.

Formal story-level acceptance will be updated following the December 3 Sprint Review.

### Local Environment Limitation

On November 26, 2026, an attempt was made to rebuild the local Docker demonstration environment from main commit `5d6e4b00f` for final manual verification and screenshot collection.

The build was interrupted by a Docker build-server communication failure. Subsequent Windows system diagnostics identified multiple unexpected system restarts. The underlying cause of these restarts has not yet been established.

The existing database volume, previous Docker image and report documentation were preserved. No production code changes were made in response to the environmental failure.

The successful GitHub Actions build, unit, component, integration and end-to-end test results remain valid. Final manual verification of the monetary-formatting improvements and screenshot collection remain pending until a verified demonstration environment is available.

## 11. Conclusion

The Tax Metrics and Calculations module successfully extends Ghostfolio with backend tax analytics and an integrated React interface.

Across the three iterations, the work progressed from financial data modelling and calculation specifications to backend implementation, live API integration and multi-layer testing.

The final implemented TaxWorkspace provides users with access to FIFO tax lots, realized gains using two calculation methods, dividend withholding information and yearly tax summaries.

The backend maintains responsibility for financial calculations, while the frontend focuses on displaying authoritative results in a readable and accessible format.

Automated unit, component, integration and browser testing provided evidence of the implemented functionality. Manual quality assurance also identified presentation issues that were addressed through subsequent changes.

Although the browser export workflow, dedicated tax-relevance filter and export trace adapter remain incomplete, the implemented module establishes a maintainable foundation for future tax-related functionality within Ghostfolio.

The project also provided practical experience in financial software development, modular architecture, collaborative version control, automated testing, Scrum coordination and evidence-based software reporting.
