import type { Env } from '@platform/config/env.schema';
import { StorageReach } from '@work/infrastructure/storage/storage-reach';
import { describe, expect, it } from 'vitest';

const env = (over: Partial<Env>): Env =>
  ({
    S3_BUCKET: 'files',
    S3_REGION: 'eu-west-1',
    S3_FORCE_PATH_STYLE: false,
    ...over,
  }) as Env;

describe('StorageReach', () => {
  it('reaches the storage runners are sent to', () => {
    expect(
      new StorageReach(
        env({
          S3_ENDPOINT: 'http://storage:9000',
          S3_RUNNER_ENDPOINT: 'http://files.internal:9000',
        }),
      ).hosts(),
    ).toEqual(['files.internal']);
    expect(
      new StorageReach(env({ S3_ENDPOINT: 'http://storage:9000' })).hosts(),
    ).toEqual(['storage']);
  });

  it('reaches the bucket’s own host on S3, or the regional one by path', () => {
    expect(new StorageReach(env({})).hosts()).toEqual([
      'files.s3.eu-west-1.amazonaws.com',
    ]);
    expect(
      new StorageReach(env({ S3_FORCE_PATH_STYLE: true })).hosts(),
    ).toEqual(['s3.eu-west-1.amazonaws.com']);
  });
});
