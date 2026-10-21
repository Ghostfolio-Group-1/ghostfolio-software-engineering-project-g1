import { ThresholdEngineService } from './threshold-engine.service';

describe('ThresholdEngineService', () => {
  const service = new ThresholdEngineService();

  describe('calculateSeverity', () => {
    it('matches the worked example: 33.3% single-stock is RED, 22.2% is YELLOW', () => {
      expect(
        service.calculateSeverity({
          actual: 0.333,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        })
      ).toBe('RED');

      expect(
        service.calculateSeverity({
          actual: 0.222,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'MSFT' }
        })
      ).toBe('YELLOW');
    });

    it('is GREEN exactly at the yellow line (fail is strictly above, not at-or-above)', () => {
      expect(
        service.calculateSeverity({
          actual: 0.1,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        })
      ).toBe('GREEN');
    });

    it('handles band rules correctly on both sides (volatility)', () => {
      expect(
        service.calculateSeverity({
          actual: 0.184,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('GREEN');

      expect(
        service.calculateSeverity({
          actual: 0.4,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('RED');

      expect(
        service.calculateSeverity({
          actual: 0.07,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('YELLOW'); // between redMin (0.05) and thresholdMin (0.10)
    });

    it('returns NO_DATA when actual is null', () => {
      expect(
        service.calculateSeverity({
          actual: null,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        })
      ).toBe('NO_DATA');
    });
  });

  describe('calculateWarnings', () => {
    it('sorts RED before YELLOW, then by biggest overshoot', () => {
      const warnings = service.calculateWarnings([
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
      const warnings = service.calculateWarnings([
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

    it('uses the ceiling template: "{subject} is {actual}% of your portfolio, above the {threshold}% {level} limit"', () => {
      const [warning] = service.calculateWarnings([
        {
          actual: 0.333,
          ruleKey: 'SingleStockConcentration',
          subject: { type: 'stock', value: 'AAPL' }
        }
      ]);

      expect(warning.message).toBe(
        'AAPL is 33.3% of your portfolio, above the 25.0% red limit.'
      );
    });

    it('uses the band template and "below" wording for a low-side breach, preserving a fractional threshold percentage (CashAllocation redThresholdMin = 0.5%)', () => {
      const [warning] = service.calculateWarnings([
        {
          actual: 0.003,
          ruleKey: 'CashAllocation',
          subject: { type: 'bucket', value: 'cash' }
        }
      ]);

      expect(warning.severity).toBe('RED');
      expect(warning.threshold).toBe(0.005);
      expect(warning.message).toBe(
        'Your portfolio cash is 0.3%, below the 0.5% red limit.'
      );
    });

    it('uses "above" wording for a high-side band breach', () => {
      const [warning] = service.calculateWarnings([
        {
          actual: 0.4,
          ruleKey: 'PortfolioVolatility',
          subject: { type: 'portfolio', value: 'volatility' }
        }
      ]);

      expect(warning.message).toContain('above the');
      expect(warning.message).not.toContain('below the');
    });

    it('orders low-side band breaches worst-first (further below the line sorts first), not by the raw actual/threshold ratio', () => {
      // Both RED (below CashAllocation's redThresholdMin = 0.005). The old
      // actual/threshold ratio (0.2 and 0.8) would incorrectly sort the
      // less-bad 0.004 before the much worse 0.001.
      const warnings = service.calculateWarnings([
        {
          actual: 0.004,
          ruleKey: 'CashAllocation',
          subject: { type: 'bucket', value: 'LESS_BAD' }
        },
        {
          actual: 0.001,
          ruleKey: 'CashAllocation',
          subject: { type: 'bucket', value: 'WORST' }
        }
      ]);

      expect(warnings.map((w) => w.subject.value)).toEqual([
        'WORST',
        'LESS_BAD'
      ]);
    });
  });
});
