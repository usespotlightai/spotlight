import type { MoveConfigurationCommand } from '@application/commands/move-configuration.command';
import type { ConfigurationMoveDto } from '@application/dto/configuration.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { HeldConfiguration } from '@application/services/held-configuration.service';
import type { RepositoryProvisioning } from '@application/services/repository-provisioning.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import { NoGitHubInstallationError } from '@domain/exceptions/no-github-installation.error';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { moveConfiguration } from '@domain/services/configuration-move';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

const TITLE = 'Move Spotlight configuration here';

const BODY = `This pull request carries your team's current Spotlight
configuration into this repository — its lines, the harness that works each one,
the repositories they work in, and the integrations it listens to.

Spotlight goes on reading the repository it reads today until this merges.
Merging is what makes this the place it reads from.`;

export class MoveConfigurationHandler
  implements
    CommandHandlerPort<MoveConfigurationCommand, ConfigurationMoveDto | null>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly teams: TeamRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly target: ConfigurationTarget,
    private readonly provisioning: RepositoryProvisioning,
    private readonly held: HeldConfiguration,
    private readonly writing: WriteConfiguration,
    private readonly settling: SettleSetup,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(
    command: MoveConfigurationCommand,
  ): Promise<ConfigurationMoveDto | null> {
    try {
      const workspace = await this.authorization.connectableBy(
        command.teamId,
        command.viewerId,
      );

      if (!workspace) {
        return null;
      }

      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team) {
        return null;
      }

      const destination = Repository.of(command.repository);
      const target = this.target.at(workspace, destination);

      if (!target) {
        throw new NoGitHubInstallationError();
      }

      if ((await this.provisioning.ensure(target)) === 'refused') {
        throw new UpstreamRefusedError(
          `Making ${destination.value}`,
          'GitHub would not create it',
        );
      }

      const holding = await this.held.at(target);

      if (!holding) {
        throw new UpstreamRefusedError(
          `Reading ${destination.value}`,
          'it has no branch to write configuration against',
        );
      }

      const move = moveConfiguration({
        team,
        current: await this.configurations.findFor(team.id),
        destination,
        destinationHolds: holding.files.length > 0,
      });

      const moved: ConfigurationMoveDto =
        move.kind === 'carried'
          ? {
              kind: 'carried',
              pullRequest: await this.writing.writeInto(target, {
                title: TITLE,
                body: BODY,
                files: move.files,
              }),
            }
          : { kind: move.kind };

      await this.teams.save(move.team);
      await this.events.dispatch(move.team.pullEvents());
      await this.settling.forTeam(team.id);

      return moved;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
