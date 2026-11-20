import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SetSecretValueCommand } from '@secrets/application/commands/set-secret-value.command';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { isReservedSecretName } from '@secrets/domain/value-objects/reserved-secret-name';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  type Forbidden,
  forbiddenTo,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export type SecretValueSet = { readonly outcome: 'set' } | Forbidden | null;

export class SetSecretValueHandler implements CommandHandlerPort<
  SetSecretValueCommand,
  SecretValueSet
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly secrets: SecretRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: SetSecretValueCommand): Promise<SecretValueSet> {
    try {
      const permissions = await this.access.permissionsInSlug(
        command.slug,
        command.actor.principal,
      );
      const name = SecretName.of(command.name);
      const existing =
        permissions && !isReservedSecretName(name.value)
          ? await this.secrets.named(permissions.workspaceId, name)
          : null;

      if (!permissions || !existing) {
        return null;
      }

      if (!permissions.scopes.has('secrets')) {
        return forbiddenTo('secrets');
      }

      const set = existing.setValue(
        SecretValue.of(command.value, 'value'),
        ChangeActor.of(command.actor, existing.workspaceId),
        this.clock.now(),
      );

      await this.transaction.inTransaction(() => this.secrets.save(set));

      return { outcome: 'set' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
