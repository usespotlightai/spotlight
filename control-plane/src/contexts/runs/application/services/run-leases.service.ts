import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';

export class RunLeases {
  readonly name = 'Expiring run leases';

  constructor(private readonly runs: RunRepository) {}

  async expireLeases(now: Date): Promise<readonly Run[]> {
    const expired: Run[] = [];

    for (const expiring of await this.runs.expiredLeases(now)) {
      if (!expiring.leaseExpired(now)) {
        continue;
      }

      const next = expiring.expireLease(now);

      if (await this.saved(next)) {
        expired.push(next);
      }
    }

    return expired;
  }

  private async saved(run: Run): Promise<boolean> {
    try {
      await this.runs.save(run);
      return true;
    } catch (error) {
      if (error instanceof RunVersionConflictError) {
        return false;
      }
      throw error;
    }
  }
}
