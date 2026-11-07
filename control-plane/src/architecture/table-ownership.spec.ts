import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';
import { tableAccessIn, tableOwnershipViolations } from './table-ownership';
import { KNOWN_TABLE_OWNERSHIP } from './table-ownership.known';

const PATH = 'contexts/memory/infrastructure/persistence/drizzle/fixture.ts';

const accessIn = (source: string): string[] =>
  tableAccessIn({
    path: PATH,
    tree: ts.createSourceFile(PATH, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(`${PATH}: `, ''));

describe('table ownership', () => {
  it('accepts its own tables', () => {
    expect(
      accessIn(`import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
        db.execute(sql\`select id from memory\`);`),
    ).toEqual([]);
  });

  it('finds another context schema and table', () => {
    expect(
      accessIn(`import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
        db.execute(sql\`select id from task join "run" on true\`);`),
    ).toEqual([
      'imports the schema of work (contexts/work/infrastructure/persistence/drizzle/schemas/task.schema)',
      'names task of work in SQL',
      'names run of runs in SQL',
    ]);
  });

  it('reads and writes only the tables of its own context', () => {
    expect(
      ratchetProblems(tableOwnershipViolations(), KNOWN_TABLE_OWNERSHIP),
    ).toEqual([]);
  }, 60_000);
});
