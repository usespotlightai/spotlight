import { RunGrantsKept } from '@secrets/application/services/run-grants-kept';
import type { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunGrantsMovedOnError } from '@secrets/domain/exceptions/run-grants-moved-on.error';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import {
  InMemoryGrants,
  NOW,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const HOLD = RunHold.of(RunId.of('run_1'), 1);
const RUN = { hold: HOLD, workspaceId: WORKSPACE };

class Contended extends InMemoryGrants {
  constructor(private movedOn: number) {
    super();
  }

  override async save(grants: RunGrants): Promise<void> {
    if (this.movedOn > 0) {
      this.movedOn -= 1;
      throw new RunGrantsMovedOnError(grants.runId.value);
    }

    await super.save(grants);
  }
}

const pinning = (held: RunGrants) =>
  held.redeemedFor(HOLD, RedemptionRecipient.of('recipient-key'));

describe('RunGrantsKept', () => {
  it('reads the grants again and retries when another change landed first', async () => {
    const grants = new Contended(2);

    await new RunGrantsKept(grants).changed(RUN, pinning);

    expect(grants.of('run_1')?.recipient?.key).toBe('recipient-key');
  });

  it('gives up once the grants keep moving on', async () => {
    await expect(
      new RunGrantsKept(new Contended(3)).changed(RUN, pinning),
    ).rejects.toThrow(RunGrantsMovedOnError);
  });

  it('writes nothing when the change leaves the grants as they were', async () => {
    const grants = new InMemoryGrants();

    await new RunGrantsKept(grants).changed(RUN, (held) =>
      held.granted(HOLD, []),
    );

    expect(grants.of('run_1')).toBeNull();
  });

  it('ends nothing for a run that was never granted anything', async () => {
    const grants = new InMemoryGrants();

    await new RunGrantsKept(grants).changedIfHeld(HOLD.runId, (held) =>
      held.ended(NOW),
    );

    expect(grants.of('run_1')).toBeNull();
  });

  it('settles a change once, saying whether it landed', async () => {
    const grants = new Contended(1);
    const kept = new RunGrantsKept(grants);

    await kept.changed(RUN, pinning);

    const held = (await grants.find(HOLD.runId)) as RunGrants;

    expect(await kept.settled(held, held.ended(NOW))).toBe(true);
    expect(await kept.settled(held, held.lostHold(HOLD))).toBe(false);
    expect(await kept.settled(held, held)).toBe(false);
  });
});
