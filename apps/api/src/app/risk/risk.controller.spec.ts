import { RiskController } from './risk.controller';

describe('RiskController', () => {
  it('should be defined', () => {
    expect(new RiskController()).toBeDefined();
  });

  it('should be routed under /risk', () => {
    expect(Reflect.getMetadata('path', RiskController)).toBe('risk');
  });
});
