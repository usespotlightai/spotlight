import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  aggregateChildWriteViolations,
  childWritesIn,
} from './aggregate-child-writes';
import { KNOWN_AGGREGATE_CHILD_WRITES } from './aggregate-child-writes.known';
import { ratchetProblems } from './known-violations';

const PATH = 'contexts/work/infrastructure/persistence/drizzle/fixture.ts';
const TASK_SCHEMA =
  '@work/infrastructure/persistence/drizzle/schemas/task.schema';

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
      'writes task_note outside the repository of run or task',
    ]);
  });

  it('writes the child tables of an aggregate only beside its root', () => {
    expect(
      ratchetProblems(
        aggregateChildWriteViolations(),
        KNOWN_AGGREGATE_CHILD_WRITES,
      ),
    ).toEqual([]);
  }, 60_000);
});
