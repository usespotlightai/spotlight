import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  AttachmentHolder,
  AttachmentReaderPort,
} from '@work/application/ports/attachment-reader.port';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { ReadAttachmentHandler } from '@work/application/queries/handlers/read-attachment.handler';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { describe, expect, it, vi } from 'vitest';

const reading = (holder: AttachmentHolder) =>
  new ReadAttachmentHandler(
    {
      findForMember: vi.fn(async () => ({ id: 'ws_1' })),
    } as unknown as WorkspaceReaderPort,
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

describe('ReadAttachmentHandler', () => {
  it('links a task’s attachment for any member of its workspace', async () => {
    expect(await read({ kind: 'task' }, 'user_2')).toBe(
      'https://files.example/attachment_1',
    );
  });

  it('links a chat’s attachment only for the person who started the chat', async () => {
    const chat = { kind: 'chat', startedById: 'user_1' } as const;

    expect(await read(chat, 'user_1')).toBe(
      'https://files.example/attachment_1',
    );
    expect(await read(chat, 'user_2')).toBeNull();
  });
});
