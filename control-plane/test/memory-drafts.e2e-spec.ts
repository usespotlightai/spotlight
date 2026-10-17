import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryDraftVersionConflictError } from '@memory/domain/exceptions/memory-draft-version-conflict.error';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { rejectionsHeededAt } from '@memory/domain/services/rejections-heeded';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import type { StationSite } from '@memory/domain/value-objects/run-site';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import { DrizzleRejectedMemories } from '@memory/infrastructure/persistence/drizzle/repositories/rejected-memories.reader';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const FIRST = RunId.of('run_1');
const SECOND = RunId.of('run_2');
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const SITE: StationSite = {
  teamId: TEAM,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [API],
};

const remembered = (change: Partial<ProposedMemory> = {}): ProposedMemory => ({
  kind: 'correction',
  body: 'Never retry an upload the bucket rejected with a 403.',
  reach: 'station',
  repository: 'acme/api',
  paths: ['src/uploads.ts'],
  steps: [5],
  notes: [4],
  supersedes: null,
  ...change,
});

let database: TestDatabase;
let drafts: DrizzleMemoryDraftRepository;
let memories: DrizzleMemoryRepository;
let rejections: DrizzleRejectedMemories;
let next = 0;

const opened = () => {
  next += 1;
  return MemoryDraft.open({
    id: MemoryDraftId.of(`draft_${next}`),
    taskId: TaskId.of(`task_${next}`),
    workspaceId: WorkspaceId.of('ws_1'),
  });
};

const drafting = (
  draft: MemoryDraft,
  runId: RunId,
  proposed: readonly ProposedMemory[],
) => {
  let made = 0;
  return draft.recordDraft({
    runId,
    proposed,
    evidence: DraftEvidence.of({
      taskId: draft.taskId,
      runId,
      site: SITE,
      steps: [{ index: 5, kind: 'message', text: 'Retrying in the request.' }],
      notes: [{ position: 4, by: 'person', text: 'Never retry on a 403.' }],
      notesRead: 0,
      changed: [{ repository: API, path: 'src/uploads.ts' }],
      known: [],
      fromOutside: false,
    }),
    newId: () => {
      made += 1;
      return `${draft.id.value}_${runId.value}_${made}`;
    },
    now: NOW,
  });
};

const stored = async (draft: MemoryDraft): Promise<MemoryDraft> => {
  const read = await drafts.forTask(draft.taskId);
  if (!read) throw new Error('not stored');
  return read;
};

beforeAll(async () => {
  database = await openDatabase('memory_drafts');
  const context = new DrizzleContext(database.db);
  drafts = new DrizzleMemoryDraftRepository(context, {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher);
  memories = new DrizzleMemoryRepository(context, {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher);
  rejections = new DrizzleRejectedMemories(context);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('storing a task’s memory draft', () => {
  it('keeps what a run proposed, where it applies and what it rests on', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);

    await drafts.save(drafting(await stored(draft), FIRST, [remembered()]));

    const read = await stored(draft);
    const [proposal] = read.proposals;
    expect(read.hasPendingJob).toBe(false);
    expect(read.draftedIn?.equals(FIRST)).toBe(true);
    expect(read.notesRead).toBe(5);
    expect(proposal?.kind).toBe('correction');
    expect(proposal?.source).toBe('run');
    expect(proposal?.scope.teamId.equals(TEAM)).toBe(true);
    expect([proposal?.scope.lineId, proposal?.scope.stationId]).toEqual([
      'line_1',
      'station_1',
    ]);
    expect(proposal?.scope.repository?.equals(API)).toBe(true);
    expect(proposal?.scope.paths.map((each) => each.value)).toEqual([
      'src/uploads.ts',
    ]);
    expect(proposal?.grounds.steps).toEqual([5]);
    expect(proposal?.grounds.notes).toEqual([4]);
    expect(proposal?.grounds.runId.equals(FIRST)).toBe(true);
  });

  it('replaces what an earlier run proposed with what the latest proposed', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);
    await drafts.save(
      drafting(await stored(draft), FIRST, [
        remembered(),
        remembered({ kind: 'environment', body: 'CI has no network.' }),
      ]),
    );

    await drafts.save((await stored(draft)).asked(SECOND, LATER));
    await drafts.save(
      drafting(await stored(draft), SECOND, [
        remembered({ kind: 'failure', body: 'The upload test flakes.' }),
      ]),
    );

    expect(
      (await stored(draft)).proposals.map((each) => each.body.value),
    ).toEqual(['The upload test flakes.']);
    const [{ n }] = (
      await database.db.execute(
        sql`select count(*)::int as n from memory_proposal where draft_id = ${draft.id.value}`,
      )
    ).rows as { n: number }[];
    expect(n).toBe(1);
  });

  it('keeps a failure that allows no other attempt, and the draft it ended', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);
    const leased = (await stored(draft)).leaseJob(NOW);
    await drafts.save(leased);

    await drafts.save(
      (await stored(draft)).failed(
        MemoryDraftingFailure.of('no-evidence', LATER),
      ),
    );

    const read = await stored(draft);
    expect(read.hasPendingJob).toBe(false);
    expect(read.failure?.code).toBe('no-evidence');
    expect(read.failure?.at).toEqual(LATER);
  });

  it('does not write over a draft that changed since it was read', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);
    const read = await stored(draft);
    await drafts.save(read.leaseJob(NOW));

    await expect(drafts.save(read.leaseJob(NOW))).rejects.toBeInstanceOf(
      MemoryDraftVersionConflictError,
    );
  });

  it('hands out the oldest draft that is due, and none that is waiting', async () => {
    await database.db.execute(sql`delete from memory_draft`);
    const waiting = opened().asked(FIRST, NOW);
    const due = opened().asked(SECOND, LATER);
    await drafts.add(waiting);
    await drafts.add(due);
    await drafts.save(
      (await stored(waiting))
        .leaseJob(NOW)
        .failed(MemoryDraftingFailure.of('request-failed', NOW)),
    );

    const handed = await database.db.transaction(async (tx) =>
      new DrizzleMemoryDraftRepository(new DrizzleContext(tx), {
        dispatch: async () => {},
      } as unknown as DomainEventDispatcher).nextDueJob(NOW),
    );

    expect(handed?.id.equals(due.id)).toBe(true);
  });

  it('forgets the draft of a deleted task, and its proposals with it', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);
    await drafts.save(drafting(await stored(draft), FIRST, [remembered()]));

    await drafts.removeForTask(draft.taskId);

    expect(await drafts.forTask(draft.taskId)).toBeNull();
    const [{ n }] = (
      await database.db.execute(
        sql`select count(*)::int as n from memory_proposal where draft_id = ${draft.id.value}`,
      )
    ).rows as { n: number }[];
    expect(n).toBe(0);
  });
});

