import { randomUUID } from 'node:crypto';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let held: TestDatabase;
let context: DrizzleContext;

beforeAll(async () => {
  held = await openDatabase('isolation');
  context = new DrizzleContext(held.db);
  await held.db.execute(
    sql`create table isolation_check (id text primary key)`,
  );
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const kept = async (id: string) =>
  (
    await held.db.execute(
      sql`select count(*)::int as n from isolation_check where id = ${id}`,
    )
  ).rows[0] as { n: number };

describe('isolating work inside a transaction', () => {
  it('rolls back only the isolated work when a query in it fails, and the rest commits', async () => {
    const id = randomUUID();

    await context.run(async () => {
      await context
        .isolated(() => context.db.execute(sql`select * from no_such_table`))
        .catch(() => null);
      await context.db.execute(sql`insert into isolation_check values (${id})`);
    });

    expect(await kept(id)).toEqual({ n: 1 });
  });

  it('keeps what the isolated work wrote when it succeeds', async () => {
    const id = randomUUID();

    await context.run(() =>
      context.isolated(() =>
        context.db.execute(sql`insert into isolation_check values (${id})`),
      ),
    );

    expect(await kept(id)).toEqual({ n: 1 });
  });
});
