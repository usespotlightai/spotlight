import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { PendingMessagesHandler } from '@work/application/queries/handlers/pending-messages.handler';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');

const working = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task_1:station_1' },
    }),
  }).claim(RUNNER, NOW);

const reading = (run: Run = working()) =>
  new PendingMessagesHandler(
    { findById: async () => run } as unknown as RunRepository,
    {
      pendingFor: async (runId, runnerId) =>
        runId.value === 'run_1' && runnerId.value === 'runner_1'
          ? [
              {
                position: 2,
                body: 'Use the staging queue.',
                attachments: [
                  Attachment.rehydrate({
                    id: 'att_1',
                    name: 'queue.png',
                    contentType: 'image/png',
                    size: 10,
                  }),
                ],
              },
            ]
          : null,
      stopRequestedFor: async () => false,
    },
  );

describe('PendingMessagesHandler', () => {
  it('hands the runner that leases the run the messages sent to it, with where its files lie', async () => {
    const pending = await reading().execute(
      new PendingMessagesQuery('run_1', 'runner_1'),
    );

    expect(pending).toEqual([
      {
        position: 2,
        body: expect.stringContaining('Use the staging queue.'),
        attachments: [
          { id: 'att_1', path: '.spotlight/attachments/att_1/queue.png' },
        ],
      },
    ]);
  });

  it('hands a run waiting for a person nothing until the person has answered and it works again', async () => {
    const waiting = working().paused(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.none(),
      NOW,
    );

    await expect(
      reading(waiting).execute(new PendingMessagesQuery('run_1', 'runner_1')),
    ).resolves.toEqual([]);
    await expect(
      reading(waiting.resumed()).execute(
        new PendingMessagesQuery('run_1', 'runner_1'),
      ),
    ).resolves.toHaveLength(1);
  });

  it('rejects a runner that does not lease the run', async () => {
    await expect(
      reading().execute(new PendingMessagesQuery('run_1', 'runner_2')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
