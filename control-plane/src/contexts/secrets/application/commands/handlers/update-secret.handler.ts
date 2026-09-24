import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import type { SecretDefinitionsPort } from '@secrets/application/ports/secret-definitions.port';
import { SecretProblems } from '@secrets/application/rendering/secret-problems';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretMovedOnError } from '@secrets/domain/exceptions/secret-moved-on.error';
import { SecretNameFixedError } from '@secrets/domain/exceptions/secret-name-fixed.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import {
  FORBIDDEN,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateSecretHandler
  implements CommandHandlerPort<UpdateSecretCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: SecretDefinitionsPort,
    private readonly secrets: SecretRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateSecretCommand): Promise<ResourceUpdated | null> {
    const id = SecretId.of(command.secretId);

    try {
      const standing = await this.secrets.withId(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesSecrets) {
        return FORBIDDEN;
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.definitions.secret(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const redefined = standing.redefinedAs(
        compiled,
        Attribution.of(command.actor, standing.workspaceId),
        this.clock.now(),
      );

      await this.transaction.run(() => this.secrets.save(redefined));

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof SecretMovedOnError) {
        const current = await this.secrets.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof InvalidSecretError) {
        return {
          outcome: 'invalid',
          problems: [SecretProblems.invalid(error)],
        };
      }

      if (error instanceof SecretNameFixedError) {
        return {
          outcome: 'invalid',
          problems: [SecretProblems.nameFixed(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
