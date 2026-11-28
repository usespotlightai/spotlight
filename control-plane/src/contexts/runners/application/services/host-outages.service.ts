import type {
  HostOutageSource,
  HostOutagesPort,
} from '@runners/application/ports/host-outages.port';
import type { HostOutageRepository } from '@runners/domain/repositories/host-outage.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';

export class HostOutageLookup implements HostOutagesPort {
  constructor(private readonly outages: HostOutageRepository) {}

  async openOutageOf(source: HostOutageSource): Promise<string | null> {
    return (
      (await this.outages.ofSource(CredentialSource.of(source.kind, source.id)))
        ?.id.value ?? null
    );
  }
}
