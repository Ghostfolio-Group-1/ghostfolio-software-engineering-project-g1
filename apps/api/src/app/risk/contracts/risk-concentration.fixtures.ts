import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { RiskSummary } from '../interfaces/risk-summary.interface';

export const holdingsFixture = [
  { assetProfile: { name: 'Apple Inc.', symbol: 'AAPL' } },
  { assetProfile: { name: 'Microsoft Corp.', symbol: 'MSFT' } },
  { assetProfile: { symbol: 'NVDA' } }
] as unknown as PortfolioPosition[];

export const riskSummaryFixture: RiskSummary = {
  concentration: {
    country: [
      { key: 'DE', percentage: 0.12, value: 1080 },
      { key: 'US', percentage: 0.48, value: 4320 }
    ],
    currency: [
      { key: 'EUR', percentage: 0.42, value: 3780 },
      { key: 'USD', percentage: 0.58, value: 5220 }
    ],
    sector: [
      { key: 'Healthcare', percentage: 0.2, value: 1800 },
      { key: 'Technology', percentage: 0.41, value: 3690 },
      { key: 'UNKNOWN', percentage: 0.39, value: 3510 }
    ],
    stock: [
      { key: 'NVDA', percentage: 0.111, value: 999 },
      { key: 'AAPL', percentage: 0.333, value: 2997 },
      { key: 'TSLA', percentage: 0.033, value: 297 },
      { key: 'MSFT', percentage: 0.222, value: 1998 },
      { key: 'AMZN', percentage: 0.044, value: 396 },
      { key: 'GOOG', percentage: 0.056, value: 504 }
    ]
  },
  exposure: {
    assetClass: [{ key: 'EQUITY', percentage: 1, value: 9000 }],
    currency: [
      { key: 'EUR', percentage: 0.42, value: 3780 },
      { key: 'USD', percentage: 0.58, value: 5220 }
    ]
  },
  totalValue: 9000
};
