import { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import { ChooseIntegrationsHandler } from '@configuration/application/commands/handlers/choose-integrations.handler';
import { SECRETS_VAULT } from '@configuration/application/contracts/configuration-layout.contract';
import type { PendingConfiguration } from '@configuration/application/services/pending-configuration.service';
import type {
  ConfigurationChange,
  ProposeConfigurationChange,
} from '@configuration/application/services/propose-configuration-change.service';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import type { Writing } from '@configuration/application/services/write-configuration.service';
import { UnopenableVaultError } from '@configuration/domain/exceptions/unopenable-vault.error';
import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import type { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const STANDING = '-----BEGIN AGE ENCRYPTED FILE-----\nstanding';
const MERGED = '-----BEGIN AGE ENCRYPTED FILE-----\nmerged';

const handler = (
  over: { repository?: boolean; admin?: boolean; unopenable?: boolean } = {},
) => {
  let written: Writing | undefined;

  const proposals = {
    propose: vi.fn(async (change: ConfigurationChange) => {
      const asked = await change.written({
        team: {
          teamId: TeamId.of('team_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          connected: true,
          viewer: UserId.of('user_1'),
          administers: over.admin !== false,
        },
        into:
          over.repository === false
            ? null
            : {
                workspaceId: WorkspaceId.of('ws_1'),
                repository: Repository.of('acme/api'),
              },
      });

      if (asked.files.length + (asked.removes?.length ?? 0) === 0) {
        return null;
      }

      written = { title: change.title, body: change.body, ...asked };
      return { url: 'https://example/pr/1' };
    }),
  } as unknown as ProposeConfigurationChange;

  const vault = {
    sealedWith: vi.fn(async () => {
      if (over.unopenable) {
        throw new UnopenableVaultError(
          'has a secrets vault that does not open with the vault key',
        );
      }
      return SealedVault.of(MERGED);
    }),
  };

  return {
    handler: new ChooseIntegrationsHandler(
      proposals,
      {
        all: () => [],
        fileFor: (source: string) =>
          ['linear', 'sentry', 'slack'].includes(source)
            ? `version: 1\nintegration: ${source}\n`
            : null,
        secretsFor: (source: string) =>
          source === 'linear' ? [SecretName.of('LINEAR_WEBHOOK_SECRET')] : [],
      },
      {
        fileAt: vi.fn(async () =>
          ConfigurationFile.of(SECRETS_VAULT, STANDING),
        ),
      } as unknown as PendingConfiguration,
      vault as unknown as TeamVault,
    ),
    written: () => written,
    vault,
  };
};

const paths = (writing: Writing | undefined) =>
  (writing?.files ?? []).map((each) => each.path);

describe('ChooseIntegrations', () => {
  it('writes a chosen integration’s file', async () => {
    const { handler: choose, written } = handler();

    await choose.execute(
      new ChooseIntegrationsCommand('team_1', ['sentry'], 'user_1', []),
    );

    expect(paths(written())).toEqual(['.spotlight/integrations/sentry.yml']);
  });

  it('removes a dropped integration’s file', async () => {
    const { handler: choose, written } = handler();

    await choose.execute(
      new ChooseIntegrationsCommand('team_1', [], 'user_1', ['linear']),
    );

    expect(paths(written())).toHaveLength(0);
    expect(written()?.removes).toContain('.spotlight/integrations/linear.yml');
  });

  it('says nothing where a host nobody knows is the only one chosen', async () => {
    const { handler: choose, written } = handler();

    await expect(
      choose.execute(
        new ChooseIntegrationsCommand('team_1', ['nonesuch'], 'user_1', []),
      ),
    ).resolves.toBeNull();
    expect(written()).toBeUndefined();
  });

  describe('the secrets a chosen host reads', () => {
    it('seals them into the team’s vault beside the host’s file', async () => {
      const { handler: choose, written, vault } = handler();

      await choose.execute(
        new ChooseIntegrationsCommand('team_1', ['linear'], 'user_1', [], {
          LINEAR_WEBHOOK_SECRET: ' whsec_1 ',
          SOMETHING_ELSE: 'ignored',
        }),
      );

      const [teamId, current, added] = vault.sealedWith.mock
        .calls[0] as unknown as [TeamId, SealedVault, VaultSecrets];

      expect(teamId).toEqual(TeamId.of('team_1'));
      expect(current.text).toBe(STANDING);
      expect(added.names.map((each) => each.value)).toEqual([
        'LINEAR_WEBHOOK_SECRET',
      ]);
      expect(added.valueOf(SecretName.of('LINEAR_WEBHOOK_SECRET'))?.value).toBe(
        ' whsec_1 ',
      );
      expect(paths(written())).toEqual([
        '.spotlight/integrations/linear.yml',
        '.spotlight/secrets.vault',
      ]);
      expect(written()?.files[1]?.text).toBe(MERGED);
    });

    it('refuses a host whose secrets were not all given', async () => {
      const { handler: choose, written } = handler();

      await expect(
        choose.execute(
          new ChooseIntegrationsCommand('team_1', ['linear'], 'user_1', [], {
            LINEAR_WEBHOOK_SECRET: '  ',
          }),
        ),
      ).rejects.toMatchObject({
        kind: 'invalid-input',
        message: expect.stringContaining('LINEAR_WEBHOOK_SECRET'),
      });
      expect(written()).toBeUndefined();
    });

    it('refuses where the team has nowhere to keep secrets yet', async () => {
      const { handler: choose, written } = handler({ repository: false });

      await expect(
        choose.execute(
          new ChooseIntegrationsCommand('team_1', ['linear'], 'user_1', [], {
            LINEAR_WEBHOOK_SECRET: 'whsec_1',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(written()).toBeUndefined();
    });
  });

  describe('who may add a host that needs secrets', () => {
    it('refuses somebody who is no owner or admin, and writes nothing', async () => {
      const { handler: choose, written, vault } = handler({ admin: false });

      await expect(
        choose.execute(
          new ChooseIntegrationsCommand('team_1', ['linear'], 'user_1', [], {
            LINEAR_WEBHOOK_SECRET: 'whsec_1',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'not-allowed' });
      expect(vault.sealedWith).not.toHaveBeenCalled();
      expect(written()).toBeUndefined();
    });

    it('still lets anybody on the team add a host that needs none', async () => {
      const { handler: choose, written } = handler({ admin: false });

      await choose.execute(
        new ChooseIntegrationsCommand('team_1', ['sentry'], 'user_1', []),
      );

      expect(paths(written())).toEqual(['.spotlight/integrations/sentry.yml']);
    });

    it('writes nothing where the vault the team holds will not open', async () => {
      const { handler: choose, written } = handler({ unopenable: true });

      await expect(
        choose.execute(
          new ChooseIntegrationsCommand('team_1', ['linear'], 'user_1', [], {
            LINEAR_WEBHOOK_SECRET: 'whsec_1',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(written()).toBeUndefined();
    });
  });
});
