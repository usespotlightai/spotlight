import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateLineCommand } from '@lines/application/commands/update-line.command';
import type { LineCompilerPort } from '@lines/application/ports/line-compiler.port';
import type { ApplyLines } from '@lines/application/services/apply-lines.service';
import type { CatalogDenials } from '@lines/application/services/catalog-denials.service';
import { lineRejection } from '@lines/application/services/line-rejections';
import { LineVersionConflictError } from '@lines/domain/exceptions/line-version-conflict.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export class UpdateLineHandler
  implements CommandHandlerPort<UpdateLineCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: LineCompilerPort,
    private readonly lines: LineRepository,
    private readonly applying: ApplyLines,
    private readonly transaction: TransactionPort,
    private readonly catalog: CatalogDenials,
  ) {}

  async execute(command: UpdateLineCommand): Promise<ResourceUpdated | null> {
    const id = LineId.of(command.lineId);

    try {
      const existing = await this.lines.find(id);
      const permissions = existing
        ? await this.access.permissionsInWorkspaceOfTeam(
            existing.teamId,
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
