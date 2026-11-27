import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RememberCommand } from '@memory/application/commands/remember.command';
import type {
  LeasedRun,
  ReasonedStep,
  WorkPort,
} from '@memory/application/ports/work.port';
import { ReadProposedMemoryHandler } from '@memory/application/queries/handlers/read-proposed-memory.handler';
import { ReadProposedMemoryQuery } from '@memory/application/queries/read-proposed-memory.query';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { RunProposing } from '@memory/application/services/run-proposing.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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

const ONE_COMMAND: readonly ReasonedStep[] = [
  {
    index: 4,
    kind: 'remember',
    text: 'spotlight remember',
    commands: [
      { proposes: 'memory', carrying: null, text: 'spotlight remember' },
    ],
  },
];

const remembering = (run: LeasedRun | null = LEASED, steps = ONE_COMMAND) => {
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
    reasoning: async () => steps,
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
      { findAll: async () => [] } as unknown as MemoryRepository,
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
  it('shows as its source the command of its step that carried it, where the step remembered several things', async () => {
    const first =
      'spotlight remember --kind environment --body "npm ci fails in the sandbox; use npm ci --ignore-scripts."';
    const second =
      'spotlight remember --kind rationale --body "Uploads retry in the request."';
    const { added, remember, proposedAs } = remembering(LEASED, [
      {
        index: 4,
        kind: 'remember',
        text: first,
        commands: [
          {
            proposes: 'memory',
            carrying:
              'npm ci fails in the sandbox; use npm ci --ignore-scripts.',
            text: first,
          },
          {
            proposes: 'memory',
            carrying: 'Uploads retry in the request.',
            text: second,
          },
        ],
      },
    ]);

    const proposed = await proposedAs(await remember());

    expect(added[0]?.proposals[0]?.provenance.command).toBe(1);
    expect(proposed.steps).toEqual([
      { index: 4, kind: 'remember', text: second },
    ]);
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
