import {
  aRunner,
  HOST_ID,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { HostSlotHolders } from '@runners/domain/services/host-slot-holders';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date(STARTED_AT.getTime() + 1_000);

const OTHER_HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCD0';

const working = (id: string, enters?: string, host?: string) =>
  aRunner({ id, enters, host }).claim(RunnerWork.run(`run_${id}`), NOW);

const waiting = (id: string, enters: string) => aRunner({ id, enters });

const idle = (...ids: string[]) => ids.map((each) => SandboxId.of(each));

const holders = (
  alive: readonly Runner[],
  idleOnHost: readonly SandboxId[],
) => {
  const held = HostSlotHolders.on(HOST_ID, alive, idleOnHost, NOW);

  return {
    taken: held.taken,
    runners: held.runners.map((each) => each.id.value),
    idleSandboxes: held.idleSandboxes.map((each) => each.value),
  };
};

describe('HostSlotHolders', () => {
  it('lets a host’s open claim hold no slot', () => {
    expect(holders([aRunner({ id: 'claim' }), working('run')], [])).toEqual({
      taken: 1,
      runners: ['run'],
      idleSandboxes: [],
    });
  });

  it('lets an idle sandbox hold the slot of the runner that waits in it for a run', () => {
    expect(
      holders([waiting('waits', 'sandbox_1')], idle('sandbox_1', 'sandbox_2')),
    ).toEqual({
      taken: 2,
      runners: [],
      idleSandboxes: ['sandbox_1', 'sandbox_2'],
    });
  });

  it('gives an idle sandbox one slot however many runners wait in it', () => {
    expect(
      holders(
        [waiting('old', 'sandbox_1'), waiting('new', 'sandbox_1')],
        idle('sandbox_1'),
      ),
    ).toEqual({ taken: 1, runners: [], idleSandboxes: ['sandbox_1'] });
  });

  it('lets a runner that works in an idle sandbox hold its slot instead of the sandbox', () => {
    expect(
      holders(
        [working('run', 'sandbox_1'), waiting('waits', 'sandbox_1')],
        idle('sandbox_1'),
      ),
    ).toEqual({ taken: 1, runners: ['run'], idleSandboxes: [] });
  });

  it('counts a runner that waits in a sandbox that is not idle', () => {
    expect(holders([waiting('waits', 'sandbox_9')], [])).toEqual({
      taken: 1,
      runners: ['waits'],
      idleSandboxes: [],
    });
  });

  it('gives one holder for each slot taken: one run and five warm sandboxes', () => {
    const warm = ['w1', 'w2', 'w3', 'w4', 'w5'];
    const held = HostSlotHolders.on(
      HOST_ID,
      [
        working('run'),
        aRunner({ id: 'claim' }),
        ...warm.map((each) => waiting(`waits_${each}`, each)),
      ],
      idle(...warm),
      NOW,
    );

    expect(held.taken).toBe(6);
    expect(held.runners.length + held.idleSandboxes.length).toBe(6);
    expect(held.freeIn(6)).toBe(0);
    expect(held.freeIn(8)).toBe(2);
    expect(held.freeIn(4)).toBe(0);
  });

  it('counts only the runners on the host asked for, and hides only its own', () => {
    const elsewhere = working('elsewhere', undefined, OTHER_HOST);
    const claim = aRunner({ id: 'claim' });
    const run = working('run');
    const held = HostSlotHolders.on(HOST_ID, [elsewhere, claim, run], [], NOW);

    expect(held.taken).toBe(1);
    expect(held.hides(claim)).toBe(true);
    expect(held.hides(run)).toBe(false);
    expect(held.hides(elsewhere)).toBe(false);
    expect(held.hides(aRunner({ id: 'unhosted', host: null }))).toBe(false);
  });
});
