import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  aggregateChildWriteViolations,
  childWritesIn,
} from './aggregate-child-writes';
import { described } from './violation';

const PATH = 'contexts/work/infrastructure/persistence/drizzle/fixture.ts';
const TASK_SCHEMA =
  '@work/infrastructure/persistence/drizzle/schemas/task.schema';
const TOOL_USE_SCHEMA =
  '@work/infrastructure/persistence/drizzle/schemas/tool-use.schema';

const writesIn = (source: string): string[] =>
  childWritesIn({
    path: PATH,
    tree: ts.createSourceFile(PATH, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(`${PATH}: `, ''));

describe('aggregate child writes', () => {
  it('accepts a child written beside its root', () => {
    expect(
      writesIn(`import { task, taskMark } from '${TASK_SCHEMA}';
        db.update(task).set({ version: v + 1 }).where(eq(task.version, v));
        db.delete(taskMark).where(eq(taskMark.taskId, id));`),
    ).toEqual([]);
  });

  it('finds a child written without its root', () => {
    expect(
      writesIn(`import { taskMark } from '${TASK_SCHEMA}';
        db.delete(taskMark).where(eq(taskMark.taskId, id));
        db.execute(sql\`insert into task_note (id) values (\${id})\`);`),
    ).toEqual([
      'writes task_mark outside the repository of task',
      'writes task_note outside the repository of task',
    ]);
  });

  it('finds a declared ledger written outside its declared writers', () => {
    expect(
      writesIn(`import { toolUse } from '${TOOL_USE_SCHEMA}';
        db.insert(toolUse).values(row);
        db.execute(sql\`delete from run_usage where run_id = \${id}\`);`),
    ).toEqual([
      'writes tool_use outside its declared writers',
      'writes run_usage outside its declared writers',
    ]);
  });

  it('writes the child tables of an aggregate only beside its root', () => {
    expect(described(aggregateChildWriteViolations())).toEqual([]);
  }, 60_000);
});
