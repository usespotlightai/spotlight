import { readFileSync, writeFileSync } from 'node:fs';

const [, , file] = process.argv;
const generated = readFileSync(file, 'utf8');

if (!generated.includes('  timestamp,\n')) {
  throw new Error(`${file} imports no timestamp column to replace`);
}

const written = `import { timestamptz } from "@platform/persistence/drizzle/columns";\n${generated
  .replace('  timestamp,\n', '')
  .replaceAll('timestamp("', 'timestamptz("')}`;

writeFileSync(file, written);
