import type { ChooseIntegrationsCommand } from '@application/commands/choose-integrations.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { StarterIntegrationsPort } from '@application/ports/starter-integrations.port';
import type { PendingConfiguration } from '@application/services/pending-configuration.service';
import type {
  ProposalTarget,
  ProposeConfigurationChange,
} from '@application/services/propose-configuration-change.service';
import { starterSecrets } from '@application/services/starter-secrets';
import type { TeamVault } from '@application/services/team-vault.service';
import {
  integrationPath,
  SECRETS_VAULT,
} from '@domain/aggregates/team-configuration.aggregate';
import { MissingSecretsError } from '@domain/exceptions/missing-secrets.error';
import { NotYoursToSealSecretsError } from '@domain/exceptions/not-yours-to-seal-secrets.error';
import { NowhereToKeepSecretsError } from '@domain/exceptions/nowhere-to-keep-secrets.error';
import { distinct } from '@domain/services/distinct';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import { SecretValue } from '@domain/value-objects/secret-value.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import {
  type VaultSecret,
  VaultSecrets,
} from '@domain/value-objects/vault-secrets.vo';

export class ChooseIntegrationsHandler
  implements
    CommandHandlerPort<ChooseIntegrationsCommand, OpenedPullRequestDto | null>
{
  constructor(
    private readonly proposals: ProposeConfigurationChange,
    private readonly starters: StarterIntegrationsPort,
    private readonly integrations: IntegrationReaderPort,
    private readonly pending: PendingConfiguration,
    private readonly vault: TeamVault,
  ) {}

  async execute(
    command: ChooseIntegrationsCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      const chosen = command.sources
        .map((source) => ({ source, file: this.starters.fileFor(source) }))
        .filter(
          (each): each is { source: string; file: string } =>
            each.file !== null,
        );
      const dropped = command.dropped.map((each) => integrationPath(each));
      const needed = distinct(
        chosen.flatMap((each) =>
          starterSecrets(this.starters, this.integrations, each.source),
        ),
      );

      return await this.proposals.propose({
        teamId: command.teamId,
        viewerId: command.viewerId,
        title: titleFor(chosen.length, dropped.length),
        body: BODY,
        written: async (target) => ({
          files: [
            ...chosen.map((each) =>
              ConfigurationFile.of(integrationPath(each.source), each.file),
            ),
            ...(needed.length > 0
              ? [await this.vaultWith(command, target, needed)]
              : []),
          ],
          removes: dropped,
        }),
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async vaultWith(
    command: ChooseIntegrationsCommand,
    target: ProposalTarget,
    needed: readonly SecretName[],
  ): Promise<ConfigurationFile> {
    if (!target.workspace.maySealSecretsBy(UserId.of(command.viewerId))) {
      throw new NotYoursToSealSecretsError();
    }

    const given = needed.flatMap((name): VaultSecret[] => {
      const value = SecretValue.maybe(command.secrets[name.value] ?? '');
      return value ? [{ name, value }] : [];
    });
    const missing = needed.filter(
      (name) => !given.some((each) => each.name.equals(name)),
    );

    if (missing.length > 0) {
      throw new MissingSecretsError(missing);
    }

    if (!target.into) {
      throw new NowhereToKeepSecretsError();
    }

    const current = await this.pending.fileAt(target.into, SECRETS_VAULT);
    const sealed = await this.vault.sealedWith(
      target.team.id,
      current ? SealedVault.of(current.text) : null,
      VaultSecrets.of(given),
    );

    return ConfigurationFile.of(SECRETS_VAULT, sealed.text);
  }
}

const titleFor = (written: number, taken: number): string => {
  if (written === 0) {
    return 'Stop listening to integrations this team no longer uses';
  }

  return taken === 0
    ? 'Listen to the integrations this team uses'
    : 'Change the integrations this team listens to';
};

const BODY = `These are the integrations this team said it uses, written down.

Each file says which of that integration's events become words a station can
wait for. Point each integration at the delivery address shown when this pull request was
opened. The secrets they read are encrypted into ${SECRETS_VAULT} with the
vault key, which owners and admins can reveal on the team's Secrets settings
page. Decrypt it anywhere with: age -d ${SECRETS_VAULT}

The rules here are what each integration's own documentation describes. If one of
them never fires, this file is where to fix it.`;
