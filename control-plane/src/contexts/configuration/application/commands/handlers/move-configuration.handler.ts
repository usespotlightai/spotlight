import type { MoveConfigurationCommand } from '@configuration/application/commands/move-configuration.command';
import type { ConfigurationMoveDto } from '@configuration/application/dto/configuration.dto';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import type { RepositoryProvisioning } from '@configuration/application/services/repository-provisioning.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { NoRepositoryConnectionError } from '@configuration/domain/exceptions/no-repository-connection.error';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { moveConfiguration } from '@configuration/domain/services/configuration-move';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
    private readonly teams: TeamsPort,
    private readonly homes: ConfigurationHomeRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly target: ConfigurationTarget,
    private readonly provisioning: RepositoryProvisioning,
    private readonly held: HeldConfiguration,
    private readonly writing: WriteConfiguration,
  ) {}

  async execute(
    command: MoveConfigurationCommand,
  ): Promise<ConfigurationMoveDto | null> {
    try {
      const team = await this.teams.viewedBy(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!team?.administers) {
        return null;
      }

      const destination = Repository.of(command.repository);
      const target = this.target.at(team, destination);

      if (!target) {
        throw new NoRepositoryConnectionError();
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
        home:
          (await this.homes.find(team.teamId)) ??
          ConfigurationHome.unpinned(team.workspaceId, team.teamId),
        current: await this.configurations.findFor(team.teamId),
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

      await this.homes.save(move.home);

      return moved;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
