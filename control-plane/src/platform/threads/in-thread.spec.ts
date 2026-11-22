import { join } from 'node:path';

import { inThread } from '@platform/threads/in-thread';
import { describe, expect, it } from 'vitest';

const THREAD = join(__dirname, 'test-thread.fake-spec.ts');

const run = (within: number) => ({
  within,
  late: () => new Error('too late'),
  failed: (reason: string) => new Error(`failed: ${reason}`),
});

describe('inThread', () => {
  it('answers with what the thread worked out', async () => {
    expect(await inThread(THREAD, 'answer', run(20_000))).toBe('answered');
  }, 30_000);

  it('fails with the reason the thread gave', async () => {
    await expect(inThread(THREAD, 'fail', run(20_000))).rejects.toThrow(
      'failed: the input has no end',
    );
  }, 30_000);

  it('stops a thread that does not answer in time', async () => {
    await expect(inThread(THREAD, 'spin', run(3_000))).rejects.toThrow(
      'too late',
    );
  }, 30_000);
});
