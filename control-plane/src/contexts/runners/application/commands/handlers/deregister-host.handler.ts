import type { DeregisterHostCommand } from '@runners/application/commands/host.commands';
import type { HostDeregisteredDto } from '@runners/application/dto/host-heartbeat.dto';
import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import { deregisterHost } from '@runners/application/services/runner-host-revisions';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class DeregisterHostHandler
  implements CommandHandlerPort<DeregisterHostCommand, HostDeregisteredDto>
{
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly hosts: RunnerHostRepository,
  ) {}

  async execute(command: DeregisterHostCommand): Promise<HostDeregisteredDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const source = CredentialSource.of(
        authenticated.source.kind,
        authenticated.source.id,
      );

      await deregisterHost(this.hosts, HostId.of(command.hostId), (known) =>
        known.hasSource(source),
      );

      return { outcome: 'deregistered' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
