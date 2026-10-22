import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('isTaxRelevant migration', () => {
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const migrationPath = join(
    process.cwd(),
    'prisma',
    'migrations',
    '20261022110000_added_is_tax_relevant_to_order',
    'migration.sql'
  );

  it('defines isTaxRelevant as a non-nullable Boolean with default true', () => {
    const schema = readFileSync(schemaPath, 'utf8');

    expect(schema).toMatch(
      /model Order \{[\s\S]*isTaxRelevant\s+Boolean\s+@default\(true\)[\s\S]*\}/
    );
  });

  it('adds isTaxRelevant as a non-nullable BOOLEAN column', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain(
      'ADD COLUMN "isTaxRelevant" BOOLEAN NOT NULL DEFAULT true;'
    );
  });

  it('defaults existing and new orders to tax relevant', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/isTaxRelevant.*DEFAULT\s+true/i);
  });

  it('does not make isTaxRelevant nullable', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('"isTaxRelevant" BOOLEAN NOT NULL');
  });
});
