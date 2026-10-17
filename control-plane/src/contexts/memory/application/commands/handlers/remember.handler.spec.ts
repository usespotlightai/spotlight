import { RememberHandler } from '@memory/application/commands/handlers/remember.handler';
import { RememberCommand } from '@memory/application/commands/remember.command';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [],
  replaysFrom: null,
  isSearch: false,
};

const remembering = (run: LeasedRun | null = LEASED) => {
  const added: MemoryDraft[] = [];
  let ids = 0;
  const work = {
    leasedBy: async () => run,
    task: async () => ({
      id: TASK,
      workspaceId: WORKSPACE,
      teamId: TEAM,
      fromOutside: false,
    }),
    stationSiteOf: async () => ({
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
    spokenOn: async () => [],
    harnessOf: async () => 'claude-code',
  } as unknown as WorkPort;

  const handler = new RememberHandler(
    new RunnerMemoryLoader(
      work,
      new RecordMemoryUses(
        { record: async () => {} } as unknown as MemoryUsesPort,
        { dispatch: async () => {} },
        { inTransaction: (work) => work() },
        { now: () => NOW, sleep: async () => {} },
      ),
    ),
    work,
    {
      forTask: async () => null,
      add: async (draft: MemoryDraft) => {
        added.push(draft);
      },
    } as unknown as MemoryDraftRepository,
    {} as MemoryRepository,
    new MemoryReviews(work, { find: async () => null } as never),
    { inTransaction: <T>(each: () => Promise<T>) => each() },
    {
      generate: () => {
        ids += 1;
        return `id_${ids}`;
      },
    },
    { now: () => NOW, sleep: async () => undefined },
  );

  return {
    added,
    remember: (body = 'Uploads retry in the request.') =>
      handler.execute(
        new RememberCommand('run_1', 'runner_1', {
          kind: 'rationale',
          body,
          reach: null,
          paths: [],
          supersedes: null,
        }),
      ),
  };
};

describe('RememberHandler', () => {
  it('opens the task’s draft with what the run asked to keep, grounded in its step', async () => {
    const { added, remember } = remembering();

    const proposed = await remember();

    expect(proposed).toMatchObject({
      origin: 'remembered',
      state: 'proposed',
      steps: [{ index: 4, kind: 'remember' }],
    });
    expect(added).toHaveLength(1);
    expect(added[0]?.proposals.map((each) => each.id.value)).toEqual([
      proposed.id,
    ]);
  });

  it('refuses a run of a chat, which has no task to ground a memory in', async () => {
    const { remember } = remembering({ ...LEASED, taskId: null });

    await expect(remember()).rejects.toMatchObject({
      kind: 'invalid',
      message: expect.stringContaining("a task's run"),
    });
  });

  it('knows no run this runner does not lease', async () => {
    const { remember } = remembering(null);

    await expect(remember()).rejects.toBeInstanceOf(ApplicationError);
    await expect(remember()).rejects.toMatchObject({ kind: 'not-found' });
  });
});
