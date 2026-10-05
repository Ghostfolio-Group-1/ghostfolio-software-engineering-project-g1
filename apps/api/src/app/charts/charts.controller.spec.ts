import { ChartsController } from './charts.controller';

describe('ChartsController', () => {
  it('should be defined', () => {
    expect(new ChartsController()).toBeDefined();
  });

  it('should be routed under /charts', () => {
    expect(Reflect.getMetadata('path', ChartsController)).toBe('charts');
  });
});
