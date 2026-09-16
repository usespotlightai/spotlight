import { SECRETS_VAULT } from '@application/contracts/configuration-layout.contract';
import type {
  VaultOpening,
  VaultSealingPort,
} from '@application/ports/vault-sealing.port';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type {
  VaultKeyLookup,
  VaultKeyRepository,
} from '@domain/repositories/vault-key.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SecretValue } from '@domain/value-objects/secret-value.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { VaultKey } from '@domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@domain/value-objects/vault-secrets.vo';
import { VaultTeamSecrets } from '@infrastructure/secrets/vault-team-secrets';
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
    findFor: async () =>
      over.configured === false
        ? null
        : TeamConfiguration.read({
            teamId: TEAM,
            repository: Repository.of('acme/api'),
            commit: Commit.of('a1b2c3d'),
            files:
              vault === null
                ? []
                : [ConfigurationFile.of(SECRETS_VAULT, vault)],
            readAt: new Date('2026-09-13T08:00:00.000Z'),
          }),
  } as unknown as TeamConfigurationRepository;
  const keys = {
    of: async () => lookup,
    keepFirst: async () => lookup,
  } satisfies VaultKeyRepository;

  return new VaultTeamSecrets(configurations, keys, sealing);
};

const heldBy = async (team: VaultTeamSecrets) =>
  (await team.held(TEAM)).map((each) => each.value);

describe('VaultTeamSecrets', () => {
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
  });

  it('holds nothing where the vault does not open', async () => {
    await expect(
      heldBy(secrets(sealedWith('someone-else', STANDING))),
    ).resolves.toEqual([]);
    await expect(heldBy(secrets('unreadable\n'))).resolves.toEqual([]);
  });

  it('holds nothing where the team keeps no key, or one that cannot be read', async () => {
    const vault = sealedWith('vault-key', STANDING);

    await expect(heldBy(secrets(vault, { kind: 'none' }))).resolves.toEqual([]);
    await expect(
      secrets(vault, { kind: 'unreadable' }).resolveAll(TEAM, [
        SecretName.of('SLACK_BOT_TOKEN'),
      ]),
    ).resolves.toEqual({});
  });
});
