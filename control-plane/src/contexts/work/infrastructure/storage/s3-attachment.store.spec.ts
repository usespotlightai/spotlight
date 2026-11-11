import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { KeyOverlay } from '@platform/storage/key-overlay';
import type { S3Clients } from '@platform/storage/s3-clients';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(
    async (
      _client: unknown,
      command: {
        input: { Key?: string; ResponseContentDisposition?: string };
      },
    ) =>
      `signed ${command.input.Key} ${command.input.ResponseContentDisposition}`,
  ),
}));

const WORKSPACE = WorkspaceId.of('ws_1');
const FILE = Attachment.of({
  id: 'file_1',
  name: 'queue.png',
  contentType: 'image/png',
  size: 4096,
});
const STORED = 'workspaces/ws_1/attachments/file_1';
const PENDING = 'pending/ws_1/file_1';

const notThere = () =>
  Object.assign(new Error('NoSuchKey'), { $metadata: { httpStatusCode: 404 } });

const headOutput = () => ({
  ContentType: 'image/png',
  ContentLength: 4096,
  Metadata: { name: encodeURIComponent('queue.png'), uploader: 'run_1' },
});

type Command =
  | HeadObjectCommand
  | CopyObjectCommand
  | DeleteObjectCommand
  | PutObjectCommand;

