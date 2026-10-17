import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { FilesLoader } from '@work/application/services/files-loader.service';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const store = () =>
  ({
    grant: vi.fn(),
    received: vi.fn(async (_at, ids: readonly AttachmentId[]) =>
      ids.map((id) =>
        Attachment.of({
          id: id.value,
          name: 'queue.png',
          contentType: 'image/png',
          size: 4096,
        }),
      ),
    ),
    save: vi.fn(),
    taken: vi.fn(),
    link: vi.fn(),
    open: vi.fn(),
  }) satisfies AttachmentStorePort;

describe('FilesLoader', () => {
  it('hands back what the store says was uploaded', async () => {
    const files = store();

    await expect(
      new FilesLoader(files).handedOver(WORKSPACE, ['file_1']),
    ).resolves.toEqual([
      Attachment.of({
        id: 'file_1',
        name: 'queue.png',
        contentType: 'image/png',
        size: 4096,
      }),
    ]);

    const [, requested] = files.received.mock.calls[0] as unknown as [
      unknown,
      readonly AttachmentId[],
    ];
    expect(requested.map((each) => each.value)).toEqual(['file_1']);
  });

  it('rejects an id that names anywhere but a file', async () => {
    const files = store();

    await expect(
      new FilesLoader(files).handedOver(WORKSPACE, ['../file_2']),
    ).rejects.toThrow('Attachment id must not be empty.');

    expect(files.received).not.toHaveBeenCalled();
  });

  it('has the store take the files in', async () => {
    const files = store();
    const file = Attachment.of({
      id: 'file_1',
      name: 'queue.png',
      contentType: 'image/png',
      size: 4096,
    });

    await new FilesLoader(files).takenIn(WORKSPACE, [file]);

    expect(files.taken).toHaveBeenCalledWith(WORKSPACE, [file]);
  });

  it('requests nothing where nothing was handed over', async () => {
    const files = store();

    await expect(
      new FilesLoader(files).handedOver(WORKSPACE, []),
    ).resolves.toEqual([]);
  });
});
