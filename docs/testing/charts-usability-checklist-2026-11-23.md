# Charts usability checklist — Mon Nov 23, 2026

Rev 2 / QA Execution Plan, Mon 11/23: polish chart interactions (learnability,
contrast, keyboard use) and fix the bugs that check finds. Scope is the chart
controls mounted today: the overview `InteractiveChart` (range presets and
value / invested / cash), `DrawdownCard`, and the waterfall breakdown toggle
in the library. Pointer readout stays on open PR #226. Benchmark comparison
stays blocked on #160.

Tester: Arthur. Date: Mon Nov 23, 2026. Contrast figures use the WCAG
relative-luminance formula against `#ffffff` and the dark background
`#121212`.

## Results

| #   | Check                                                           | Screen                                    | Result            | Notes                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------- | ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Range and kind are named groups, not a loose set of buttons     | Interactive chart                         | **Fail -> Fixed** | The range group already had `role="group"` and `aria-label="Time range"`. The kind toggle set `aria-label="Chart series"` on a plain `div`, so the name was dropped. It is now `role="group"`. The waterfall breakdown group had a role and no name; it is now "Contribution breakdown".               |
| 2   | A keyboard user can see which chart control is focused          | Range, kind, and waterfall toggles        | **Fail -> Fixed** | `apps/client/src/styles.scss` sets `button:focus { outline: 0 }`. None of these buttons replaced that ring. Focus now draws a 2px outline in `theme.color.text` (`#212121` on light, 16.1:1 on white; `#fafafa` on dark).                                                                              |
| 3   | The plotted line meets 3:1 against its background (WCAG 1.4.11) | ChartWrapper, used by series and drawdown | **Fail -> Fixed** | Light theme stroked the line in primary `#36cfcc`, 1.92:1 on white. Light theme now uses `#0d7377` (5.62:1 on white). Dark theme keeps `#36cfcc` (9.77:1 on `#121212`). The shared primary token is unchanged: selected-button text sits on that fill at 8.40:1 (`#212121`) and 9.77:1 (`#121212`).    |
| 4   | Waterfall category names are readable, not only the bar colour  | Waterfall legend                          | **Fail -> Fixed** | The words were painted in the bar colour. On white that is 1.92:1 (market), 3.13:1 (dividends) and 3.84:1 (net cash flow), all under the 4.5:1 text minimum. The words are now `theme.color.text`. A swatch keeps the bar colour. The market bar and swatch use the same light-theme mark as the line. |
| 5   | Selected control text meets 4.5:1                               | Range, kind, and waterfall toggles        | Pass              | Selected label is `primaryText` on `#36cfcc`: 8.40:1 in light, 9.77:1 in dark.                                                                                                                                                                                                                         |
| 6   | Drawdown states the maximum in text, not only on the line       | Drawdown card                             | Pass              | "Max drawdown" plus the formatted percent and date stay in the card. No local control, so the focus-ring bug does not apply. The line uses the ChartWrapper mark from #3.                                                                                                                              |
| 7   | Changing range or kind does not depend on a mouse               | Interactive chart                         | Pass              | Both controls are native buttons (`type="button"`), so Enter and Space activate them. No custom tab order.                                                                                                                                                                                             |
| 8   | Server error text is not shown on the chart                     | Series, drawdown, waterfall               | Pass              | Existing component tests still require the generic message and reject the server string.                                                                                                                                                                                                               |

## Regression tests

- `chart-wrapper.spec.tsx` — light stroke is `#0d7377`; dark stroke stays `#36cfcc`.
- `interactive-chart.spec.tsx` — focusing a range button sets the inline ring.
- `chart-series-card.spec.tsx` — the kind toggle is a named group, and focusing Cash sets the ring.
- `waterfall-card.spec.tsx` — the breakdown group is named, the market label is body text, and the market bar is `#0d7377` on light.

The new assertions are the regression: a light stroke of `#36cfcc`, a kind toggle without `role="group"`, or a focused button with an empty outline fails them.

## Not changed

- `designTokens.color.primary` stays `#36cfcc`. It is the selected-button fill, where the label already clears 4.5:1. Changing the token would touch every module.
- Pointer readout and arrow-key movement of a point stay on #226.
- Benchmark comparison stays blocked on #160. The waterfall HTTP route is still not on `ChartsController`; only the React card was adjusted.
