import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { versionedWritesIn } from './versioned-writes';

const PATH = 'contexts/work/infrastructure/persistence/fixture.ts';
const TASK_SCHEMA =
  '@work/infrastructure/persistence/drizzle/schemas/task.schema';

const writesIn = (source: string): string[] =>
  versionedWritesIn({
    path: PATH,
    tree: ts.createSourceFile(PATH, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(`${PATH}: `, ''));

describe('versioned writes', () => {
  it('accepts an update on the version', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        db.update(task).set({ version: v + 1 }).where(and(eq(task.id, id), eq(task.version, v)));`),
    ).toEqual([]);
  });

  it('follows the version condition through a helper in scope', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        class Tasks {
          private matching(saved) { return and(eq(task.id, saved.id), eq(task.version, saved.version)); }
          save(saved) { return db.update(task).set({ version: saved.version + 1 }).where(this.matching(saved)); }
        }`),
    ).toEqual([]);
  });

  it('finds an update without the version', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        db.update(task).set({ version: v + 1 }).where(eq(task.id, id));`),
    ).toEqual(['update task without its version']);
  });

  it('finds an update that does not raise the version', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        db.update(task).set({ title }).where(and(eq(task.id, id), eq(task.version, v)));`),
    ).toEqual(['update task without raising its version']);
  });

  it('does not take the version from a declaration out of scope', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        const one = () => { const at = eq(task.version, 1); return at; };
        const other = (at) => db.delete(task).where(at);`),
    ).toEqual(['delete task without its version']);
  });

  it('does not take the version from a property with the same name', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        const at = eq(task.version, 1);
        db.delete(task).where(eq(task.id, held.at));`),
    ).toEqual(['delete task without its version']);
  });

  it('finds an upsert without the version', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        db.insert(task).values({}).onConflictDoUpdate({ target: task.id, set: { version: sql\`\${task.version} + 1\` } });`),
    ).toEqual(['upsert task without its version']);
  });

  it('finds a write through a namespace import', () => {
    expect(
      writesIn(`import * as schema from '${TASK_SCHEMA}';
        db.delete(schema.task).where(eq(schema.task.id, id));`),
    ).toEqual(['delete task without its version']);
  });

  it('finds a write to a table it cannot resolve', () => {
    expect(
      writesIn(
        'const purge = (table) => db.delete(table).where(lt(table.at, now));',
      ),
    ).toEqual(['delete of a table the check cannot resolve']);
  });

  it('finds raw writes', () => {
    expect(
      writesIn(`import { task } from '${TASK_SCHEMA}';
        db.execute(sql\`update "public"."task" set title = 'x'\`);
        db.execute(sql\`delete from \${task} where id = \${id}\`);
        db.execute(sql.raw('delete from task'));
        db.execute(sql\`insert into task (id) values (\${id}) on conflict (id) do update set title = 'x'\`);`),
    ).toEqual([
      'update task without its version',
      'delete task without its version',
      'upsert task without its version',
      'delete task without its version',
    ]);
  });
});
