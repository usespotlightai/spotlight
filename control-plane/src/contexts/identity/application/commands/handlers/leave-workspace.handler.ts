import type { LeaveWorkspaceCommand } from '@identity/application/commands/leave-workspace.command';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class LeaveWorkspaceHandler implements CommandHandlerPort<
  LeaveWorkspaceCommand,
  boolean
> {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: LeaveWorkspaceCommand): Promise<boolean> {
    try {
      const by = UserId.of(command.viewerId);
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(command.slug),
      );

      if (!workspace?.hasMember(by)) {
        return false;
      }

      await this.workspaces.save(workspace.leave(by, this.clock.now()));
      this.logger.info(
        { workspaceId: workspace.id.value, userId: by.value, by: by.value },
        'member.left',
      );

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
