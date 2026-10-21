import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { WeightedRuleResult } from './health-score.interface';
import { RiskWarning } from './risk-warning.interface';
import { Severity } from './severity.type';

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface WhatIfScenario {
  dataSource: string;
  dropPercentage: number;
  symbol: string;
}

export interface WhatIfRuleChange {
  actualAfter: number | null;
  actualBefore: number | null;
  ruleKey: string;
  severityAfter: Severity;
  severityBefore: Severity;
}

export interface WhatIfCategoryScore {
  key: string;
  scoreAfter: number | null;
  scoreBefore: number | null;
}

// Before/after rule results are supplied by the caller rather than
// recomputed here: the pipeline that turns real holdings into
// WeightedRuleResult[]/RiskWarning[] isn't wired anywhere yet (risk.module.ts
// only provides ExposureService/ExposureCalculatorService). See
// what-if.service.ts's class comment.
export interface WhatIfRequest {
  baseCurrency: string;
  holdings: PortfolioPosition[];
  ruleResultsAfter: WeightedRuleResult[];
  ruleResultsBefore: WeightedRuleResult[];
  scenario: WhatIfScenario;
  skippedRuleKeys?: string[];
  warningsAfter: RiskWarning[];
  warningsBefore: RiskWarning[];
}

export interface WhatIfResult {
  calculatedAt: Date;
  categories: WhatIfCategoryScore[];
  changedWarnings: RiskWarning[];
  holding: {
    allocationAfter: number;
    allocationBefore: number;
    valueAfter: MoneyAmount;
    valueBefore: MoneyAmount;
  };
  newWarnings: RiskWarning[];
  portfolio: {
    change: MoneyAmount;
    changePercentage: number;
    valueAfter: MoneyAmount;
    valueBefore: MoneyAmount;
  };
  resolvedWarnings: RiskWarning[];
  ruleChanges: WhatIfRuleChange[];
  score: {
    after: number | null;
    before: number | null;
    change: number | null;
  };
  scenario: WhatIfScenario;
  skippedRules: string[];
}
