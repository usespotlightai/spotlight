import type { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import {
  integrationPath,
  SECRETS_VAULT,
} from '@configuration/application/contracts/configuration-layout.contract';
import type { PendingConfiguration } from '@configuration/application/services/pending-configuration.service';
import type {
  ProposalTarget,
  ProposeConfigurationChange,
} from '@configuration/application/services/propose-configuration-change.service';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { NowhereToKeepSecretsError } from '@configuration/domain/exceptions/nowhere-to-keep-secrets.error';
import { secretsToSeal } from '@configuration/domain/services/secret-sealing-policy';
import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { distinct } from '@shared-kernel/domain/services/distinct';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { StarterIntegrationsPort } from '@work/application/ports/starter-integrations.port';

export class ChooseIntegrationsHandler
  implements
    CommandHandlerPort<ChooseIntegrationsCommand, OpenedPullRequestDto | null>
{
  constructor(
    private readonly proposals: ProposeConfigurationChange,
    private readonly starters: StarterIntegrationsPort,
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
        chosen.flatMap((each) => this.starters.secretsFor(each.source)),
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
    const given = secretsToSeal({
      administers: target.team.administers,
      needed,
      offered: command.secrets,
    });

    if (!target.into) {
      throw new NowhereToKeepSecretsError();
    }

    const current = await this.pending.fileAt(target.into, SECRETS_VAULT);
    const sealed = await this.vault.sealedWith(
      target.team.teamId,
      current ? SealedVault.of(current.text) : null,
      given,
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