describe('reading what the team already knows', () => {
  const keeping = async (
    id: string,
    scope: {
      team?: string;
      line?: string | null;
      station?: string | null;
      repository?: string | null;
      status?: 'active' | 'retired';
    },
  ) =>
    database.db.execute(sql`
      insert into memory (id, handle, workspace_id, kind, body, team_id, line_id, station_id, repository, paths,
        task_id, run_id, steps, notes, source, status, approved_by, approved_at)
      values (${id}, nextval('memory_handle_seq'), 'ws_1', 'preference', ${`Memory ${id}`}, ${scope.team ?? 'team_1'},
        ${scope.line ?? null}, ${scope.station ?? null}, ${scope.repository ?? null}, '[]'::jsonb,
        'task_1', 'run_1', '[]'::jsonb, '[2]'::jsonb, 'person',
        ${scope.status ?? 'active'}, 'user_ada', ${NOW.toISOString()})
    `);

  it('reads the active memories that reach this station, and none that do not', async () => {
    await keeping('team_wide', {});
    await keeping('this_line', { line: 'line_1' });
    await keeping('this_station', { line: 'line_1', station: 'station_1' });
    await keeping('this_repository', { repository: 'acme/api' });
    await keeping('other_team', { team: 'team_2' });
    await keeping('other_line', { line: 'line_2' });
    await keeping('other_station', { line: 'line_1', station: 'station_2' });
    await keeping('other_repository', { repository: 'acme/web' });
    await keeping('retired', { status: 'retired' });

    const active = (await memories.mayReach(SITE)).filter((each) =>
      each.appliesAt(SITE),
    );

    expect(active.map((each) => each.id.value).sort()).toEqual([
      'team_wide',
      'this_line',
      'this_repository',
      'this_station',
    ]);
  });

  it('reads the proposals people turned down lately, in reach', async () => {
    const draft = opened().asked(FIRST, NOW);
    await drafts.add(draft);
    await drafts.save(
      drafting(await stored(draft), FIRST, [
        remembered({ body: 'Turned down lately' }),
        remembered({ body: 'Turned down long ago' }),
        remembered({ body: 'Still waiting' }),
      ]),
    );
    const [lately, longAgo] = (await stored(draft)).proposals;
    await database.db.execute(
      sql`update memory_proposal set state = 'rejected', decided_by = 'user_ada', decided_at = ${LATER.toISOString()} where id = ${lately?.id.value ?? ''}`,
    );
    await database.db.execute(
      sql`update memory_proposal set state = 'rejected', decided_by = 'user_ada', decided_at = '2026-01-01T00:00:00Z' where id = ${longAgo?.id.value ?? ''}`,
    );

    const rejected = rejectionsHeededAt(
      await rejections.rejectedOnTeam(TEAM, NOW),
      SITE,
    );

    expect(rejected.map((each) => each.body)).toEqual(['Turned down lately']);
  });
});
