module.exports = (async () => {
  const baseConfig = await require('../../eslint.config.cjs');

  return [
    {
      ignores: ['**/dist']
    },
    ...baseConfig,
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      // Override or add rules here
      rules: {},
      languageOptions: {
        parserOptions: {
          project: ['libs/react-ui/tsconfig.*?.json']
        }
      }
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      // Override or add rules here
      rules: {
        '@typescript-eslint/prefer-nullish-coalescing': 'error'
      }
    },
    {
      files: ['**/*.js', '**/*.jsx'],
      // Override or add rules here
      rules: {}
    }
  ];
})();
