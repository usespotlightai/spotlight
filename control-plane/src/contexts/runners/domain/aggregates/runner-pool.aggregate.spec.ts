import {
  aPullPool,
  aPushPool,
  hashOf,
  secretOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerPoolDefined } from '@runners/domain/events/runner-pool-defined.event';
import { RunnerPoolRedefined } from '@runners/domain/events/runner-pool-redefined.event';
import { RunnerPoolRetired } from '@runners/domain/events/runner-pool-retired.event';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { RunnerPoolFixedError } from '@runners/domain/exceptions/runner-pool-fixed.error';
import { RunnerPoolMovedOnError } from '@runners/domain/exceptions/runner-pool-moved-on.error';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const BY = attributedIn();

const keeping = (key: string, labels: string[] = ['linux']) => ({
  key: PoolKey.of(key),
  labels: RunnerLabels.of(labels),
  maxRuns: null,
});

const changeOf = (pool: ReturnType<typeof aPullPool>) => {
  const [event] = pool.pullEvents();

  return event instanceof RunnerPoolRedefined ? event.change : null;
};

describe('RunnerPool', () => {
  it('is defined as a change to the workspace’s configuration, naming its mode', () => {
    const [defined] = aPullPool().pullEvents();

    expect(defined).toBeInstanceOf(RunnerPoolDefined);
    expect((defined as RunnerPoolDefined).change.detail?.recorded()).toEqual({
      mode: 'pull',
    });
  });

  it('pulls with a token, or pushes through provision with a secret', () => {
    const pulled = aPullPool();
    const pushed = aPushPool();

    expect(pulled.mode).toBe('pull');
    expect(pulled.tokenHash?.equals(hashOf('a'))).toBe(true);
    expect(pulled.provision).toBeNull();
    expect(pushed.mode).toBe('push');
    expect(pushed.tokenHash).toBeNull();
    expect(pushed.provision?.url.value).toBe(
      'https://provision.example.com/runs',
    );
  });

  it('will not provision without a secret to sign its calls with', () => {
    expect(() =>
      aPullPool().redefinedAs(
        keeping('ephemeral'),
        {
          mode: 'push',
          url: ProvisionUrl.of('https://provision.example.com/runs'),
          secret: null,
          secretVersion: null,
        },
        BY,
      ),
    ).toThrow(RunnerPoolFixedError);
  });

  it('rotates its token in place, keeping its id', () => {
    const pool = aPullPool({ tokenVersion: 1 });
    pool.pullEvents();

    const rotated = pool.redefinedAs(
      keeping('ephemeral'),
      { mode: 'pull', tokenHash: hashOf('c'), tokenVersion: 2 },
      BY,
    );

    expect(rotated.id.equals(pool.id)).toBe(true);
    expect(rotated.tokenHash?.equals(hashOf('c'))).toBe(true);
    expect(changeOf(rotated)?.detail?.recorded()).toEqual({
      mode: 'pull',
      rekeyed: true,
    });
  });

  it('asks for a new token whenever its token version changes', () => {
    expect(() =>
      aPullPool({ tokenVersion: 1 }).redefinedAs(
        keeping('ephemeral'),
        { mode: 'pull', tokenHash: null, tokenVersion: 2 },
        BY,
      ),
    ).toThrow(InvalidRunnerPoolError);
  });

  it('keeps its token when relabelled without one', () => {
    const relabelled = aPullPool().redefinedAs(
      keeping('ephemeral', ['linux', 'gpu']),
      { mode: 'pull', tokenHash: null, tokenVersion: null },
      BY,
    );

    expect(relabelled.tokenHash?.equals(hashOf('a'))).toBe(true);
    expect(relabelled.labels.values).toEqual(['linux', 'gpu']);
  });

  it('keeps its key and its mode for its whole life', () => {
    expect(() =>
      aPullPool().redefinedAs(
        keeping('other'),
        { mode: 'pull', tokenHash: null, tokenVersion: null },
        BY,
      ),
    ).toThrow(RunnerPoolFixedError);
    expect(() =>
      aPushPool().redefinedAs(
        keeping('sandboxes'),
        { mode: 'pull', tokenHash: hashOf('c'), tokenVersion: null },
        BY,
      ),
    ).toThrow(RunnerPoolFixedError);
  });

  it('asks for the secret again whenever its version changes', () => {
    const pool = aPushPool();
    const url = ProvisionUrl.of('https://provision.example.com/runs');
    pool.pullEvents();

    expect(() =>
      pool.redefinedAs(
        keeping('sandboxes'),
        { mode: 'push', url, secret: null, secretVersion: 2 },
        BY,
      ),
    ).toThrow(InvalidRunnerPoolError);

    const rotated = pool.redefinedAs(
      keeping('sandboxes'),
      { mode: 'push', url, secret: secretOf('t'), secretVersion: 2 },
      BY,
    );

    expect(rotated.provision?.secret?.equals(secretOf('t'))).toBe(true);
    expect(changeOf(rotated)?.detail?.recorded()).toEqual({
      mode: 'push',
      secretRotated: true,
    });
  });

  it('has room for runs up to maxRuns, and none once retired', () => {
    const bounded = aPullPool({ maxRuns: 2 });

    expect(bounded.hasRoomFor(1)).toBe(true);
    expect(bounded.hasRoomFor(2)).toBe(false);
    expect(aPullPool().hasRoomFor(10_000)).toBe(true);
    expect(bounded.retired(BY).hasRoomFor(0)).toBe(false);
  });

  it('is retired as a deleted change', () => {
    const pool = aPullPool();
    pool.pullEvents();

    const [retired] = pool.retired(BY).pullEvents();

    expect(retired).toBeInstanceOf(RunnerPoolRetired);
    expect((retired as RunnerPoolRetired).change.action).toBe('deleted');
  });

  it('refuses a write from a version it has moved on from', () => {
    expect(() => aPullPool().expecting(3)).toThrow(RunnerPoolMovedOnError);
  });

  it('takes a whole number of runs as its limit', () => {
    expect(() => MaxRuns.of(0)).toThrow(InvalidRunnerPoolError);
    expect(() => MaxRuns.of(1.5)).toThrow(InvalidRunnerPoolError);
    expect(MaxRuns.of(3).allows(2)).toBe(true);
  });
});
