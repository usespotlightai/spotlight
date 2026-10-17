import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { ProposedDecision } from '@change-review/domain/entities/decision.entity';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { DrizzleDecisionReader } from '@change-review/infrastructure/persistence/drizzle/repositories/decision.reader';
import { DrizzleDecisionSetRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const FIRST = RunId.of('run_1');
const SECOND = RunId.of('run_2');

const GROUNDS = DecisionGrounds.of({
  steps: [3, 7],
  changed: ['api/src/uploads.ts', 'api/src/retry.ts'],
});

const decided = (change: Partial<ProposedDecision> = {}): ProposedDecision => ({
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run.',
  alternatives: ['Retry from a queue'],
  paths: ['api/src/uploads.ts'],
  steps: [3],
  ...change,
});

const drafting = (
  set: DecisionSet,
  runId: RunId,
  decisions: readonly ProposedDecision[],
  grounds: DecisionGrounds = GROUNDS,
): DecisionSet => {
  let made = 0;
  return set.recordDraft({
    runId,
    proposed: decisions,
    grounds,
    newId: () => {
      made += 1;
      return `${set.id.value}_${runId.value}_${made}`;
    },
  });
};

const merge = (repository: string, at: Date) =>
  DecisionMerge.of({
    repository: Repository.of(repository),
    commit: 'a'.repeat(40),
    at,
  });

let database: TestDatabase;
let sets: DrizzleDecisionSetRepository;
let next = 0;

const opened = () => {
  next += 1;
  return DecisionSet.open({
    id: DecisionSetId.of(`set_${next}`),
    taskId: TaskId.of(`task_${next}`),
    workspaceId: WorkspaceId.of('ws_1'),
  });
};

beforeAll(async () => {
  database = await openDatabase('decision_sets');
  sets = new DrizzleDecisionSetRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('storing a task’s decisions', () => {
  it('keeps the decisions a run grounds, in order, and the run it drafted them from', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);

    await sets.save(
      drafting(set, FIRST, [
        decided({
          kind: 'limitation',
          title: 'Retries only once',
          steps: [7, 3],
        }),
        decided(),
      ]),
    );

    const read = await sets.forTask(set.taskId);

    expect(read?.decidedIn?.equals(FIRST)).toBe(true);
    expect(read?.owesWork).toBe(false);
    expect(
      read?.decisions.map((each) => [each.kind, each.title, each.steps]),
    ).toEqual([
      ['limitation', 'Retries only once', [3, 7]],
      ['trade-off', 'Retries uploads in the request', [3]],
    ]);
    expect(read?.decisions[1]?.alternatives).toEqual(['Retry from a queue']);
  });

  it('replaces what an earlier run decided with what the latest decided', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(
      drafting(set, FIRST, [decided(), decided({ title: 'Second' })]),
    );

    const again = (await sets.forTask(set.taskId))?.asked(SECOND, NOW);
    if (!again) throw new Error('not stored');
    await sets.save(again);
    const read = await sets.forTask(set.taskId);
    if (!read) throw new Error('not stored');
    await sets.save(
      drafting(read, SECOND, [
        decided({ kind: 'deviation', title: 'Skipped the retry banner' }),
      ]),
    );

    const latest = await sets.forTask(set.taskId);

    expect(latest?.decidedIn?.equals(SECOND)).toBe(true);
    expect(latest?.decisions.map((each) => each.title)).toEqual([
      'Skipped the retry banner',
    ]);
  });

  it('hands out a set owing a draft once its lease runs out, and none while the lease runs', async () => {
    await database.db.execute(sql`delete from decision_set`);
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);

    const due = await sets.dueForWork(NOW);
    expect(due?.id.equals(set.id)).toBe(true);

    if (!due) throw new Error('not due');
    await sets.save(due.leased(NOW));

    expect(await sets.dueForWork(NOW)).toBeNull();
    expect(
      (
        await sets.dueForWork(new Date(NOW.getTime() + 31 * 60 * 1000))
      )?.id.equals(set.id),
    ).toBe(true);
  });

  it('keeps the merge of its decisions', async () => {
    const set = opened();
    await sets.add(set);

    await sets.save(set.merge(merge('acme/api', NOW)));

    const read = await sets.forTask(set.taskId);

    expect(read?.status.isMerged).toBe(true);
    expect(read?.status.merge?.repository.value).toBe('acme/api');
    expect(read?.status.merge?.at.toISOString()).toBe(NOW.toISOString());
  });

  it('refuses to write over a set that changed since it was read', async () => {
    const set = opened();
    await sets.add(set);
    await sets.save(set.asked(FIRST, NOW));

    await expect(sets.save(set.asked(SECOND, NOW))).rejects.toThrow(
      DecisionSetVersionConflictError,
    );
  });

  it('forgets a task’s decisions with the task', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(drafting(set, FIRST, [decided()]));

    await sets.removeForTask(set.taskId);

    expect(await sets.forTask(set.taskId)).toBeNull();
    const [left] = (
      await database.db.execute(
        sql`select count(*)::int as n from decision where set_id = ${set.id.value}`,
      )
    ).rows as { n: number }[];
    expect(left?.n).toBe(0);
  });

  it('removes a set discarded when its pull request closed unmerged', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(drafting(set, FIRST, [decided()]));

    const read = await sets.forTask(set.taskId);
    if (!read) throw new Error('not stored');
    await sets.save(read.closeUnmerged());

    expect(await sets.forTask(set.taskId)).toBeNull();
  });

  it('refuses to discard a set that changed since it was read', async () => {
    const set = opened();
    await sets.add(set);
    await sets.save(set.asked(FIRST, NOW));

    await expect(sets.save(set.closeUnmerged())).rejects.toThrow(
      DecisionSetVersionConflictError,
    );
  });

  it('keeps who disputed a decision, and drops it with the decisions a later run replaces', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(
      drafting(set, FIRST, [decided(), decided({ title: 'Second' })]),
    );

    const read = await sets.forTask(set.taskId);
    const second = read?.decisions[1];
    if (!read || !second) throw new Error('not stored');
    await sets.save(
      read.dispute({
        id: DecisionDisputeId.of('dispute_9'),
        decisionId: second.id,
        path: FilePath.of('api/src/uploads.ts'),
        by: UserId.of('user_maya'),
        reason: 'The client retries twice already.',
        now: NOW,
      }),
    );

    const disputed = await sets.forTask(set.taskId);
    expect(
      disputed?.decisions[1]?.disputes.map((each) => [
        each.by.value,
        each.reason,
      ]),
    ).toEqual([['user_maya', 'The client retries twice already.']]);
    expect(
      (
        await new DrizzleDecisionReader(new DrizzleContext(database.db)).ofTask(
          set.taskId,
        )
      )?.decisions.find((each) => each.id === second.id.value)?.disputes,
    ).toMatchObject([
      {
        path: 'api/src/uploads.ts',
        by: 'user_maya',
        reason: 'The client retries twice already.',
      },
    ]);

    if (!disputed) throw new Error('not stored');
    const asked = disputed.asked(SECOND, NOW);
    await sets.save(asked);
    const again = await sets.forTask(set.taskId);
    if (!again) throw new Error('not stored');
    await sets.save(drafting(again, SECOND, [decided()]));

    expect(
      (await sets.forTask(set.taskId))?.decisions.flatMap(
        (each) => each.disputes,
      ),
    ).toEqual([]);
  });

  it('reads a task’s decisions deviations and limitations first', async () => {
    const set = opened().asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(
      drafting(set, FIRST, [
        decided({ title: 'Simple over fast' }),
        decided({ kind: 'limitation', title: 'Retries only once' }),
        decided({ kind: 'deviation', title: 'Skipped the banner' }),
      ]),
    );

    const found = await new DrizzleDecisionReader(
      new DrizzleContext(database.db),
    ).ofTask(set.taskId);

    expect(found).toMatchObject({ runId: 'run_1', drafting: false });
    expect(found?.decisions.map((each) => each.title)).toEqual([
      'Skipped the banner',
      'Retries only once',
      'Simple over fast',
    ]);
  });
});

