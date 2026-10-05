import { TaxController } from './tax.controller';

describe('TaxController', () => {
  it('should be defined', () => {
    expect(new TaxController()).toBeDefined();
  });

  it('should be routed under /tax', () => {
    expect(Reflect.getMetadata('path', TaxController)).toBe('tax');
  });
});
