import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateLineCommand } from '@lines/application/commands/create-line.command';
import type { LineCompilerPort } from '@lines/application/ports/line-compiler.port';
import type { ApplyLines } from '@lines/application/services/apply-lines.service';
import type { CatalogDenials } from '@lines/application/services/catalog-denials.service';
import { lineRejection } from '@lines/application/services/line-rejections';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
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
import { createIdempotently } from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class CreateLineHandler implements CommandHandlerPort<
  CreateLineCommand,
  ResourceCreated | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: LineCompilerPort,
    private readonly applying: ApplyLines,
    private readonly creates: IdempotentCreatesPort,
    private readonly transaction: TransactionPort,
    private readonly catalog: CatalogDenials,
  ) {}

  async execute(command: CreateLineCommand): Promise<ResourceCreated | null> {
    try {
      const permissions = await this.access.permissionsInWorkspaceOfTeam(
        TeamId.of(command.teamId),
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
          createIdempotently(
            this.creates,
            create,
            async () =>
              (
                await this.applying.create(
                  team,
                  compiled.line,
                  ChangeActor.of(command.actor, team.workspaceId),
                )
              ).id.value,
          ),
        );
      } catch (error) {
        if (error instanceof LineAlreadyExistsError) {
          return {
            outcome: 'already-exists',
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
