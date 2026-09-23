import type { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@identity/domain/services/workspace-registration';
import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateWorkspaceHandler
  implements CommandHandlerPort<CreateWorkspaceCommand, ResourceCreated>
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

  async execute(command: CreateWorkspaceCommand): Promise<ResourceCreated> {
    try {
      const compiled = this.definitions.workspace(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: command.requesterId,
        key: IdempotencyKey.of(command.idempotencyKey),
        request: { workspace: 'create', definition: command.definition },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const opened = await this.registration.register({
              id: WorkspaceId.of(this.ids.generate()),
              name: compiled.name,
              slug: compiled.slug,
              owner: UserId.of(command.requesterId),
            });

            await this.workspaces.add(opened);

            return opened.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof WorkspaceSlugTakenError) {
          return { outcome: 'taken', address: compiled.slug.value };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
