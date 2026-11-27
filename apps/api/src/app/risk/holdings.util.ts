import { PortfolioPosition } from '@ghostfolio/common/interfaces';

// Issue #323: PortfolioService.getHoldings() can return a synthetic CASH
// position (assetSubClass CASH, e.g. a "USD" holding backing the account's
// cash balance) alongside real stock holdings. Cash is already tracked
// separately wherever a cashBalance is passed in (AccountService.
// getCashDetails()), so counting it again as a "holding" double-counts it
// into any total built from these holdings. Used by
// RiskEvaluationService.evaluate(), ExposureService.getRiskSummary() (for
// totalValue and the stock/sector/country/currency concentration buckets -
// not exposure.currency/assetClass, which intentionally keep cash) and
// target-allocation.mapper.ts's TargetDeviation (which already injects its
// own dedicated 'CASH' bucket from cashBalance directly).
export function excludeCashHoldings(
  holdings: PortfolioPosition[]
): PortfolioPosition[] {
  return holdings.filter(
    (holding) => holding.assetProfile.assetSubClass !== 'CASH'
  );
}
