import { randomBytes } from 'node:crypto';
import { DecryptionFailedError } from '@secrets/infrastructure/crypto/envelope';
import { LocalKeyManagement } from '@secrets/infrastructure/kms/local-key-management';
import { describe, expect, it } from 'vitest';

const KEY = randomBytes(32).toString('base64');
const CONTEXT = { purpose: 'spotlight-secrets', workspace: 'ws_1' };

describe('LocalKeyManagement', () => {
  it('issues a fresh data key and unwraps it again', async () => {
    const kms = new LocalKeyManagement(KEY);
    const issued = await kms.issue(CONTEXT);

    expect(issued.plain).toHaveLength(32);
    await expect(kms.unwrap(issued.wrapped, CONTEXT)).resolves.toEqual(
      issued.plain,
    );
  });

  it('issues a different data key every time', async () => {
    const kms = new LocalKeyManagement(KEY);

    expect((await kms.issue(CONTEXT)).plain).not.toEqual(
      (await kms.issue(CONTEXT)).plain,
    );
  });

  it('unwraps a data key only for the workspace it was issued to', async () => {
    const kms = new LocalKeyManagement(KEY);
    const issued = await kms.issue(CONTEXT);

    await expect(
      kms.unwrap(issued.wrapped, { ...CONTEXT, workspace: 'ws_2' }),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it('unwraps nothing with another deployment key', async () => {
    const issued = await new LocalKeyManagement(KEY).issue(CONTEXT);

    await expect(
      new LocalKeyManagement(randomBytes(32).toString('base64')).unwrap(
        issued.wrapped,
        CONTEXT,
      ),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it('rejects a deployment key that is not thirty-two bytes', () => {
    expect(() => new LocalKeyManagement('short')).toThrow(/32 bytes/);
  });
});
