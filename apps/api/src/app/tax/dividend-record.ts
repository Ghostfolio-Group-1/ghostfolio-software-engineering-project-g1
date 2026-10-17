import { Order, Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

export type DividendRecordSource = Pick<
  Order,
  | 'accountId'
  | 'currency'
  | 'date'
  | 'fee'
  | 'id'
  | 'quantity'
  | 'symbolProfileId'
  | 'type'
  | 'unitPrice'
  | 'withholdingTax'
>;

export interface DividendRecord {
  sourceActivityId: string;
  accountId: string | null;
  symbolProfileId: string;
  date: Date;
  transactionCurrency: string | null;
  grossDividend: Big;
  withholdingTax: Big | null;
  netDividend: Big | null;
  activityFee: Big;
}

export function createDividendRecord(
  activity: DividendRecordSource
): DividendRecord {
  if (activity.type !== ActivityType.DIVIDEND) {
    throw new Error(
      'DividendRecord can only be derived from DIVIDEND activities.'
    );
  }

  const grossDividend = new Big(activity.quantity).mul(activity.unitPrice);
  const withholdingTax =
    activity.withholdingTax === null ? null : new Big(activity.withholdingTax);

  const netDividend =
    withholdingTax === null ? null : grossDividend.minus(withholdingTax);

  return {
    sourceActivityId: activity.id,
    accountId: activity.accountId,
    symbolProfileId: activity.symbolProfileId,
    date: activity.date,
    transactionCurrency: activity.currency,
    grossDividend,
    withholdingTax,
    netDividend,
    activityFee: new Big(activity.fee)
  };
}
