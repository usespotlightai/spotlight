import type { SuspendMemberCommand } from '@identity/application/commands/suspend-member.command';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class SuspendMemberHandler implements CommandHandlerPort<
  SuspendMemberCommand,
  boolean
> {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: SuspendMemberCommand): Promise<boolean> {
    try {
      const by = UserId.of(command.viewerId);
      const target = UserId.of(command.userId);
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(command.slug),
      );

      if (workspace?.hasMember(by) !== true) {
        return false;
      }

      const changed = workspace.suspend(target, by, this.clock.now());

      if (changed !== workspace) {
        await this.workspaces.save(changed);
        this.logger.info(
          {
            workspaceId: workspace.id.value,
            userId: target.value,
            by: by.value,
          },
          'member.suspended',
        );
      }

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
