import { validateSync } from 'class-validator';

import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';

function getTaxRelevantErrors(
  dto: CreateOrderDto | UpdateOrderDto,
  isTaxRelevant?: unknown
) {
  Object.assign(dto, { isTaxRelevant });

  return validateSync(dto).filter(
    ({ property }) => property === 'isTaxRelevant'
  );
}

describe('isTaxRelevant DTO validation', () => {
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
      it('allows isTaxRelevant to be omitted', () => {
        expect(getTaxRelevantErrors(create())).toHaveLength(0);
      });

      it('allows true', () => {
        expect(getTaxRelevantErrors(create(), true)).toHaveLength(0);
      });

      it('allows false', () => {
        expect(getTaxRelevantErrors(create(), false)).toHaveLength(0);
      });

      it('rejects a string value', () => {
        const errors = getTaxRelevantErrors(create(), 'false');

        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.isBoolean).toBeDefined();
      });

      it('rejects a numeric value', () => {
        const errors = getTaxRelevantErrors(create(), 0);

        expect(errors).toHaveLength(1);
        expect(errors[0].constraints?.isBoolean).toBeDefined();
      });
    });
  }
});
