import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { ReadRunMemoriesHandler } from '@memory/application/queries/handlers/read-run-memories.handler';
import { ReadRunMemoriesQuery } from '@memory/application/queries/read-run-memories.query';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const WORKSPACE = WorkspaceId.of('ws_1');

let made = 0;
const kept = (body: string, teamId = TEAM) => {
  made += 1;
  return Memory.written({
    id: MemoryId.of(`memory_${made}`),
    handle: MemoryHandle.of(made),
    workspaceId: WORKSPACE,
    kind: 'preference',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId }),
    grounds: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });
};

const reading = (input: {
  teamOfRun: TeamId | null;
  held: readonly Memory[];
  briefed: readonly Memory[];
  cut: readonly Memory[];
  recalled: readonly Memory[];
}) => {
  const work = {
    run: async () => ({
      id: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      taskId: null,
      completed: true,
      memories: false,
      briefed: input.briefed.map((each) => each.id.value),
      cut: input.cut.map((each) => each.id.value),
    }),
    siteOfRun: async () =>
      input.teamOfRun && {
        teamId: input.teamOfRun,
        lineId: null,
        stationId: null,
        repositories: [],
      },
  } as unknown as WorkPort;
  const people = {
    memberOf: async () => ({
      workspaceId: WORKSPACE,
      by: UserId.of('user_1'),
    }),
    nameOf: async () => 'Ada',
  } as unknown as PeoplePort;
  const memories = {
    findAll: async (ids: readonly MemoryId[]) =>
      ids.flatMap((id) => input.held.filter((each) => each.id.equals(id))),
  } as unknown as MemoryRepository;
  const uses = {
    ofRun: async () =>
      input.recalled.map((each) => ({
        memoryId: each.id,
        way: 'recalled' as const,
      })),
    runsUsing: async () => new Map(),
  } as unknown as MemoryUsesPort;

  return new ReadRunMemoriesHandler(
    new MemoryAccess(people, work),
    work,
    memories,
    {} as MemoryDraftRepository,
    uses,
    new MemoryReviews(work, people),
    new TeamMemoryViews(memories, work, people, uses),
  ).execute(new ReadRunMemoriesQuery('team_1', 'run_1', 'user_1'));
};

describe('ReadRunMemoriesHandler', () => {
  it('keeps what was briefed, cut and recalled apart, and shows nothing of another team', async () => {
    const briefed = kept('Briefed.');
    const cut = kept('Cut.');
    const recalled = kept('Recalled.');
    const theirs = kept('Theirs.', TeamId.of('team_other'));

    const read = await reading({
      teamOfRun: TEAM,
      held: [briefed, cut, recalled, theirs],
      briefed: [briefed, theirs],
      cut: [cut],
      recalled: [recalled, recalled],
    });

    expect(read.briefed.map((each) => each.body)).toEqual(['Briefed.']);
    expect(read.cut.map((each) => each.body)).toEqual(['Cut.']);
    expect(read.recalled.map((each) => each.body)).toEqual(['Recalled.']);
    expect(read.proposed).toEqual([]);
  });

  it('knows no run of another team', async () => {
    await expect(
      reading({
        teamOfRun: TeamId.of('team_other'),
        held: [],
        briefed: [],
        cut: [],
        recalled: [],
      }),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
