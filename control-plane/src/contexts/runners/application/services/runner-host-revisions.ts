import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerHostMovedOnError } from '@runners/domain/exceptions/runner-host-moved-on.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';

const ATTEMPTS = 3;

export const reviseHost = async (
  hosts: RunnerHostRepository,
  id: HostId,
  change: (known: RunnerHost | null) => RunnerHost,
): Promise<RunnerHost> => {
  for (let attempt = 1; ; attempt++) {
    const known = await hosts.find(id);
    const changed = change(known);

    try {
      await (known ? hosts.save(changed) : hosts.add(changed));
      return changed;
    } catch (error) {
      if (!(error instanceof RunnerHostMovedOnError) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
};
