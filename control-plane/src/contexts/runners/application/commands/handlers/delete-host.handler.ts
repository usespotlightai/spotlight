import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteHostCommand } from '@runners/application/commands/host.commands';
import type { HostDeletedDto } from '@runners/application/dto/host-heartbeat.dto';
import { deregisterHost } from '@runners/application/services/runner-host-revisions';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class DeleteHostHandler
  implements CommandHandlerPort<DeleteHostCommand, HostDeletedDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly hosts: RunnerHostRepository,
  ) {}

  async execute(command: DeleteHostCommand): Promise<HostDeletedDto | null> {
    try {
      const id = HostId.of(command.hostId);
      const known = await this.hosts.find(id);
      const permissions = known
        ? await this.access.permissionsIn(known.workspaceId, command.principal)
        : null;

      if (!known || !permissions || permissions.slug !== command.slug) {
        return null;
      }

      if (!permissions.managesRunners) {
        return forbiddenTo('runners');
      }

      await deregisterHost(this.hosts, id, (current) =>
        current.workspaceId.equals(known.workspaceId),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
