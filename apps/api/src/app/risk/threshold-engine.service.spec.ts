import { ThresholdEngineService } from './threshold-engine.service';

describe('ThresholdEngineService', () => {
  const service = new ThresholdEngineService();

  describe('computeSeverity', () => {
    it('matches the worked example: 33.3% single-stock is RED, 22.2% is YELLOW', () => {
      expect(
        service.computeSeverity({
          actual: 0.333,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        })
      ).toBe('RED');

      expect(
        service.computeSeverity({
          actual: 0.222,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'MSFT' }
        })
      ).toBe('YELLOW');
    });

    it('is GREEN exactly at the yellow line (fail is strictly above, not at-or-above)', () => {
      expect(
        service.computeSeverity({
          actual: 0.1,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        })
      ).toBe('GREEN');
    });

    it('handles band rules correctly on both sides (volatility)', () => {
      expect(
        service.computeSeverity({
          actual: 0.184,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('GREEN');

      expect(
        service.computeSeverity({
          actual: 0.4,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('RED');

      expect(
        service.computeSeverity({
          actual: 0.07,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('YELLOW'); // between redMin (0.05) and thresholdMin (0.10)
    });

    it('returns NO_DATA when actual is null', () => {
      expect(
        service.computeSeverity({
          actual: null,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('NO_DATA');
    });
  });

  describe('buildWarnings', () => {
    it('sorts RED before YELLOW, then by biggest overshoot', () => {
      const warnings = service.buildWarnings([
        {
          actual: 0.222,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'MSFT' }
        },
        {
          actual: 0.5,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        },
        {
          actual: 0.26,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'TSLA' }
        }
      ]);

      expect(warnings.map((w) => w.subject.value)).toEqual([
        'AAPL',
        'TSLA',
        'MSFT'
      ]);
      expect(warnings[0].severity).toBe('RED');
      expect(warnings[2].severity).toBe('YELLOW');
    });

    it('omits GREEN and NO_DATA results entirely', () => {
      const warnings = service.buildWarnings([
        {
          actual: 0.05,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'SAFE' }
        },
        {
          actual: null,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        }
      ]);

      expect(warnings).toHaveLength(0);
    });
  });
});
