import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';

describe('ChartsController', () => {
  const controller = new ChartsController(new ChartsApi());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should be routed under /charts', () => {
    expect(Reflect.getMetadata('path', ChartsController)).toBe('charts');
  });
});
