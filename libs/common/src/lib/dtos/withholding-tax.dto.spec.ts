import { validateSync } from 'class-validator';

import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';

function getWithholdingTaxErrors(
  dto: CreateOrderDto | UpdateOrderDto,
  withholdingTax?: unknown
) {
  Object.assign(dto, { withholdingTax });

  return validateSync(dto).filter(
    ({ property }) => property === 'withholdingTax'
  );
}

describe('withholdingTax DTO validation', () => {
  const dtoFactories = [
    {
      create: () => new CreateOrderDto(),
      name: 'CreateOrderDto'
    },
    {
      create: () => new UpdateOrderDto(),
      name: 'UpdateOrderDto'
    }
  ];

  for (const { create, name } of dtoFactories) {
    describe(name, () => {
      it('allows withholdingTax to be omitted', () => {
        expect(getWithholdingTaxErrors(create())).toHaveLength(0);
      });

      it('allows null for unknown withholding', () => {
        expect(getWithholdingTaxErrors(create(), null)).toHaveLength(0);
      });

      it('allows zero for known no withholding', () => {
        expect(getWithholdingTaxErrors(create(), 0)).toHaveLength(0);
      });

      it('allows a positive withholding amount', () => {
        expect(getWithholdingTaxErrors(create(), 15.25)).toHaveLength(0);
      });

      it('rejects a negative withholding amount', () => {
        const errors = getWithholdingTaxErrors(create(), -0.01);

        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.min).toBeDefined();
      });

      it('rejects a non-numeric withholding amount', () => {
        const errors = getWithholdingTaxErrors(create(), '15');

        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.isNumber).toBeDefined();
      });
    });
  }
});
