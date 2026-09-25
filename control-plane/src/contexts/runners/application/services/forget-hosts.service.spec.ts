import { ForgetHosts } from '@runners/application/services/forget-hosts.service';
import {
  aHost,
  aPullPool,
  aTrust,
  heldHosts,
  POOL_ID,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it } from 'vitest';

const THROUGH_POOL = HostId.of('HOST0000000000000001');

const THROUGH_TRUST = HostId.of('HOST0000000000000002');

const NOW = new Date('2026-09-26T10:00:00.000Z');

const forgetting = () => {
  const { held, hosts } = heldHosts(
    aHost({ id: THROUGH_POOL, through: aPullPool() }),
    aHost({ id: THROUGH_TRUST, through: aTrust() }),
  );

  return {
    held,
    hosts,
    forget: new ForgetHosts(hosts, { now: () => NOW } as ClockPort),
  };
};

describe('ForgetHosts', () => {
  it('forgets the hosts serving through a pool, and only those', async () => {
    const { held, hosts, forget } = forgetting();

    await forget.servingThrough(POOL_ID);

    expect(hosts.removeThrough).toHaveBeenCalledWith(
      Admission.through(POOL_ID),
    );
    expect([...held.keys()]).toEqual([THROUGH_TRUST.value]);
  });

  it('forgets the hosts serving through a trust, and only those', async () => {
    const { held, forget } = forgetting();

    await forget.servingThrough(TRUST_ID);

    expect([...held.keys()]).toEqual([THROUGH_POOL.value]);
  });

  it('forgets only the hosts nothing has heard from for a day', async () => {
    const { held, hosts } = heldHosts(
      aHost({ id: THROUGH_POOL, at: new Date(NOW.getTime() - 25 * 3_600_000) }),
      aHost({ id: THROUGH_TRUST, at: new Date(NOW.getTime() - 60_000) }),
    );

    await expect(
      new ForgetHosts(hosts, { now: () => NOW } as ClockPort).unheard(),
    ).resolves.toBe(1);
    expect([...held.keys()]).toEqual([THROUGH_TRUST.value]);
  });
});
