import { SECRETS_VAULT } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type {
  VaultKeyLookup,
  VaultKeysPort,
} from '@configuration/application/ports/vault-keys.port';
import type {
  VaultOpening,
  VaultSealingPort,
} from '@configuration/application/ports/vault-sealing.port';
import { TeamSecrets } from '@configuration/application/services/team-secrets.service';
import { TeamVault } from '@configuration/application/services/team-vault.service';
import { UnopenableVaultError } from '@configuration/domain/exceptions/unopenable-vault.error';
import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const STANDING = {
  SLACK_BOT_TOKEN: 'xoxb-fake',
  LINEAR_WEBHOOK_SECRET: 'lin-fake',
};

const sealedWith = (key: string, secrets: Record<string, string>) =>
  `${key}\n${JSON.stringify(secrets)}`;

const sealing = {
  issueKey: () => VaultKey.of('issued-key'),
  open: async (vault: SealedVault, key: VaultKey): Promise<VaultOpening> => {
    const [lock, body] = vault.text.split('\n');

    if (lock === 'unreadable') {
      return { opened: false, because: 'unreadable', detail: 'is not age' };
    }
    if (lock !== key.value) {
      return { opened: false, because: 'not-for-this-key', detail: '' };
    }

    return {
      opened: true,
      secrets: VaultSecrets.of(
        Object.entries(JSON.parse(body ?? '{}') as Record<string, string>).map(
          ([name, value]) => ({
            name: SecretName.of(name),
            value: SecretValue.maybe(value) as SecretValue,
          }),
        ),
      ),
    };
  },
  seal: async () => SealedVault.of(''),
} satisfies VaultSealingPort;

const secrets = (
  vault: string | null,
  lookup: VaultKeyLookup = { kind: 'held', key: VaultKey.of('vault-key') },
  over: { configured?: boolean } = {},
) => {
  const configurations = {
    of: async () =>
      over.configured === false
        ? null
        : {
            teamId: TEAM,
            repository: Repository.of('acme/api'),
            files:
              vault === null
                ? []
                : [ConfigurationFile.of(SECRETS_VAULT, vault)],
          },
  } as unknown as AppliedConfigurationPort;
  const keys = {
    of: async () => lookup,
    keepFirst: async () => lookup,
  } satisfies VaultKeysPort;

  return new TeamSecrets(configurations, new TeamVault(keys, sealing));
};

const heldBy = async (team: TeamSecrets) =>
  (await team.held(TEAM)).map((each) => each.value);

describe('TeamSecrets', () => {
  it('resolves each asked-for secret the applied vault holds', async () => {
    await expect(
      secrets(sealedWith('vault-key', STANDING)).resolveAll(TEAM, [
        SecretName.of('SLACK_BOT_TOKEN'),
        SecretName.of('SENTRY_WEBHOOK_SECRET'),
      ]),
    ).resolves.toEqual({ SLACK_BOT_TOKEN: 'xoxb-fake' });
  });

  it('says which secrets the applied vault holds', async () => {
    await expect(
      heldBy(secrets(sealedWith('vault-key', STANDING))),
    ).resolves.toEqual(['LINEAR_WEBHOOK_SECRET', 'SLACK_BOT_TOKEN']);
  });

  it('holds nothing where the team has no configuration, or no vault in it', async () => {
    await expect(
      heldBy(secrets(null, undefined, { configured: false })),
    ).resolves.toEqual([]);
    await expect(heldBy(secrets(null))).resolves.toEqual([]);
    await expect(
      secrets(null).resolveAll(TEAM, [SecretName.of('SLACK_BOT_TOKEN')]),
    ).resolves.toEqual({});
  });

  it('holds nothing ready where the vault does not open', async () => {
    await expect(
      heldBy(secrets(sealedWith('someone-else', STANDING))),
    ).resolves.toEqual([]);
    await expect(heldBy(secrets('unreadable\n'))).resolves.toEqual([]);
  });

  it('says why, rather than handing over nothing, where secrets are asked of a vault that does not open', async () => {
    const vault = sealedWith('vault-key', STANDING);

    await expect(
      secrets(vault, { kind: 'unreadable' }).resolveAll(TEAM, [
        SecretName.of('SLACK_BOT_TOKEN'),
      ]),
    ).rejects.toThrow(UnopenableVaultError);
    await expect(
      secrets(vault, { kind: 'none' }).resolveAll(TEAM, [
        SecretName.of('SLACK_BOT_TOKEN'),
      ]),
    ).rejects.toThrow(/key Spotlight does not hold/);
  });
});
