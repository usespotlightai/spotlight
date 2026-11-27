import {
  aPlatformPool,
  aPullPool,
  aPushPool,
  aTrust,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { HostOutages } from '@runners/domain/services/host-outages';
import {
  aNamedHost,
  MINUTE,
  minutesAfter,
} from '@runners/domain/services/host-outages.fake-spec';
import type { WorkspaceRunnerFacts } from '@runners/domain/services/workspace-readiness';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { describe, expect, it } from 'vitest';

const facts = (
  over: Partial<WorkspaceRunnerFacts> = {},
): WorkspaceRunnerFacts => ({
  pools: [aPullPool()],
  hosts: [],
  platform: { poolSet: true, egressSet: true },
  now: minutesAfter(0),
  ...over,
});

const offlineOf = (over: Partial<WorkspaceRunnerFacts>) =>
  HostOutages.ofHarnesses(facts(over)).map((each) => ({
    harness: each.harness.value,
    hosts: each.hosts.map((host) => host.report.name),
    since: each.since,
  }));

describe('HostOutages.ofHarnesses', () => {
  it('names no harness while its only host reports in, and names it once the host goes quiet', () => {
    const hosts = [aNamedHost('dev-host')];

    expect(offlineOf({ hosts, now: minutesAfter(1) })).toEqual([]);
    expect(offlineOf({ hosts, now: minutesAfter(30) })).toEqual([
      { harness: 'claude-code', hosts: ['dev-host'], since: minutesAfter(0) },
    ]);
  });

  it('names no harness that one online host still runs, while another host of it is offline', () => {
    expect(
      offlineOf({
        hosts: [aNamedHost('dev-host'), aNamedHost('ci-host', { lastAt: 29 })],
        now: minutesAfter(30),
      }),
    ).toEqual([]);
  });

  it('names only the harnesses that no online host runs', () => {
    expect(
      offlineOf({
        hosts: [
          aNamedHost('dev-host', { harnesses: ['claude-code', 'codex'] }),
          aNamedHost('ci-host', { lastAt: 29, harnesses: ['codex'] }),
        ],
        now: minutesAfter(30),
      }),
    ).toEqual([
      { harness: 'claude-code', hosts: ['dev-host'], since: minutesAfter(0) },
    ]);
  });

  it('dates an outage of several hosts from the last one Spotlight heard from', () => {
    expect(
      offlineOf({
        hosts: [aNamedHost('dev-host'), aNamedHost('ci-host', { lastAt: 10 })],
        now: minutesAfter(30),
      }),
    ).toEqual([
      {
        harness: 'claude-code',
        hosts: ['dev-host', 'ci-host'],
        since: minutesAfter(10),
      },
    ]);
  });

  it('names nothing while a push pool of the workspace provisions runners, but the platform pool does not count', () => {
    const hosts = [aNamedHost('dev-host')];
    const now = minutesAfter(30);

    expect(
      offlineOf({ hosts, now, pools: [aPullPool(), aPushPool()] }),
    ).toEqual([]);
    expect(
      offlineOf({ hosts, now, pools: [aPullPool(), aPlatformPool()] }),
    ).toHaveLength(1);
  });

  it('forgets a host that has been quiet for a day', () => {
    expect(
      offlineOf({
        hosts: [aNamedHost('dev-host')],
        now: minutesAfter(24 * 60),
      }),
    ).toEqual([]);
  });
});

describe('HostOutages.ofSources', () => {
  const other = aPullPool({ id: PoolId.of('pool_2') });

  it('finds each pool or trust whose hosts are all offline, and none whose host is online', () => {
    const trust = aTrust();
    const outages = HostOutages.ofSources(
      [
        aNamedHost('dev-host'),
        aNamedHost('ci-host', { through: other, lastAt: 29 }),
        aNamedHost('gh-host', { through: trust }),
      ],
      minutesAfter(30),
    );

    expect(
      outages.map((each) => [
        each.source,
        each.hosts.map((host) => host.report.name),
      ]),
    ).toEqual([
      [CredentialSource.ofId(POOL_ID), ['dev-host']],
      [CredentialSource.ofId(trust.id), ['gh-host']],
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

describe('HostOutages.tellsAPerson', () => {
  const outage = { hosts: [aNamedHost('dev-host')], since: minutesAfter(0) };

  it('tells a person at once while work waits', () => {
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
