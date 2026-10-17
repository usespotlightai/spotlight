import type { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@identity/domain/services/workspace-registration';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateWorkspaceHandler
  implements CommandHandlerPort<CreateWorkspaceCommand, ResourceCreated | null>
{
  private readonly registration: WorkspaceRegistration;

  constructor(
    private readonly definitions: IdentityDefinitionsPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {
    this.registration = new WorkspaceRegistration(workspaces);
  }

  async execute(
    command: CreateWorkspaceCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const { principal } = command.actor;

      if (!Permissions.beyondWorkspaces(principal).createsWorkspaces) {
        return forbiddenTo('create-workspaces');
      }

      const compiled = this.definitions.workspace(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: { workspace: 'create', definition: command.definition },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const id = WorkspaceId.of(this.ids.generate());
            const created = await this.registration.register({
              id,
              name: compiled.name,
              slug: compiled.slug,
              owner: principal.userId,
              by: Attribution.of(command.actor, id),
            });

            await this.workspaces.add(created);

            return created.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof WorkspaceSlugTakenError) {
          return { outcome: 'taken', address: compiled.slug.value };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
