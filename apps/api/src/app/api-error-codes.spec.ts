import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared API conventions (libs/common/src/lib/api-conventions.ts): every
// Iteration 3 error code starts with its own feature's prefix and is
// UPPER_SNAKE_CASE. This reads the source of each feature folder, so a new
// code that breaks the rule fails here before it reaches a client.
const FEATURES = {
  charts: 'CHARTS',
  dashboard: 'DASHBOARD',
  risk: 'RISK',
  tax: 'TAX'
} as const;

const PREFIXES = Object.values(FEATURES);
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const PREFIXED_LITERAL = new RegExp(
  `'((?:${PREFIXES.join('|')})_[A-Za-z0-9_]*)'`,
  'g'
);
const ERROR_RESPONSE_CODE = /createErrorResponse(?:<[^>]*>)?\(\s*'([^']+)'/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

function codesIn(feature: keyof typeof FEATURES) {
  const files = sourceFiles(join(__dirname, feature));
  const prefixed = new Set<string>();
  const passedToErrorResponse = new Set<string>();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    for (const [, code] of source.matchAll(PREFIXED_LITERAL)) {
      prefixed.add(code);
    }

    for (const [, code] of source.matchAll(ERROR_RESPONSE_CODE)) {
      passedToErrorResponse.add(code);
    }
  }

  return { files, passedToErrorResponse, prefixed };
}

describe('Iteration 3 API error codes', () => {
  describe.each(Object.entries(FEATURES))('%s', (feature, prefix) => {
    const { files, passedToErrorResponse, prefixed } = codesIn(
      feature as keyof typeof FEATURES
    );

    it('has source files and at least one error code to check', () => {
      expect(files.length).toBeGreaterThan(0);
      expect(passedToErrorResponse.size + prefixed.size).toBeGreaterThan(0);
    });

    it(`passes only ${prefix}_ codes to createErrorResponse`, () => {
      const wrong = [...passedToErrorResponse].filter((code) => {
        return !code.startsWith(`${prefix}_`);
      });

      expect(wrong).toEqual([]);
    });

    it('uses only its own feature prefix', () => {
      const foreign = [...prefixed].filter((code) => {
        return !code.startsWith(`${prefix}_`);
      });

      expect(foreign).toEqual([]);
    });

    it('writes every code in UPPER_SNAKE_CASE', () => {
      const malformed = [...prefixed, ...passedToErrorResponse].filter(
        (code) => !UPPER_SNAKE.test(code)
      );

      expect(malformed).toEqual([]);
    });
  });
});
