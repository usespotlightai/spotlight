import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { CreateLineCommand } from '@work/application/commands/create-line.command';
import type { LineCompilerPort } from '@work/application/ports/line-compiler.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { lineRejection } from '@work/application/services/line-rejections';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import { LineAlreadyExistsError } from '@work/domain/exceptions/line-already-exists.error';

export class CreateLineHandler
  implements CommandHandlerPort<CreateLineCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: LineCompilerPort,
    private readonly applying: ApplyLines,
    private readonly creates: IdempotentCreatesPort,
    private readonly transaction: TransactionPort,
    private readonly catalog: StationCatalog,
  ) {}

  async execute(command: CreateLineCommand): Promise<ResourceCreated | null> {
    try {
      const permissions = await this.access.permissionsOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      const team = await this.teams.find(permissions.teamId);

      if (!team) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const denied = await this.catalog.deniedIn(
        team.workspaceId,
        compiled.line,
      );

      if (denied.length > 0) {
        return { outcome: 'invalid', problems: denied };
      }

      const key = compiled.line.key.value;
      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          line: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(
            this.creates,
            create,
            async () =>
              (
                await this.applying.create(
                  team,
                  compiled.line,
                  Attribution.of(command.actor, team.workspaceId),
                )
              ).id.value,
          ),
        );
      } catch (error) {
        if (error instanceof LineAlreadyExistsError) {
          return {
            outcome: 'taken',
            address: TeamAddress.of(team.key, key).toString(),
          };
        }

        const rejected = lineRejection(key, error);

        if (rejected?.outcome === 'invalid') {
          return rejected;
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
