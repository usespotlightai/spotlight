import type {
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';

export class HostAdmission {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly hosts: RunnerHostRepository,
  ) {}

  async admit(credential: HostCredentials, hostId: string): Promise<boolean> {
    const authenticated = await this.authenticator.authenticate(credential);

    if (!authenticated) {
      return false;
    }

    const host = await this.hosts.find(HostId.of(hostId));

    return (
      host?.workspaceId.equals(authenticated.workspaceId) === true &&
      host.hasSource(
        CredentialSource.of(authenticated.source.kind, authenticated.source.id),
      )
    );
  }
}
