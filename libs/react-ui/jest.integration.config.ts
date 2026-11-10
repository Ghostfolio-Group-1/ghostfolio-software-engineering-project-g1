// UI-to-API integration harness: renders the React screens against a running
// API. Kept out of the unit run (jest.config.ts); see integration/README.md.
export default {
  displayName: 'react-ui-integration',
  globals: {},
  testEnvironment: '<rootDir>/integration/jsdom-with-fetch.ts',
  testMatch: ['<rootDir>/integration/**/*.integration.tsx'],
  testTimeout: 60000,
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.integration.json' }
    ]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  preset: '../../jest.preset.js'
};
