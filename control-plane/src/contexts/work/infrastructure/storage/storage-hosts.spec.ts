import type { Env } from '@platform/config/env.schema';
import { StorageHosts } from '@work/infrastructure/storage/storage-hosts';
import { describe, expect, it } from 'vitest';

const env = (over: Partial<Env>): Env =>
  ({
    S3_BUCKET: 'files',
    S3_REGION: 'eu-west-1',
    S3_FORCE_PATH_STYLE: false,
    ...over,
  }) as Env;

describe('StorageHosts', () => {
  it('allows the storage host that runners are sent to', () => {
    expect(
      new StorageHosts(
        env({
          S3_ENDPOINT: 'http://storage:9000',
          S3_RUNNER_ENDPOINT: 'http://files.internal:9000',
        }),
      ).hosts(),
    ).toEqual(['files.internal']);
    expect(
      new StorageHosts(env({ S3_ENDPOINT: 'http://storage:9000' })).hosts(),
    ).toEqual(['storage']);
  });

  it('allows the bucket’s own host on S3, or the regional one by path', () => {
    expect(new StorageHosts(env({})).hosts()).toEqual([
      'files.s3.eu-west-1.amazonaws.com',
    ]);
    expect(
      new StorageHosts(env({ S3_FORCE_PATH_STYLE: true })).hosts(),
    ).toEqual(['s3.eu-west-1.amazonaws.com']);
  });
});
