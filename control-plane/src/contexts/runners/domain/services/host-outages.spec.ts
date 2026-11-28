import {
  aPullPool,
  aTrust,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { HostOutages } from '@runners/domain/services/host-outages';
import {
  aNamedHost,
  MINUTE,
  minutesAfter,
} from '@runners/domain/services/host-outages.fake-spec';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { describe, expect, it } from 'vitest';

describe('HostOutages.quietOf', () => {
  it('finds the hosts quiet once the only one stops reporting in, and not while it reports in', () => {
    const hosts = [aNamedHost('dev-host')];

    expect(HostOutages.quietOf(hosts, minutesAfter(1))).toBeNull();
    expect(HostOutages.quietOf(hosts, minutesAfter(30))).toEqual({
      hosts: ['dev-host'],
      since: minutesAfter(0),
    });
  });

  it('finds them not quiet while one of several hosts still reports in', () => {
    expect(
      HostOutages.quietOf(
        [aNamedHost('dev-host'), aNamedHost('ci-host', { lastAt: 29 })],
        minutesAfter(30),
      ),
    ).toBeNull();
  });

  it('dates quiet hosts from the last one Spotlight heard from', () => {
    expect(
      HostOutages.quietOf(
        [aNamedHost('dev-host'), aNamedHost('ci-host', { lastAt: 10 })],
        minutesAfter(30),
      ),
    ).toEqual({ hosts: ['dev-host', 'ci-host'], since: minutesAfter(10) });
  });

  it('lets no online host that serves no harness count, and finds a source with no host quiet', () => {
    expect(
      HostOutages.quietOf(
        [
          aNamedHost('dev-host'),
          aNamedHost('bare-host', { lastAt: 30, harnesses: [] }),
        ],
        minutesAfter(30),
      ),
    ).toEqual({ hosts: ['dev-host'], since: minutesAfter(0) });
    expect(HostOutages.quietOf([], minutesAfter(30))).toEqual({
      hosts: [],
      since: null,
    });
  });
});

describe('HostOutages.ofSources', () => {
  const other = aPullPool({ id: PoolId.of('pool_2') });

  it('finds each pool or trust whose hosts are all offline, and none whose host is online', () => {
    const trust = aTrust();

    expect(
      HostOutages.ofSources(
        [
          aNamedHost('dev-host'),
          aNamedHost('ci-host', { through: other, lastAt: 29 }),
          aNamedHost('gh-host', { through: trust }),
        ],
        minutesAfter(30),
      ),
    ).toEqual([
      {
        source: CredentialSource.ofId(POOL_ID),
        hosts: ['dev-host'],
        since: minutesAfter(0),
      },
      {
        source: CredentialSource.ofId(trust.id),
        hosts: ['gh-host'],
        since: minutesAfter(0),
      },
    ]);
  });

  it('finds no outage once a host of the pool reports in again', () => {
    expect(
      HostOutages.ofSources(
        [aNamedHost('dev-host'), aNamedHost('spare-host', { lastAt: 30 })],
        minutesAfter(30),
      ),
    ).toEqual([]);
  });

  it('leaves out the outages that are raised already', () => {
    const outages = HostOutages.ofSources(
      [aNamedHost('dev-host'), aNamedHost('ci-host', { through: other })],
      minutesAfter(30),
    );

    expect(
      HostOutages.unraised(outages, [
        { source: CredentialSource.ofId(POOL_ID) },
      ]).map((each) => each.source),
    ).toEqual([CredentialSource.ofId(other.id)]);
  });
});

describe('HostOutages.hingesOnWaitingWork', () => {
  const outage = {
    source: CredentialSource.ofId(POOL_ID),
    hosts: ['dev-host'],
    since: minutesAfter(0),
  };

  it('asks whether work waits only from two minutes of quiet until five', () => {
    expect(HostOutages.hingesOnWaitingWork(outage, minutesAfter(1))).toBe(
      false,
    );
    expect(HostOutages.hingesOnWaitingWork(outage, minutesAfter(2))).toBe(true);
    expect(HostOutages.hingesOnWaitingWork(outage, minutesAfter(4))).toBe(true);
    expect(HostOutages.hingesOnWaitingWork(outage, minutesAfter(5))).toBe(
      false,
    );
  });
});

describe('HostOutages.tellsAPerson', () => {
  const outage = {
    source: CredentialSource.ofId(POOL_ID),
    hosts: ['dev-host'],
    since: minutesAfter(0),
  };

  it('tells a person after two minutes while work waits that the hosts could take, and not of heartbeats that only run late', () => {
    expect(
      HostOutages.tellsAPerson(outage, {
        workWaits: true,
        now: new Date(minutesAfter(0).getTime() + 1.6 * MINUTE),
      }),
    ).toBe(false);
    expect(
      HostOutages.tellsAPerson(outage, {
        workWaits: true,
        now: new Date(minutesAfter(0).getTime() + 2 * MINUTE),
      }),
    ).toBe(true);
  });

  it('tells a person once the hosts have been offline for five minutes, with no work waiting', () => {
    expect(
      HostOutages.tellsAPerson(outage, {
        workWaits: false,
        now: minutesAfter(4),
      }),
    ).toBe(false);
    expect(
      HostOutages.tellsAPerson(outage, {
        workWaits: false,
        now: minutesAfter(5),
      }),
    ).toBe(true);
  });
});
