import type {
  AttachmentHolder,
  AttachmentReaderPort,
} from '@work/application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { ReadAttachmentHandler } from '@work/application/queries/handlers/read-attachment.handler';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { describe, expect, it, vi } from 'vitest';

const reading = (holder: AttachmentHolder) =>
  new ReadAttachmentHandler(
    workAccessSeeing(() => true),
    {
      find: vi.fn(async () => ({
        id: 'attachment_1',
        name: 'screenshot.png',
        contentType: 'image/png',
        size: 1_024,
        workspaceId: 'ws_1',
        holder,
      })),
    } satisfies AttachmentReaderPort,
    {
      link: vi.fn(async () => 'https://files.example/attachment_1'),
    } as unknown as AttachmentStorePort,
  );

const read = (holder: AttachmentHolder, viewer: string) =>
  reading(holder).execute(
    new ReadAttachmentQuery('acme', viewer, 'attachment_1', false),
  );

const readingUnclaimed = (
  access: WorkAccess,
  attachmentId = 'attachment_1',
) => {
  const linkPending = vi.fn(async () => 'https://files.example/pending');
  const handler = new ReadAttachmentHandler(
    access,
    { find: vi.fn(async () => null) } satisfies AttachmentReaderPort,
    { linkPending } as unknown as AttachmentStorePort,
  );

  return {
    linkPending,
    read: () =>
      handler.execute(
        new ReadAttachmentQuery('acme', 'user_2', attachmentId, false),
      ),
  };
};

describe('ReadAttachmentHandler', () => {
  it('links an upload no task or chat holds yet for any member of its workspace', async () => {
    const { linkPending, read } = readingUnclaimed(
      workAccessSeeing(() => true),
    );

    expect(await read()).toBe('https://files.example/pending');
    expect(linkPending).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'ws_1' }),
      expect.objectContaining({ value: 'attachment_1' }),
      'shown',
    );
  });

  it('links nothing for an id no upload could have', async () => {
    const { linkPending, read } = readingUnclaimed(
      workAccessSeeing(() => true),
      'not/an/id',
    );

    expect(await read()).toBeNull();
    expect(linkPending).not.toHaveBeenCalled();
  });

  it('links no unclaimed upload for someone outside the workspace', async () => {
    const { linkPending, read } = readingUnclaimed(
      Object.assign(
        workAccessSeeing(() => true),
        {
          memberWorkspaceAt: async () => null,
        },
      ),
    );

    expect(await read()).toBeNull();
    expect(linkPending).not.toHaveBeenCalled();
  });

  it('links a task’s attachment for any member of its workspace', async () => {
    expect(await read({ kind: 'task', taskId: 'task_1' }, 'user_2')).toBe(
      'https://files.example/attachment_1',
    );
  });

  it('links a chat’s attachment only for the person who started the chat', async () => {
    const chat = {
      kind: 'chat',
      startedById: 'user_1',
      teamId: 'team_1',
    } as const;

    expect(await read(chat, 'user_1')).toBe(
      'https://files.example/attachment_1',
    );
    expect(await read(chat, 'user_2')).toBeNull();
  });
});
