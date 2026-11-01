import { randomUUID } from 'node:crypto';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let context: DrizzleContext;

beforeAll(async () => {
  database = await openDatabase('savepoint');
  context = new DrizzleContext(database.db);
  await database.db.execute(
    sql`create table savepoint_check (id text primary key)`,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const stored = async (id: string) =>
  (
    await database.db.execute(
      sql`select count(*)::int as n from savepoint_check where id = ${id}`,
    )
  ).rows[0] as { n: number };

describe('work in a savepoint inside a transaction', () => {
  it('rolls back only the savepoint work when a query in it fails, and the rest commits', async () => {
    const id = randomUUID();

    await context.inTransaction(async () => {
      await context
        .inSavepoint(() => context.db.execute(sql`select * from no_such_table`))
        .catch(() => null);
      await context.db.execute(sql`insert into savepoint_check values (${id})`);
    });

    expect(await stored(id)).toEqual({ n: 1 });
  });

  it('keeps what the savepoint work wrote when it succeeds', async () => {
    const id = randomUUID();

    await context.inTransaction(() =>
      context.inSavepoint(() =>
        context.db.execute(sql`insert into savepoint_check values (${id})`),
      ),
    );

    expect(await stored(id)).toEqual({ n: 1 });
  });

  it('runs what the savepoint work defers to the commit only when the savepoint work succeeds', async () => {
    const ran: string[] = [];

    await context.inTransaction(async () => {
      await context
        .inSavepoint(async () => {
          context.afterCommit(() => ran.push('rolled back'));
          throw new Error('the savepoint work failed');
        })
        .catch(() => null);
      await context.inSavepoint(async () => {
        context.afterCommit(() => ran.push('kept'));
      });
    });

    expect(ran).toEqual(['kept']);
  });

  it('runs nothing an inner savepoint defers to the commit once its outer savepoint rolls back', async () => {
    const ran: string[] = [];

    await context.inTransaction(async () => {
      await context
        .inSavepoint(async () => {
          await context.inSavepoint(async () => {
            context.afterCommit(() => ran.push('inner'));
          });
          throw new Error('the outer savepoint work failed');
        })
        .catch(() => null);
      context.afterCommit(() => ran.push('transaction'));
    });

    expect(ran).toEqual(['transaction']);
  });
});
