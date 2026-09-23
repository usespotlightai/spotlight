import type { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import { integrationPath } from '@configuration/application/contracts/configuration-layout.contract';
import type { ProposeConfigurationChange } from '@configuration/application/services/propose-configuration-change.service';
import type { OpenedPullRequestDto } from '@github/application/ports/pull-request.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { StarterIntegrationsPort } from '@work/application/ports/starter-integrations.port';

export class ChooseIntegrationsHandler
  implements
    CommandHandlerPort<ChooseIntegrationsCommand, OpenedPullRequestDto | null>
{
  constructor(
    private readonly proposals: ProposeConfigurationChange,
    private readonly starters: StarterIntegrationsPort,
  ) {}

  async execute(
    command: ChooseIntegrationsCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      const chosen = command.sources.flatMap((source) => {
        const file = this.starters.fileFor(source);
        return file
          ? [ConfigurationFile.of(integrationPath(source), file)]
          : [];
      });
      const dropped = command.dropped.map((each) => integrationPath(each));

      return await this.proposals.propose({
        teamId: command.teamId,
        viewerId: command.viewerId,
        title: titleFor(chosen.length, dropped.length),
        body: BODY,
        files: chosen,
        removes: dropped,
      });
    } catch (error) {
      rethrowAsFault(error);
    }
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
opened.

The rules here are what each integration's own documentation describes. If one of
them never fires, this file is where to fix it.`;