describe('reading the decisions that shipped', () => {
  const WORKSPACE = WorkspaceId.of('ws_shipped');
  const reader = () =>
    new DrizzleDecisionReader(new DrizzleContext(database.db));

  const shipped = async (
    repository: string,
    at: string,
    decisions: ProposedDecision[],
    changed: string[],
  ) => {
    next += 1;
    const set = DecisionSet.open({
      id: DecisionSetId.of(`shipped_${next}`),
      taskId: TaskId.of(`shipped_task_${next}`),
      workspaceId: WORKSPACE,
    }).asked(FIRST, NOW);
    await sets.add(set);
    await sets.save(
      drafting(
        set,
        FIRST,
        decisions,
        DecisionGrounds.of({ steps: [3, 7], changed }),
      ).merge(merge(repository, new Date(at))),
    );
    return set;
  };

  beforeAll(async () => {
    await shipped(
      'acme/api',
      '2026-09-10T00:00:00Z',
      [
        decided({
          title: 'Retries only once',
          kind: 'limitation',
          paths: ['api/src/uploads/retry.ts'],
        }),
        decided({
          title: 'Keeps the old client',
          paths: ['api/src/client.ts'],
        }),
      ],
      ['api/src/uploads/retry.ts', 'api/src/client.ts'],
    );
    await shipped(
      'acme/api',
      '2026-09-20T00:00:00Z',
      [
        decided({
          title: 'Uploads skip the cache',
          paths: ['api/src/uploads_cache.ts'],
        }),
      ],
      ['api/src/uploads_cache.ts'],
    );
    await shipped(
      'acme/web',
      '2026-09-15T00:00:00Z',
      [decided({ title: 'Polls every second', paths: ['web/src/poll.ts'] })],
      ['web/src/poll.ts'],
    );
    const proposed = opened().asked(FIRST, NOW);
    await sets.add(proposed);
  });

  const titles = (
    found: Awaited<ReturnType<DrizzleDecisionReader['merged']>>,
  ) => found.map((each) => each.decisions.map((d) => d.title));

  it('lists the merged decisions of a repository, newest merge first', async () => {
    const found = await reader().merged({
      workspaceId: WORKSPACE,
      repository: Repository.of('acme/api'),
      within: [],
      since: null,
      until: null,
      max: 50,
    });

    expect(titles(found)).toEqual([
      ['Uploads skip the cache'],
      ['Retries only once', 'Keeps the old client'],
    ]);
  });

  it('keeps only the decisions bearing on a directory, never a lookalike name', async () => {
    const found = await reader().merged({
      workspaceId: WORKSPACE,
      repository: Repository.of('acme/api'),
      within: ['api/src/uploads'],
      since: null,
      until: null,
      max: 50,
    });

    expect(titles(found)).toEqual([['Retries only once']]);
  });

  it('keeps only what merged within the window', async () => {
    const found = await reader().merged({
      workspaceId: WORKSPACE,
      repository: null,
      within: [],
      since: new Date('2026-09-12T00:00:00Z'),
      until: new Date('2026-09-16T00:00:00Z'),
      max: 50,
    });

    expect(titles(found)).toEqual([['Polls every second']]);
    expect(found[0]?.repository).toBe('acme/web');
  });
});