const bucketWith = (
  keys: readonly string[],
  failing: Error[] = [],
  prefix?: string,
) => {
  const send = vi.fn(async (command: Command) => {
    if (command instanceof HeadObjectCommand) {
      if (keys.includes(command.input.Key ?? '')) {
        return headOutput();
      }
      throw notThere();
    }
    if (command instanceof CopyObjectCommand) {
      const source = command.input.CopySource?.replace(/^files\//, '') ?? '';
      if (keys.includes(source)) {
        return {};
      }
      throw notThere();
    }
    const failure = failing.shift();
    if (failure) {
      throw failure;
    }
    return {};
  });
  const store = { send } as unknown as S3Client;

  return {
    send,
    store: new S3AttachmentStore({
      bucket: 'files',
      store,
      signer: store,
      machineSigner: store,
      keys: KeyOverlay.of(prefix),
    } satisfies S3Clients),
  };
};

const sent = (send: { mock: { calls: unknown[][] } }) =>
  send.mock.calls.map((call) => {
    const [command] = call as [Command];

    return [command.constructor.name, command.input.Key];
  });

describe('S3AttachmentStore', () => {
  describe('received', () => {
    it('reads an attachment already stored under its workspace without touching pending', async () => {
      const { send, store } = bucketWith([STORED, PENDING]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).resolves.toEqual([FILE]);

      expect(sent(send)).toEqual([['HeadObjectCommand', STORED]]);
    });

    it('reads an upload still pending', async () => {
      const { send, store } = bucketWith([PENDING]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).resolves.toEqual([FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', STORED],
        ['HeadObjectCommand', PENDING],
      ]);
    });

    it('reads an id named twice once', async () => {
      const { store } = bucketWith([STORED]);

      await expect(
        store.received(WORKSPACE, [
          AttachmentId.of('file_1'),
          AttachmentId.of('file_1'),
        ]),
      ).resolves.toEqual([FILE]);
    });

    it('takes a file from a run only when that run uploaded it', async () => {
      const { store } = bucketWith([PENDING]);

      await expect(
        store.received(
          WORKSPACE,
          [AttachmentId.of('file_1')],
          RunId.of('run_1'),
        ),
      ).resolves.toEqual([FILE]);
      await expect(
        store.received(
          WORKSPACE,
          [AttachmentId.of('file_1')],
          RunId.of('run_2'),
        ),
      ).rejects.toThrow('was not uploaded by this run');
    });

    it('rejects an id nothing was uploaded for', async () => {
      const { store } = bucketWith([]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).rejects.toThrow('was never uploaded');
    });
  });

  describe('link', () => {
    it('signs the stored file to show an image inline', async () => {
      const { store } = bucketWith([STORED]);

      expect(await store.link(WORKSPACE, FILE, 'shown')).toBe(
        `signed ${STORED} inline; filename*=UTF-8''queue.png`,
      );
    });
  });

  describe('linkPending', () => {
    it('signs a pending upload with the name and type it was uploaded with', async () => {
      const { store } = bucketWith([PENDING]);

      expect(
        await store.linkPending(WORKSPACE, AttachmentId.of('file_1'), 'saved'),
      ).toBe(`signed ${PENDING} attachment; filename*=UTF-8''queue.png`);
    });

    it('links nothing when no upload is pending under the workspace', async () => {
      const { send, store } = bucketWith([STORED]);

      expect(
        await store.linkPending(WORKSPACE, AttachmentId.of('file_1'), 'shown'),
      ).toBeNull();
      expect(sent(send)).toEqual([['HeadObjectCommand', PENDING]]);
    });
  });

  describe('copy', () => {
    it('copies a stored file under the new id, keeping its metadata', async () => {
      const { send, store } = bucketWith([STORED]);

      await store.copy(
        WORKSPACE,
        FILE,
        FILE.copiedAs(AttachmentId.of('file_2')),
      );

      const [copy] = send.mock.calls[0] as [CopyObjectCommand];
      expect(copy.input).toEqual({
        Bucket: 'files',
        CopySource: `files/${STORED}`,
        Key: 'workspaces/ws_1/attachments/file_2',
        MetadataDirective: 'COPY',
      });
    });
  });

  describe('taken', () => {
    it('copies the pending upload under the workspace with its metadata, then drops the original', async () => {
      const { send, store } = bucketWith([PENDING]);

      await store.taken(WORKSPACE, [FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', STORED],
        ['CopyObjectCommand', STORED],
        ['DeleteObjectCommand', PENDING],
      ]);
      const [copy] = send.mock.calls[1] as [CopyObjectCommand];
      expect(copy.input).toEqual({
        Bucket: 'files',
        CopySource: `files/${PENDING}`,
        Key: STORED,
        MetadataDirective: 'COPY',
      });
    });

    it('leaves an attachment already stored alone, whatever is still pending', async () => {
      const { send, store } = bucketWith([STORED, PENDING]);

      await expect(store.taken(WORKSPACE, [FILE])).resolves.toBeUndefined();

      expect(sent(send)).toEqual([['HeadObjectCommand', STORED]]);
    });

    it('is content with a pending copy another message moved meanwhile', async () => {
      const keys = [PENDING];
      const { send, store } = bucketWith(keys);
      send.mockImplementationOnce(async () => {
        throw notThere();
      });
      send.mockImplementationOnce(async () => {
        keys.splice(0, 1, STORED);
        throw notThere();
      });

      await expect(store.taken(WORKSPACE, [FILE])).resolves.toBeUndefined();

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', STORED],
        ['CopyObjectCommand', STORED],
        ['HeadObjectCommand', STORED],
      ]);
    });

    it('rejects an upload that is neither pending nor stored', async () => {
      const { store } = bucketWith([]);

      await expect(store.taken(WORKSPACE, [FILE])).rejects.toThrow(
        'was never uploaded',
      );
    });

    it('shrugs at a pending copy that is already gone, but not at a failed delete', async () => {
      const gone = bucketWith([PENDING], [notThere()]);
      await expect(
        gone.store.taken(WORKSPACE, [FILE]),
      ).resolves.toBeUndefined();

      const denied = bucketWith([PENDING], [new Error('AccessDenied')]);
      await expect(denied.store.taken(WORKSPACE, [FILE])).rejects.toThrow(
        'AccessDenied',
      );
    });

    it('moves nothing when nothing was handed over', async () => {
      const { send, store } = bucketWith([]);

      await store.taken(WORKSPACE, []);

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('under a key prefix', () => {
    const PREVIEW = 'previews/feat-x';
    const OWN_STORED = `${PREVIEW}/${STORED}`;
    const OWN_PENDING = `${PREVIEW}/${PENDING}`;

    it('reads its own copy first, then the shared one', async () => {
      const { send, store } = bucketWith([STORED], [], PREVIEW);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).resolves.toEqual([FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', OWN_STORED],
        ['HeadObjectCommand', STORED],
      ]);
    });

    it('signs the shared file when it has no copy of its own', async () => {
      const { store } = bucketWith([STORED], [], PREVIEW);

      expect(await store.link(WORKSPACE, FILE, 'shown')).toBe(
        `signed ${STORED} inline; filename*=UTF-8''queue.png`,
      );
    });

    it('writes uploads and saved files under its prefix', async () => {
      const { send, store } = bucketWith([], [], PREVIEW);

      expect((await store.grant(WORKSPACE, RunId.of('run_1'), FILE)).url).toBe(
        `signed ${OWN_PENDING} undefined`,
      );
      await store.save(WORKSPACE, FILE, new Uint8Array([1]));

      expect(sent(send)).toEqual([['PutObjectCommand', OWN_STORED]]);
    });

    it('copies a shared file into its prefix', async () => {
      const { send, store } = bucketWith([STORED], [], PREVIEW);

      await store.copy(
        WORKSPACE,
        FILE,
        FILE.copiedAs(AttachmentId.of('file_2')),
      );

      const [copy] = send.mock.calls[send.mock.calls.length - 1] as [
        CopyObjectCommand,
      ];
      expect(copy.input).toMatchObject({
        CopySource: `files/${STORED}`,
        Key: `${PREVIEW}/workspaces/ws_1/attachments/file_2`,
      });
    });

    it('takes a shared pending upload into its prefix and leaves the shared one', async () => {
      const { send, store } = bucketWith([PENDING], [], PREVIEW);

      await store.taken(WORKSPACE, [FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', OWN_STORED],
        ['HeadObjectCommand', STORED],
        ['HeadObjectCommand', OWN_PENDING],
        ['HeadObjectCommand', PENDING],
        ['CopyObjectCommand', OWN_STORED],
      ]);
    });

    it('drops its own pending upload once it is taken', async () => {
      const { send, store } = bucketWith([OWN_PENDING], [], PREVIEW);

      await store.taken(WORKSPACE, [FILE]);

      const calls = sent(send);
      expect(calls[calls.length - 1]).toEqual([
        'DeleteObjectCommand',
        OWN_PENDING,
      ]);
    });
  });
});
