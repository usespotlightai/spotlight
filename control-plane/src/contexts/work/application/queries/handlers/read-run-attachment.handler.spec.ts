import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { ReadRunAttachmentHandler } from '@work/application/queries/handlers/read-run-attachment.handler';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import type { RunWork } from '@work/application/services/run-work';
import type { RunWorks } from '@work/application/services/run-works.service';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { describe, expect, it } from 'vitest';

const SCREEN = Attachment.rehydrate({
  id: 'att_1',
  name: 'screen.png',
  contentType: 'image/png',
  size: 10,
});

const CONTENT = { bytes: new Uint8Array([1]), contentType: 'image/png' };

const reading = (leases: Record<string, string>) => {
  const opened: string[] = [];
  const works = {
    workLeasedBy: async (runId: string, runnerId: string) =>
      leases[runId] === runnerId
        ? ({
            workspaceId: WorkspaceId.of('ws_1'),
            gave: (id: string) => (id === 'att_1' ? SCREEN : null),
          } as unknown as RunWork)
        : null,
  } as unknown as RunWorks;
  const files = {
    open: async (workspaceId: WorkspaceId, file: Attachment) => {
      opened.push(`${workspaceId.value}/${file.id.value}`);
      return CONTENT;
    },
  } as AttachmentStorePort;

  return { handler: new ReadRunAttachmentHandler(works, files), opened };
};

const asked = (attachmentId = 'att_1') =>
  new ReadRunAttachmentQuery('run_1', 'runner_1', attachmentId);

describe('ReadRunAttachmentHandler', () => {
  it('opens a file the work of the run the runner leases was given', async () => {
    const { handler, opened } = reading({ run_1: 'runner_1' });

    await expect(handler.execute(asked())).resolves.toBe(CONTENT);
    expect(opened).toEqual(['ws_1/att_1']);
  });

  it('opens nothing its work was not given', async () => {
    const { handler, opened } = reading({ run_1: 'runner_1' });

    await expect(handler.execute(asked('att_2'))).resolves.toBeNull();
    expect(opened).toEqual([]);
  });

  it('opens nothing for a runner that no longer leases the run', async () => {
    const { handler, opened } = reading({});

    await expect(handler.execute(asked())).resolves.toBeNull();
    expect(opened).toEqual([]);
  });
});
