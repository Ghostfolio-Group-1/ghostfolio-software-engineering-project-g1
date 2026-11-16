#!/usr/bin/env node
// Turns the Jest json-summary files under coverage/ into one Markdown report:
// a row per Nx project, then a row per Iteration 3 area (Risk, Tax, Charts,
// Dashboard, shared React library). Report only, no thresholds yet (those
// come with the required checks, Rev 2 Section 6).
//   node scripts/coverage-summary.mjs [coverageDir]
// In GitHub Actions the report is also appended to $GITHUB_STEP_SUMMARY.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const coverageDir = process.argv[2] ?? 'coverage';
const METRICS = ['lines', 'statements', 'functions', 'branches'];

const AREAS = [
  ['Risk API', 'apps/api/src/app/risk/'],
  ['Tax API', 'apps/api/src/app/tax/'],
  ['Charts API', 'apps/api/src/app/charts/'],
  ['Dashboard API', 'apps/api/src/app/dashboard/'],
  ['Shared API conventions', 'libs/common/src/lib/api-conventions'],
  ['React: Risk', 'libs/react-ui/src/lib/risk'],
  ['React: Tax', 'libs/react-ui/src/lib/tax'],
  ['React: Charts', 'libs/react-ui/src/lib/chart'],
  ['React: Dashboard page', 'libs/react-ui/src/lib/dashboard-page/'],
  ['React: data layer', 'libs/react-ui/src/lib/data/'],
  ['React host (Angular)', 'apps/client/src/app/components/react-host/']
];

function findSummaries(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return findSummaries(path);
    }

    return entry.name === 'coverage-summary.json' ? [path] : [];
  });
}

function empty() {
  return Object.fromEntries(METRICS.map((m) => [m, { covered: 0, total: 0 }]));
}

function add(into, from) {
  for (const m of METRICS) {
    into[m].covered += from[m].covered;
    into[m].total += from[m].total;
  }
}

function pct({ covered, total }) {
  return total === 0 ? 'n/a' : `${((covered / total) * 100).toFixed(1)}%`;
}

function row(name, totals) {
  return `| ${name} | ${METRICS.map((m) => pct(totals[m])).join(' | ')} | ${totals.lines.total} |`;
}

const summaries = findSummaries(coverageDir);

if (summaries.length === 0) {
  console.error(`No coverage-summary.json found under ${coverageDir}`);
  process.exit(1);
}

const projectRows = [];
const areaTotals = new Map(AREAS.map(([name]) => [name, empty()]));

for (const file of summaries.sort()) {
  const project = relative(coverageDir, join(file, '..')).split(sep).join('/');
  const summary = JSON.parse(readFileSync(file, 'utf8'));

  projectRows.push(row(project, summary.total));

  for (const [path, totals] of Object.entries(summary)) {
    if (path === 'total') {
      continue;
    }

    const repoPath = relative(root, path).split(sep).join('/');

    for (const [name, prefix] of AREAS) {
      if (repoPath.startsWith(prefix)) {
        add(areaTotals.get(name), totals);
      }
    }
  }
}

const header =
  '| | Lines | Statements | Functions | Branches | Lines counted |\n| --- | --- | --- | --- | --- | --- |';
const areaRows = AREAS.filter(([name]) => {
  return areaTotals.get(name).lines.total > 0;
}).map(([name]) => row(name, areaTotals.get(name)));

const report = [
  '## Unit test coverage',
  '',
  'By Nx project:',
  '',
  header,
  ...projectRows,
  '',
  'Iteration 3 areas (files loaded by at least one test):',
  '',
  header,
  ...areaRows,
  ''
].join('\n');

console.log(report);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
}
