import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import type { SecretGrantRepository } from '@secrets/domain/repositories/secret-grant.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunGrants implements RunGrantsPort {
  constructor(private readonly grants: SecretGrantRepository) {}

  endedFor(runId: string): Promise<void> {
    return this.grants.revokeFor(RunId.of(runId));
  }
}
