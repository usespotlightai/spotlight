import type { ChangeMemberRoleCommand } from '@application/commands/change-member-role.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ChangeMemberRoleHandler
  implements CommandHandlerPort<ChangeMemberRoleCommand, boolean>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: ChangeMemberRoleCommand): Promise<boolean> {
    try {
      const role = WorkspaceRole.of(command.role);
      const by = UserId.of(command.viewerId);
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(command.slug),
      );

      if (!workspace?.holds(by)) {
        return false;
      }

      const changed = workspace.roleChangedTo(
        UserId.of(command.userId),
        role,
        by,
      );

      await this.workspaces.save(changed);
      await this.events.dispatch(changed.pullEvents());

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
