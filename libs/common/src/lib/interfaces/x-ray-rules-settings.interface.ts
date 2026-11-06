export interface XRayRulesSettings {
  AccountClusterRiskCurrentInvestment?: RuleSettings;
  AccountClusterRiskSingleAccount?: RuleSettings;
  AssetClassClusterRiskEquity?: RuleSettings;
  AssetClassClusterRiskFixedIncome?: RuleSettings;
  BuyingPower?: RuleSettings;
  // The 5 remaining risk-module rules (docs/sesha-notes/10-risk-api-contract.md,
  // Section 10) that aren't already covered above by name -
  // CurrencyClusterRiskCurrentInvestment is shared with the existing X-Ray
  // rule of the same key.
  CashAllocation?: RuleSettings;
  CountryConcentration?: RuleSettings;
  CurrencyClusterRiskBaseCurrencyCurrentInvestment?: RuleSettings;
  CurrencyClusterRiskCurrentInvestment?: RuleSettings;
  EconomicMarketClusterRiskDevelopedMarkets?: RuleSettings;
  EconomicMarketClusterRiskEmergingMarkets?: RuleSettings;
  EmergencyFundCoverage?: RuleSettings;
  EmergencyFundSetup?: RuleSettings;
  FeeRatioTotalInvestmentVolume?: RuleSettings;
  PortfolioVolatility?: RuleSettings;
  RegionalMarketClusterRiskAsiaPacific?: RuleSettings;
  RegionalMarketClusterRiskEmergingMarkets?: RuleSettings;
  RegionalMarketClusterRiskEurope?: RuleSettings;
  RegionalMarketClusterRiskJapan?: RuleSettings;
  RegionalMarketClusterRiskNorthAmerica?: RuleSettings;
  SectorConcentration?: RuleSettings;
  SingleStockConcentration?: RuleSettings;
  TargetAllocationDeviation?: RuleSettings;
}

export interface RuleSettings {
  isActive: boolean;
  // redThresholdMax/redThresholdMin extend the original X-Ray max/min pair
  // with the risk module's second (red) band - docs/sesha-notes/10-risk-api-
  // contract.md, Section 10. Optional and additive: existing X-Ray rules
  // that never set them are unaffected.
  redThresholdMax?: number;
  redThresholdMin?: number;
  thresholdMax?: number;
  thresholdMin?: number;
}
