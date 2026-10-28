import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prettierBin = require.resolve('prettier/bin/prettier.cjs');

const output = execFileSync(
  'git',
  ['diff', '--name-only', '--cached', '--diff-filter=ACMR'],
  { encoding: 'utf8' }
);

const files = output
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);

if (files.length === 0) {
  console.log('No staged files to format.');
  process.exit(0);
}

execFileSync(
  process.execPath,
  [prettierBin, '--write', '--ignore-unknown', ...files],
  { stdio: 'inherit' }
);
