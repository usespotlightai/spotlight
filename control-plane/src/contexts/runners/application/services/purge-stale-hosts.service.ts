import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';

const ATTEMPTS = 3;

export class PurgeStaleHosts {
  constructor(
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async deleteHostsOf(id: PoolId | RunnerTrustId): Promise<void> {
    const source = CredentialSource.ofId(id);

    for (const host of await this.hosts.servingThrough(source)) {
      await this.removedWhile(host, (current) => current.hasSource(source));
    }
  }

  async purgeStale(): Promise<number> {
    const now = this.clock.now();
    let purged = 0;

    for (const host of await this.hosts.silentSince(
      RunnerHost.staleBefore(now),
    )) {
      if (await this.removedWhile(host, (current) => current.isStaleAt(now))) {
        purged++;
      }
    }

    return purged;
  }

  private async removedWhile(
    candidate: RunnerHost,
    removable: (host: RunnerHost) => boolean,
  ): Promise<boolean> {
    let host: RunnerHost | null = candidate;

    for (let attempt = 1; host && removable(host); attempt++) {
      try {
        await this.hosts.remove(host);
        return true;
      } catch (error) {
        if (
          !(error instanceof RunnerHostVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }

      host = await this.hosts.find(candidate.id);
    }

    return false;
  }
}
