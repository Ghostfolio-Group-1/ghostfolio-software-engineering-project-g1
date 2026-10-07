import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('withholdingTax migration', () => {
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const migrationPath = join(
    process.cwd(),
    'prisma',
    'migrations',
    '20261006120000_added_withholding_tax_to_order',
    'migration.sql'
  );

  it('defines withholdingTax as nullable on Order', () => {
    const schema = readFileSync(schemaPath, 'utf8');

    expect(schema).toMatch(
      /model Order \{[\s\S]*withholdingTax\s+Float\?[\s\S]*\}/
    );
  });

  it('adds withholdingTax as a nullable DOUBLE PRECISION column', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain(
      'ALTER TABLE "Order" ADD COLUMN "withholdingTax" DOUBLE PRECISION;'
    );

    expect(migration).not.toContain(
      '"withholdingTax" DOUBLE PRECISION NOT NULL'
    );
  });

  it('does not default unknown withholding to zero', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).not.toMatch(/withholdingTax.*DEFAULT\s+0/i);
  });
});
