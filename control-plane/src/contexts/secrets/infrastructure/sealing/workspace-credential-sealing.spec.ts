import { randomBytes } from 'node:crypto';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialUnopenableError } from '@secrets/application/errors/credential-unopenable.error';
import { UnopenableEnvelopeError } from '@secrets/infrastructure/crypto/envelope';
import type { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { WorkspaceCredentialSealing } from '@secrets/infrastructure/sealing/workspace-credential-sealing';
import { describe, expect, it } from 'vitest';

const keyed = (key: Buffer) =>
  new WorkspaceCredentialSealing({
    of: async () => key,
  } as unknown as WorkspaceKeys);

const keyless = (error: Error) =>
  new WorkspaceCredentialSealing({
    of: async () => {
      throw error;
    },
  } as unknown as WorkspaceKeys);

const PLAIN = Credential.of('plain');

describe('WorkspaceCredentialSealing', () => {
  it('opens what it sealed', async () => {
    const sealing = keyed(randomBytes(32));
    const sealed = await sealing.seal('ws_1', 'label', PLAIN);

    const opened = await sealing.open('ws_1', 'label', sealed);

    expect(opened.revealed()).toBe('plain');
    expect(`${opened}`).not.toContain('plain');
  });

  it('says a credential sealed with another key does not open', async () => {
    const sealed = await keyed(randomBytes(32)).seal('ws_1', 'label', PLAIN);

    await expect(
      keyed(randomBytes(32)).open('ws_1', 'label', sealed),
    ).rejects.toBeInstanceOf(CredentialUnopenableError);
  });

  it('says a credential does not open when the workspace key itself does not unwrap', async () => {
    const sealed = await keyed(randomBytes(32)).seal('ws_1', 'label', PLAIN);

    await expect(
      keyless(new UnopenableEnvelopeError('another master key')).open(
        'ws_1',
        'label',
        sealed,
      ),
    ).rejects.toBeInstanceOf(CredentialUnopenableError);
  });

  it('lets any other failure through as it is', async () => {
    const down = new Error('the database is down');
    const sealed = await keyed(randomBytes(32)).seal('ws_1', 'label', PLAIN);

    await expect(keyless(down).open('ws_1', 'label', sealed)).rejects.toBe(
      down,
    );
  });
});
