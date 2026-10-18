import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { UpdateLineCommand } from '@work/application/commands/update-line.command';
import type { LineCompilerPort } from '@work/application/ports/line-compiler.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { lineRejection } from '@work/application/services/line-rejections';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import { LineVersionConflictError } from '@work/domain/exceptions/line-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';

export class UpdateLineHandler
  implements CommandHandlerPort<UpdateLineCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: LineCompilerPort,
    private readonly lines: LineRepository,
    private readonly applying: ApplyLines,
    private readonly transaction: TransactionPort,
    private readonly catalog: StationCatalog,
  ) {}

  async execute(command: UpdateLineCommand): Promise<ResourceUpdated | null> {
    const id = LineId.of(command.lineId);

    try {
      const existing = await this.lines.find(id);
      const permissions = existing
        ? await this.access.permissionsOnTeam(
            existing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const denied = await this.catalog.deniedIn(
        existing.workspaceId,
        compiled.line,
      );

      if (denied.length > 0) {
        return { outcome: 'invalid', problems: denied };
      }

      try {
        await this.transaction.inTransaction(() =>
          this.applying.reconcile(
            existing,
            compiled.line,
            ChangeActor.of(command.actor, existing.workspaceId),
          ),
        );
      } catch (error) {
        const rejected = lineRejection(existing.key.value, error);

        if (rejected) {
          return rejected;
        }

        throw error;
      }

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof LineVersionConflictError) {
        const current = await this.lines.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
