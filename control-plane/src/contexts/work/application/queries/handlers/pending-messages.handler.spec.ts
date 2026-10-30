import { PendingMessagesHandler } from '@work/application/queries/handlers/pending-messages.handler';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { describe, expect, it } from 'vitest';

const reading = () =>
  new PendingMessagesHandler({
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
  });

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

  it('rejects a runner that does not lease the run', async () => {
    await expect(
      reading().execute(new PendingMessagesQuery('run_1', 'runner_2')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
