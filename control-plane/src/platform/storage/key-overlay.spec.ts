import type { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { KeyOverlay } from '@platform/storage/key-overlay';
import { describe, expect, it, vi } from 'vitest';

const bucketWith = (keys: readonly string[]) => {
  const send = vi.fn(async (command: HeadObjectCommand) => {
    if (keys.includes(command.input.Key ?? '')) {
      return { ContentLength: 1 };
    }
    throw Object.assign(new Error('NotFound'), {
      $metadata: { httpStatusCode: 404 },
    });
  });

  return { send, client: { send } as unknown as S3Client };
};

describe('KeyOverlay', () => {
  it('uses the shared key alone when there is no prefix', () => {
    const keys = KeyOverlay.of(undefined);

    expect(keys.writeKey('a/b')).toBe('a/b');
    expect(keys.readKeys('a/b')).toEqual(['a/b']);
    expect(keys.owns('a/b')).toBe(true);
  });

  it('writes under the prefix and reads the prefix first', () => {
    const keys = KeyOverlay.of('/previews/feat-x/');

    expect(keys.writeKey('a/b')).toBe('previews/feat-x/a/b');
    expect(keys.readKeys('a/b')).toEqual(['previews/feat-x/a/b', 'a/b']);
    expect(keys.owns('previews/feat-x/a/b')).toBe(true);
    expect(keys.owns('a/b')).toBe(false);
  });

  it('locates the first key that exists', async () => {
    const { client } = bucketWith(['a/b']);

    await expect(
      KeyOverlay.of('previews/feat-x').locate(client, 'files', 'a/b'),
    ).resolves.toMatchObject({ key: 'a/b' });
    await expect(
      KeyOverlay.of('previews/feat-x').locate(client, 'files', 'c'),
    ).resolves.toBeNull();
  });

  it('reads the shared key without a lookup when there is no prefix', async () => {
    const { send, client } = bucketWith([]);

    await expect(
      KeyOverlay.of('').readKey(client, 'files', 'a/b'),
    ).resolves.toBe('a/b');
    expect(send).not.toHaveBeenCalled();
  });

  it('reads its own key for an object that is nowhere yet', async () => {
    const { client } = bucketWith([]);

    await expect(
      KeyOverlay.of('p').readKey(client, 'files', 'a/b'),
    ).resolves.toBe('p/a/b');
  });
});
