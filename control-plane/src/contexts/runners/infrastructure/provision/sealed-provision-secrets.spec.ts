import {
  POOL_ID,
  secretOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import { SealedProvisionSecrets } from '@runners/infrastructure/provision/sealed-provision-secrets';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialUnopenableError } from '@secrets/application/errors/credential-unopenable.error';
import type { CredentialSealingPort } from '@secrets/application/ports/credential-sealing.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const HOLDER = { id: POOL_ID, workspaceId: WorkspaceId.of('ws_1') };

const sealing = (opens = true) =>
  ({
    seal: vi.fn(
      async (workspaceId: string, label: string, plain: Credential) =>
        `${workspaceId}|${label}|${plain.revealed()}`,
    ),
    open: vi.fn(async (_workspaceId: string, label: string, sealed: string) => {
      if (!opens) {
        throw new CredentialUnopenableError(label);
      }
      return Credential.of(sealed.split('|')[2] ?? '');
    }),
  }) satisfies CredentialSealingPort;

describe('SealedProvisionSecrets', () => {
  it('seals a pool’s secret under its workspace and a label naming the pool, and opens it again', async () => {
    const vault = sealing();
    const secrets = new SealedProvisionSecrets(vault);

    const sealed = await secrets.sealed(HOLDER, secretOf('s'));

    expect(vault.seal.mock.calls[0]?.slice(0, 2)).toEqual([
      'ws_1',
      'runner-pool:pool_1:provision-secret',
    ]);
    expect(vault.seal.mock.calls[0]?.[2].revealed()).toBe(
      secretOf('s').revealed(),
    );
    expect((await secrets.opened(HOLDER, sealed)).equals(secretOf('s'))).toBe(
      true,
    );
  });

  it('says a secret this deployment’s keys cannot open is unopenable', async () => {
    const secrets = new SealedProvisionSecrets(sealing(false));
    const sealed = await secrets.sealed(HOLDER, secretOf('s'));

    await expect(secrets.opened(HOLDER, sealed)).rejects.toThrow(
      ProvisionSecretUnopenableError,
    );
  });
});
