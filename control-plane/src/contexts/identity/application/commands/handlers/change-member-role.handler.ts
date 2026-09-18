import type { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ChangeMemberRoleHandler
  implements CommandHandlerPort<ChangeMemberRoleCommand, boolean>
{
  constructor(private readonly workspaces: WorkspaceRepository) {}

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

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
