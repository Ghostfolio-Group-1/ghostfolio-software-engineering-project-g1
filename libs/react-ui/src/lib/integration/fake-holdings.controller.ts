import { Controller, Get } from '@nestjs/common';

// Stands in for PortfolioController's real GET /portfolio/holdings (same
// service-boundary-mock convention risk.e2e.spec.ts already uses for
// PortfolioService/AccountService - pulling in the real PortfolioController
// would need its own Prisma-backed providers, which is out of scope for a
// Risk-module integration test). Kept in its own .ts file since Prettier's
// import-sort plugin only enables decorator parsing for *.ts, not *.tsx
// (see .prettierrc's overrides), and the test file needs .tsx for JSX.
@Controller('portfolio')
export class FakeHoldingsController {
  @Get('holdings')
  getHoldings() {
    return {
      holdings: [
        {
          assetProfile: {
            dataSource: 'YAHOO',
            name: 'Apple Inc.',
            symbol: 'AAPL'
          }
        },
        {
          assetProfile: {
            dataSource: 'YAHOO',
            name: 'Microsoft Corp.',
            symbol: 'MSFT'
          }
        },
        {
          assetProfile: { dataSource: 'YAHOO', name: 'SAP SE', symbol: 'SAP' }
        }
      ]
    };
  }
}
