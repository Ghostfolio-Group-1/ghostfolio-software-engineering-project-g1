import { ExposureBucket } from '../exposure-calculator.service';

export interface RiskSummary {
  concentration: {
    country: ExposureBucket[];
    currency: ExposureBucket[];
    sector: ExposureBucket[];
    stock: ExposureBucket[];
  };
  exposure: {
    assetClass: ExposureBucket[];
    currency: ExposureBucket[];
  };
  totalValue: number;
}
