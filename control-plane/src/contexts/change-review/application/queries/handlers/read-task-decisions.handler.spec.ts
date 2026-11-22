import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import { ReadTaskDecisionsHandler } from '@change-review/application/queries/handlers/read-task-decisions.handler';
import { ReadTaskDecisionsQuery } from '@change-review/application/queries/read-task-decisions.query';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');

const STORED: TaskDecisionsDto = {
  status: 'proposed',
  merges: [],
  decisions: [
    {
      id: 'decision_1',
      kind: 'limitation',
      title: 'Retries only once',
      why: 'Because.',
      alternatives: [],
      paths: ['api/src/uploads.ts'],
      runId: 'run_1',
      journalSteps: [3],
      disputes: [
        {
          id: 'dispute_1',
          path: 'api/src/uploads.ts',
          by: 'user_2',
          byName: null,
          reason: 'The client retries twice already.',
          at: NOW,
        },
      ],
    },
  ],
};

const reading = (
  over: { stored?: TaskDecisionsDto | null; allowed?: boolean } = {},
) =>
  new ReadTaskDecisionsHandler(
    {
      task: async () =>
        over.allowed === false
          ? null
          : {
              task: {
                id: TaskId.of('task_1'),
                workspaceId: WorkspaceId.of('ws_1'),
                teamId: null,
                pullRequest: null,
                reviewing: false,
                currentRunId: null,
              },
              by: UserId.of('user_1'),
            },
    } as unknown as TeamWorkAccess,
    {
      ofTask: async () => (over.stored === undefined ? STORED : over.stored),
    } as unknown as DecisionReaderPort,
    {
      find: async () => ({ name: 'Maya Chen', image: null }),
      viewerOf: async () => null,
      actsOnTeam: async () => false,
    },
  ).execute(new ReadTaskDecisionsQuery('team_1', 'task_1', 'user_1'));

describe('reading a task’s decisions', () => {
  it('reads each with the run that recorded it', async () => {
    const found = await reading();

    expect(
      found?.decisions.map((each) => [each.id, each.runId, each.journalSteps]),
    ).toEqual([['decision_1', 'run_1', [3]]]);
  });

  it('reads none where no run recorded decisions', async () => {
    expect(await reading({ stored: null })).toMatchObject({
      decisions: [],
    });
  });

  it('shows nothing to someone outside the task’s team', async () => {
    expect(await reading({ allowed: false })).toBeNull();
  });

  it('names who disputed a decision', async () => {
    const found = await reading();

    expect(found?.decisions[0]?.disputes[0]?.byName).toBe('Maya Chen');
  });
});
