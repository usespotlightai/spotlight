import type { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import type { SetSecretCommand } from '@application/commands/set-secret.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SecretValue } from '@domain/value-objects/secret-value.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Sets what a workspace's configuration may name but must not hold.
 *
 * Only an owner or an admin: a secret is what stands in for a session at a
 * door anybody can knock at, so who may set one is who may connect a host.
 * True where it was set, and nothing more. No answer here carries a secret in
 * any direction but inward.
 */
export class SetSecretHandler
  implements CommandHandlerPort<SetSecretCommand, boolean>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly secrets: TeamSecretsPort,
  ) {}

  async execute(command: SetSecretCommand): Promise<boolean> {
    try {
      if (
        !(await this.authorization.connectableBy(
          command.teamId,
          command.viewerId,
        ))
      ) {
        return false;
      }

      // Empty is not a secret. Forgetting one is its own thing to ask for.
      const value = SecretValue.maybe(command.value);

      if (!value) {
        return false;
      }

      await this.secrets.set(
        TeamId.of(command.teamId),
        SecretName.of(command.name),
        value,
      );

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class ForgetSecretHandler
  implements CommandHandlerPort<ForgetSecretCommand, boolean>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly secrets: TeamSecretsPort,
  ) {}

  async execute(command: ForgetSecretCommand): Promise<boolean> {
    try {
      if (
        !(await this.authorization.connectableBy(
          command.teamId,
          command.viewerId,
        ))
      ) {
        return false;
      }

      await this.secrets.forget(
        TeamId.of(command.teamId),
        SecretName.of(command.name),
      );

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
