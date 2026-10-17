import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import type { SecretDefinitionsPort } from '@secrets/application/ports/secret-definitions.port';
import { SecretProblems } from '@secrets/application/rendering/secret-problems';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
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
      const existing = await this.secrets.withId(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.managesSecrets) {
        return forbiddenTo('manage-secrets');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.secret(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const updated = existing.update(
        compiled,
        Attribution.of(command.actor, existing.workspaceId),
        this.clock.now(),
      );

      await this.transaction.inTransaction(() => this.secrets.save(updated));

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof SecretVersionConflictError) {
        const current = await this.secrets.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof InvalidSecretError) {
        return {
          outcome: 'invalid',
          problems: [SecretProblems.invalid(error)],
        };
      }

      if (error instanceof ImmutableFieldError) {
        return {
          outcome: 'invalid',
          problems: [SecretProblems.immutableField(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
