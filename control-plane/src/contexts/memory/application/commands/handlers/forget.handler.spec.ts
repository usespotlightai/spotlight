import { ForgetCommand } from '@memory/application/commands/forget.command';
import { ForgetHandler } from '@memory/application/commands/handlers/forget.handler';
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
import { describe, expect, it, vi } from 'vitest';

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

const M12 = Memory.write({
  id: MemoryId.of('memory_12'),
  handle: MemoryHandle.of(12),
  workspaceId: WORKSPACE,
  kind: 'environment',
  body: MemoryBody.of('Restart the worker after each deploy.'),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
});

const forgetting = (
  run: LeasedRun | null = LEASED,
  known: Memory | null = M12,
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

  const handler = new ForgetHandler(
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
    {
      withHandle: async (_team: TeamId, handle: MemoryHandle) =>
        known?.handle.equals(handle) ? known : null,
    } as unknown as MemoryRepository,
  );

  const teamMemories = vi.fn(async () => (known ? [known] : []));
  const reading = new ReadProposedMemoryHandler(
    new RunnerMemoryLoader(work),
    {
      forTask: async () => added[added.length - 1] ?? null,
    } as unknown as MemoryProposalSetRepository,
    new MemoryReviews(
      work,
      { find: async () => null } as never,
      {
        findAll: async () => (known ? [known] : []),
        ofTeam: teamMemories,
      } as unknown as MemoryRepository,
    ),
  );

  return {
    added,
    teamMemories,
    proposedAs: (memoryId: string) =>
      reading.execute(
        new ReadProposedMemoryQuery('run_1', 'runner_1', memoryId),
      ),
    forget: (handle = 'M-12') =>
      handler.execute(
        new ForgetCommand(
          'run_1',
          'runner_1',
          handle,
          'The worker reloads its limits on deploy.',
        ),
      ),
  };
};

describe('ForgetHandler', () => {
  it('proposes to retire an active memory of the team, with why', async () => {
    const { forget, proposedAs } = forgetting();

    const proposed = await proposedAs(await forget());

    expect(proposed).toMatchObject({
      state: 'proposed',
      editable: false,
      inactiveMemories: [],
      retires: {
        memoryId: 'memory_12',
        handle: 'M-12',
        reason: 'The worker reloads its limits on deploy.',
      },
    });
  });

  it('compares no memory with a proposal to retire one', async () => {
    const { forget, proposedAs, teamMemories } = forgetting();

    const proposed = await proposedAs(await forget());

    expect(proposed.similarTo).toBeNull();
    expect(teamMemories).not.toHaveBeenCalled();
  });

  it('knows no memory of another handle', async () => {
    const { forget } = forgetting();

    await expect(forget('M-99')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('refuses a memory that is already retired', async () => {
    const { forget } = forgetting(
      LEASED,
      M12.retire({ by: UserId.of('user_ada'), reason: 'Gone.', at: NOW }),
    );

    await expect(forget()).rejects.toMatchObject({
      kind: 'invalid',
      message: expect.stringContaining('M-12 is not one') as unknown,
    });
  });

  it('rejects a run of a chat, an isolated run and a run set at a past time', async () => {
    await expect(
      forgetting({ ...LEASED, taskId: null }).forget(),
    ).rejects.toMatchObject({ kind: 'invalid' });
    await expect(
      forgetting({ ...LEASED, isolated: true }).forget(),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      forgetting({ ...LEASED, asOf: NOW }).forget(),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('knows no run this runner does not lease', async () => {
    await expect(forgetting(null).forget()).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
