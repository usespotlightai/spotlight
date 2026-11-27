import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryProposalSetAlreadyOpenError } from '@memory/domain/exceptions/memory-proposal-set-already-open.error';
import { MemoryProposalSetVersionConflictError } from '@memory/domain/exceptions/memory-proposal-set-version-conflict.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { StationContext } from '@memory/domain/value-objects/run-context';
import { DrizzleMemoryProposalSetRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-proposal-set.repository';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const FIRST = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const STATION_CONTEXT: StationContext = {
  teamId: TEAM,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  repositories: [API],
};

let database: TestDatabase;
let sets: DrizzleMemoryProposalSetRepository;
let memories: DrizzleMemoryRepository;
let next = 0;

const newSet = () => {
  next += 1;
  return MemoryProposalSet.create({
    id: MemoryProposalSetId.of(`set_${next}`),
    taskId: TaskId.of(`task_${next}`),
    workspaceId: WorkspaceId.of('ws_1'),
  });
};

const proposal = (
  set: MemoryProposalSet,
  id: string,
  notes: number[] = [],
  command: number | null = null,
) =>
  MemoryProposal.of({
    id: MemoryId.of(`${set.id.value}_${id}`),
    kind: 'correction',
    body: MemoryBody.of(
      'Never retry an upload the bucket rejected with a 403.',
    ),
    scope: MemoryScope.of({
      teamId: TEAM,
      lineId: STATION_CONTEXT.lineId,
      stationId: STATION_CONTEXT.stationId,
      repository: API,
      paths: [MemoryPath.of('src/uploads.ts')],
    }),
    provenance: MemoryProvenance.of({
      taskId: set.taskId,
      runId: FIRST,
      steps: [5],
      notes,
      command,
    }),
    source: 'run',
    supersedes: null,
    recordedAt: NOW,
  });

const proposing = (
  set: MemoryProposalSet,
  proposals: readonly MemoryProposal[],
): MemoryProposalSet =>
  MemoryProposalSet.rehydrate({
    id: set.id,
    taskId: set.taskId,
    workspaceId: set.workspaceId,
    proposals: [...set.proposals, ...proposals],
    version: set.version,
  });

const stored = async (set: MemoryProposalSet): Promise<MemoryProposalSet> => {
  const read = await sets.forTask(set.taskId);
  if (!read) throw new Error('not stored');
  return read;
};

