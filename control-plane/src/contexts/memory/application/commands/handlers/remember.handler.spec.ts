import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RememberCommand } from '@memory/application/commands/remember.command';
import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { ReadProposedMemoryHandler } from '@memory/application/queries/handlers/read-proposed-memory.handler';
import { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { RunProposing } from '@memory/application/services/run-proposing.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');
const TEAM = TeamId.of('team_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const LEASED: LeasedRun = {
  id: RUN,
  workspaceId: WORKSPACE,
  teamId: TEAM,
  taskId: TASK,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  repositories: [],
  asOf: null,
  isolated: false,
  trial: false,
};

const M2 = Memory.write({
  id: MemoryId.of('memory_2'),
  handle: MemoryHandle.of(2),
  workspaceId: WORKSPACE,
  kind: 'environment',
  body: MemoryBody.of(
    'The sandbox has no make, so npm ci fails compiling better-sqlite3.',
  ),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
});

const remembering = (
  run: LeasedRun | null = LEASED,
  team: readonly Memory[] = [],
) => {
  const added: MemoryProposalSet[] = [];
  let ids = 0;
  const work = {
    leasedBy: async () => run,
    task: async () => ({
      id: TASK,
      workspaceId: WORKSPACE,
      teamId: TEAM,
      fromOutside: false,
    }),
    stationContextOf: async () => ({
      teamId: TEAM,
      lineId: 'line_1',
      lineName: 'Delivery',
      stationId: 'station_1',
      stationName: 'Build',
      repositories: [Repository.of('acme/api')],
    }),
    reasoning: async () => [
      { index: 4, kind: 'remember', text: 'spotlight remember' },
    ],
    notesOf: async () => [],
    harnessOf: async () => 'claude-code',
  } as unknown as WorkPort;

  const handler = new RememberHandler(
    new RunProposing(
      new RunnerMemoryLoader(work),
      work,
      {
        forTask: async () => null,
        add: async (set: MemoryProposalSet) => {
          added.push(set);
        },
      } as unknown as MemoryProposalSetRepository,
      { inTransaction: <T>(each: () => Promise<T>) => each() },
      {
        generate: () => {
          ids += 1;
          return `id_${ids}`;
        },
      },
      { now: () => NOW, sleep: async () => undefined },
    ),
    {} as MemoryRepository,
  );

  const reading = new ReadProposedMemoryHandler(
    new RunnerMemoryLoader(work),
    {
      forTask: async () => added[added.length - 1] ?? null,
    } as unknown as MemoryProposalSetRepository,
    new MemoryReviews(
      work,
      { find: async () => null } as never,
      {
        findAll: async () => [],
        ofTeam: async () => team,
      } as unknown as MemoryRepository,
    ),
  );

  return {
    added,
    proposedAs: (memoryId: string) =>
      reading.execute(
        new ReadProposedMemoryQuery('run_1', 'runner_1', memoryId),
      ),
    remember: (body = 'Uploads retry in the request.') =>
      handler.execute(
        new RememberCommand('run_1', 'runner_1', {
          kind: 'rationale',
          body,
          scope: null,
          paths: [],
          supersedes: null,
        }),
      ),
  };
};

describe('RememberHandler', () => {
  it('names the active memory that the proposal nearly repeats', async () => {
    const { remember, proposedAs } = remembering(LEASED, [M2]);

    const proposed = await proposedAs(
      await remember(
        "In the sandbox, 'npm ci' fails compiling better-sqlite3 because make is missing.",
      ),
    );

    expect(proposed.similarTo).toEqual({
      memoryId: 'memory_2',
      handle: 'M-2',
      body: M2.body.value,
    });
  });

  it('opens the task’s set with what the run proposed to remember, which cites its step', async () => {
    const { added, remember, proposedAs } = remembering();

    const proposed = await proposedAs(await remember());

    expect(proposed).toMatchObject({
      state: 'proposed',
      steps: [{ index: 4, kind: 'remember' }],
    });
    expect(added).toHaveLength(1);
    expect(added[0]?.proposals.map((each) => each.id.value)).toEqual([
      proposed.id,
    ]);
  });

  it('rejects a run of a chat, which has no task for a memory to cite', async () => {
    const { remember } = remembering({ ...LEASED, taskId: null });

    await expect(remember()).rejects.toMatchObject({
      kind: 'invalid',
      message: expect.stringContaining("a task's run") as unknown,
    });
  });

  it('knows no run this runner does not lease', async () => {
    const { remember } = remembering(null);

    await expect(remember()).rejects.toBeInstanceOf(ApplicationError);
    await expect(remember()).rejects.toMatchObject({ kind: 'not-found' });
  });
});
