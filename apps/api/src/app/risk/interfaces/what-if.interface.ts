import {
  PortfolioPosition,
  TargetAllocationSettings
} from '@ghostfolio/common/interfaces';

import { VolatilityInput } from '../risk-evaluation.service';
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

// The response's scenario echoes the request plus the matched holding's
// display name (Section 6.11) - WhatIfService reads it straight off the
// matched PortfolioPosition's assetProfile.name, no extra lookup needed.
export interface WhatIfScenarioResult extends WhatIfScenario {
  name: string;
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

export interface WhatIfRequest {
  baseCurrency: string;
  cashBalance: number;
  holdings: PortfolioPosition[];
  scenario: WhatIfScenario;
  targetAllocation?: TargetAllocationSettings;
  volatility?: VolatilityInput;
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
  scenario: WhatIfScenarioResult;
  skippedRules: string[];
}
