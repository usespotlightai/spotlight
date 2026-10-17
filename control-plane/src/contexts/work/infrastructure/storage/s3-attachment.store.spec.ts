import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import type { S3Clients } from '@work/infrastructure/storage/s3-clients';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const FILE = Attachment.of({
  id: 'file_1',
  name: 'queue.png',
  contentType: 'image/png',
  size: 4096,
});
const KEPT = 'workspaces/ws_1/attachments/file_1';
const PENDING = 'pending/ws_1/file_1';

const notThere = () =>
  Object.assign(new Error('NoSuchKey'), { $metadata: { httpStatusCode: 404 } });

const headOutput = () => ({
  ContentType: 'image/png',
  ContentLength: 4096,
  Metadata: { name: encodeURIComponent('queue.png') },
});

type Command = HeadObjectCommand | CopyObjectCommand | DeleteObjectCommand;

const bucketWith = (keys: readonly string[], failing: Error[] = []) => {
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
      runners: store,
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
    it('reads an attachment already kept under its workspace without touching pending', async () => {
      const { send, store } = bucketWith([KEPT, PENDING]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).resolves.toEqual([FILE]);

      expect(sent(send)).toEqual([['HeadObjectCommand', KEPT]]);
    });

    it('reads an upload still pending', async () => {
      const { send, store } = bucketWith([PENDING]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).resolves.toEqual([FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', KEPT],
        ['HeadObjectCommand', PENDING],
      ]);
    });

    it('rejects an id nothing was uploaded for', async () => {
      const { store } = bucketWith([]);

      await expect(
        store.received(WORKSPACE, [AttachmentId.of('file_1')]),
      ).rejects.toThrow('was never uploaded');
    });
  });

  describe('taken', () => {
    it('copies the pending upload under the workspace with its metadata, then drops the original', async () => {
      const { send, store } = bucketWith([PENDING]);

      await store.taken(WORKSPACE, [FILE]);

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', KEPT],
        ['CopyObjectCommand', KEPT],
        ['DeleteObjectCommand', PENDING],
      ]);
      const [copy] = send.mock.calls[1] as [CopyObjectCommand];
      expect(copy.input).toEqual({
        Bucket: 'files',
        CopySource: `files/${PENDING}`,
        Key: KEPT,
        MetadataDirective: 'COPY',
      });
    });

    it('leaves an attachment already kept alone, whatever is still pending', async () => {
      const { send, store } = bucketWith([KEPT, PENDING]);

      await expect(store.taken(WORKSPACE, [FILE])).resolves.toBeUndefined();

      expect(sent(send)).toEqual([['HeadObjectCommand', KEPT]]);
    });

    it('is content with a pending copy another message moved meanwhile', async () => {
      const keys = [PENDING];
      const { send, store } = bucketWith(keys);
      send.mockImplementationOnce(async () => {
        throw notThere();
      });
      send.mockImplementationOnce(async () => {
        keys.splice(0, 1, KEPT);
        throw notThere();
      });

      await expect(store.taken(WORKSPACE, [FILE])).resolves.toBeUndefined();

      expect(sent(send)).toEqual([
        ['HeadObjectCommand', KEPT],
        ['CopyObjectCommand', KEPT],
        ['HeadObjectCommand', KEPT],
      ]);
    });

    it('rejects an upload that is neither pending nor kept', async () => {
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
});
