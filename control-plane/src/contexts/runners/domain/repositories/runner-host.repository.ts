import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';

export interface RunnerHostRepository {
  find(id: HostId): Promise<RunnerHost | null>;

  add(host: RunnerHost): Promise<void>;

  save(host: RunnerHost): Promise<void>;

  remove(host: RunnerHost): Promise<void>;

  removeThrough(source: CredentialSource): Promise<void>;

  removeStaleBefore(cutoff: Date): Promise<number>;
}
