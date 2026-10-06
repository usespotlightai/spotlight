import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { FilesAtHand } from '@work/application/services/files-at-hand.service';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const store = () =>
  ({
    grant: vi.fn(),
    received: vi.fn(async (_at, given: readonly AttachmentId[]) =>
      given.map((id) =>
        Attachment.of({
          id: id.value,
          name: 'queue.png',
          contentType: 'image/png',
          size: 4096,
        }),
      ),
    ),
    keep: vi.fn(),
    link: vi.fn(),
    open: vi.fn(),
  }) satisfies AttachmentStorePort;

describe('FilesAtHand', () => {
  it('hands back what the store says was uploaded', async () => {
    const files = store();

    await expect(
      new FilesAtHand(files).handedOver(WORKSPACE, ['file_1']),
    ).resolves.toEqual([
      Attachment.of({
        id: 'file_1',
        name: 'queue.png',
        contentType: 'image/png',
        size: 4096,
      }),
    ]);

    const [, asked] = files.received.mock.calls[0] as unknown as [
      unknown,
      readonly AttachmentId[],
    ];
    expect(asked.map((each) => each.value)).toEqual(['file_1']);
  });

  it('refuses an id that names anywhere but a file', async () => {
    const files = store();

    await expect(
      new FilesAtHand(files).handedOver(WORKSPACE, ['../file_2']),
    ).rejects.toThrow('Attachment id must not be empty.');

    expect(files.received).not.toHaveBeenCalled();
  });

  it('asks for nothing where nothing was handed over', async () => {
    const files = store();

    await expect(
      new FilesAtHand(files).handedOver(WORKSPACE, []),
    ).resolves.toEqual([]);
  });
});