beforeAll(async () => {
  database = await openDatabase('memory_proposal_sets');
  const context = new DrizzleContext(database.db);
  sets = new DrizzleMemoryProposalSetRepository(context, {
    dispatch: async () => {},
  });
  memories = new DrizzleMemoryRepository(context, {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('storing a task’s memory proposal set', () => {
  it('stores what a run proposed, where it applies and what it cites', async () => {
    const set = newSet();
    await sets.add(set);

    const read = await stored(set);
    await sets.save(read.remember(proposal(read, 'remembered')));

    const [remembered] = (await stored(set)).proposals;
    expect(remembered?.kind).toBe('correction');
    expect(remembered?.source).toBe('run');
    expect(remembered?.scope.teamId.equals(TEAM)).toBe(true);
    expect([
      remembered?.scope.lineId?.value,
      remembered?.scope.stationId?.value,
    ]).toEqual(['line_1', 'station_1']);
    expect(remembered?.scope.repository?.equals(API)).toBe(true);
    expect(remembered?.scope.paths.map((each) => each.value)).toEqual([
      'src/uploads.ts',
    ]);
    expect(remembered?.provenance.steps).toEqual([5]);
    expect(remembered?.provenance.runId.equals(FIRST)).toBe(true);
  });

  it('keeps which command of its step made a proposal, and none where none was named', async () => {
    const set = newSet();
    await sets.add(
      proposing(set, [
        proposal(set, 'second', [], 1),
        proposal(set, 'unnamed', [], null),
      ]),
    );

    expect(
      (await stored(set)).proposals.map((each) => each.provenance.command),
    ).toEqual([1, null]);
  });

  it('keeps which command of its step made an approved memory', async () => {
    const set = newSet();
    const [made] = proposing(set, [proposal(set, 'made', [], 2)]).proposals;
    if (!made) throw new Error('not proposed');
    const approved = Memory.create({
      id: MemoryId.of(`${set.id.value}_memory`),
      handle: MemoryHandle.of(9_000 + next),
      workspaceId: set.workspaceId,
      kind: made.kind,
      body: made.body,
      scope: made.scope,
      provenance: made.provenance,
      source: made.source,
      supersedes: null,
      approval: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
    });

    await memories.add(approved);

    expect((await memories.find(approved.id))?.provenance?.command).toBe(2);
  });

  it('still reads a proposal that cites notes, as drafted ones did', async () => {
    const set = newSet();
    await sets.add(proposing(set, [proposal(set, 'drafted', [4])]));

    const [drafted] = (await stored(set)).proposals;
    expect(drafted?.provenance.notes).toEqual([4]);
  });

  it('refuses a second set for a task that already has one', async () => {
    const set = newSet();
    await sets.add(set);

    await expect(
      sets.add(
        MemoryProposalSet.create({
          id: MemoryProposalSetId.of(`${set.id.value}_again`),
          taskId: set.taskId,
          workspaceId: set.workspaceId,
        }),
      ),
    ).rejects.toBeInstanceOf(MemoryProposalSetAlreadyOpenError);
  });

  it('does not write over a set that changed since it was read', async () => {
    const set = newSet();
    await sets.add(set);
    const read = await stored(set);
    await sets.save(read.remember(proposal(read, 'first')));

    await expect(
      sets.save(read.remember(proposal(read, 'second'))),
    ).rejects.toBeInstanceOf(MemoryProposalSetVersionConflictError);
  });

  it('deletes the set of a deleted task, and its proposals with it', async () => {
    const set = newSet();
    await sets.add(proposing(set, [proposal(set, 'remembered')]));

    await sets.save((await stored(set)).delete());

    expect(await sets.forTask(set.taskId)).toBeNull();
    const [{ n }] = (
      await database.db.execute(
        sql`select count(*)::int as n from memory_proposal where set_id = ${set.id.value}`,
      )
    ).rows as { n: number }[];
    expect(n).toBe(0);
  });
});

describe('reading what the team already knows', () => {
  const approvedMemory = async (
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
        task_id, run_id, steps, notes, source, status, approved_by_id, approved_at, retired_at, retired_by_id)
      values (${id}, nextval('memory_handle_seq'), 'ws_1', 'preference', ${`Memory ${id}`}, ${scope.team ?? 'team_1'},
        ${scope.line ?? null}, ${scope.station ?? null}, ${scope.repository ?? null}, '[]'::jsonb,
        'task_1', 'run_1', '[]'::jsonb, '[2]'::jsonb, 'person',
        ${scope.status ?? 'active'}, 'user_ada', ${NOW.toISOString()},
        ${scope.status === 'retired' ? NOW.toISOString() : null}, ${scope.status === 'retired' ? 'user_ada' : null})
    `);

  it('reads the active memories that apply to this station, and none that do not', async () => {
    await approvedMemory('team_wide', {});
    await approvedMemory('this_line', { line: 'line_1' });
    await approvedMemory('this_station', {
      line: 'line_1',
      station: 'station_1',
    });
    await approvedMemory('this_repository', { repository: 'acme/api' });
    await approvedMemory('other_team', { team: 'team_2' });
    await approvedMemory('other_line', { line: 'line_2' });
    await approvedMemory('other_station', {
      line: 'line_1',
      station: 'station_2',
    });
    await approvedMemory('other_repository', { repository: 'acme/web' });
    await approvedMemory('retired', { status: 'retired' });

    const active = (await memories.mayApplyAt(STATION_CONTEXT)).filter((each) =>
      each.appliesAt(STATION_CONTEXT, null),
    );

    expect(active.map((each) => each.id.value).sort()).toEqual([
      'team_wide',
      'this_line',
      'this_repository',
      'this_station',
    ]);
  });
});
