import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import { ReadRunAttachmentHandler } from '@work/application/queries/handlers/read-run-attachment.handler';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { describe, expect, it } from 'vitest';

const SCREEN = Attachment.rehydrate({
  id: 'att_1',
  name: 'screen.png',
  contentType: 'image/png',
  size: 10,
});

const CONTENT = { bytes: new Uint8Array([1]), contentType: 'image/png' };

const reading = (holding: Record<string, string>) => {
  const opened: string[] = [];
  const held: HeldRunReaderPort = {
    pendingFor: async () => [],
    stopRequestedFor: async () => false,
    attachmentFor: async (runId, runnerId, attachmentId) =>
      holding[runId.value] === runnerId.value && attachmentId === 'att_1'
        ? { workspaceId: WorkspaceId.of('ws_1'), attachment: SCREEN }
        : null,
  };
  const files = {
    open: async (workspaceId: WorkspaceId, file: Attachment) => {
      opened.push(`${workspaceId.value}/${file.id.value}`);
      return CONTENT;
    },
  } as AttachmentStorePort;

  return { handler: new ReadRunAttachmentHandler(held, files), opened };
};

describe('ReadRunAttachmentHandler', () => {
  it('opens a file given to the run the runner holds', async () => {
    const { handler, opened } = reading({ run_1: 'runner_1' });

    await expect(
      handler.execute(new ReadRunAttachmentQuery('run_1', 'runner_1', 'att_1')),
    ).resolves.toBe(CONTENT);
    expect(opened).toEqual(['ws_1/att_1']);
  });

  it('opens nothing for a runner that no longer holds the run', async () => {
    const { handler, opened } = reading({});

    await expect(
      handler.execute(new ReadRunAttachmentQuery('run_1', 'runner_1', 'att_1')),
    ).resolves.toBeNull();
    expect(opened).toEqual([]);
  });
});
