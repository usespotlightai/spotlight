import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { UpdateLineCommand } from '@work/application/commands/update-line.command';
import type { LineCompilerPort } from '@work/application/ports/line-compiler.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { lineRefusal } from '@work/application/services/line-refusals';
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
      const standing = await this.lines.find(id);
      const permissions = standing
        ? await this.access.permissionsOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      standing.assertVersion(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const refused = await this.catalog.refusedIn(
        standing.workspaceId,
        compiled.line,
      );

      if (refused.length > 0) {
        return { outcome: 'invalid', problems: refused };
      }

      try {
        await this.transaction.inTransaction(() =>
          this.applying.reconcile(
            standing,
            compiled.line,
            Attribution.of(command.actor, standing.workspaceId),
          ),
        );
      } catch (error) {
        const refused = lineRefusal(standing.key.value, error);

        if (refused) {
          return refused;
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
