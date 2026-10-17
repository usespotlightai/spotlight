import { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import type { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import { Redeemer } from '@secrets/domain/value-objects/redeemer.vo';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import {
  InMemoryGrants,
  NOW,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const LEASE = RunLease.of(RunId.of('run_1'), 1);
const RUN = { lease: LEASE, workspaceId: WORKSPACE };

class Contended extends InMemoryGrants {
  constructor(private conflicts: number) {
    super();
  }

  override async save(grants: RunGrants): Promise<void> {
    if (this.conflicts > 0) {
      this.conflicts -= 1;
      throw new RunGrantsVersionConflictError(grants.runId.value);
    }

    await super.save(grants);
  }
}

const pinning = (current: RunGrants) =>
  current.redeemFor(
    LEASE,
    Redeemer.beside(RedemptionRecipient.of('recipient-key')),
  );

describe('RunGrantsKept', () => {
  it('reads the grants again and retries when another change landed first', async () => {
    const grants = new Contended(2);

    await new RunGrantsKept(grants).changed(RUN, pinning);

    expect(grants.of('run_1')?.recipient?.key).toBe('recipient-key');
  });

  it('gives up once the grants keep moving on', async () => {
    await expect(
      new RunGrantsKept(new Contended(3)).changed(RUN, pinning),
    ).rejects.toThrow(RunGrantsVersionConflictError);
  });

  it('writes nothing when the change leaves the grants as they were', async () => {
    const grants = new InMemoryGrants();

    await new RunGrantsKept(grants).changed(RUN, (current) =>
      current.grant(LEASE, []),
    );

    expect(grants.of('run_1')).toBeNull();
  });

  it('ends nothing for a run that was never granted anything', async () => {
    const grants = new InMemoryGrants();

    await new RunGrantsKept(grants).changedIfExists(LEASE.runId, (current) =>
      current.end(NOW),
    );

    expect(grants.of('run_1')).toBeNull();
  });

  it('settles a change once, saying whether it landed', async () => {
    const grants = new Contended(1);
    const kept = new RunGrantsKept(grants);

    await kept.changed(RUN, pinning);

    const current = (await grants.find(LEASE.runId)) as RunGrants;

    expect(await kept.settled(current, current.end(NOW))).toBe(true);
    expect(await kept.settled(current, current.loseLease(LEASE))).toBe(false);
    expect(await kept.settled(current, current)).toBe(false);
  });
});
