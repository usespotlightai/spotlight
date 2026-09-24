import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@runners/domain/exceptions/revoked-runner.error';
import { RunnerNameFixedError } from '@runners/domain/exceptions/runner-name-fixed.error';
import { RunnerRevisedError } from '@runners/domain/exceptions/runner-revised.error';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const has = (id: string, ...models: string[]) =>
  InstalledHarness.reported(id, models);

const NOW = new Date('2026-08-25T10:00:00.000Z');
const LATER = new Date('2026-08-25T11:00:00.000Z');

const HASH = 'a'.repeat(64);
const WORKSPACE = WorkspaceId.of('ws_1');
const BY = attributedIn(WORKSPACE);

const fresh = () =>
  Runner.enrol({
    id: RunnerId.of('runner_1'),
    workspaceId: WORKSPACE,
    name: RunnerName.of('Laptop'),
    tokenHash: TokenHash.of(HASH),
    by: BY,
  });

const enrolled = () => {
  const runner = fresh();
  runner.pullEvents();
  return runner;
};

const kinds = (runner: Runner) => runner.pullEvents().map((each) => each.kind);

describe('Runner', () => {
  it('says it was enrolled, and in which workspace', () => {
    const [event] = fresh().pullEvents();

    expect(event).toBeInstanceOf(RunnerEnrolled);
    expect((event as RunnerEnrolled).workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('belongs to the workspace it was enrolled in', () => {
    expect(enrolled().belongsTo(WORKSPACE)).toBe(true);
    expect(enrolled().belongsTo(WorkspaceId.of('ws_2'))).toBe(false);
  });

  it('knows of no harnesses before it has ever connected', () => {
    const runner = enrolled();

    expect(runner.harnesses).toEqual([]);
    expect(runner.hasConnected).toBe(false);
    expect(runner.revoked).toBe(false);
  });

  it('offers no work before it has ever connected', () => {
    expect(enrolled().offersWork).toBe(false);
  });

  it('offers work once it connects with a harness installed', () => {
    expect(enrolled().register([has('claude-code')], NOW).offersWork).toBe(
      true,
    );
  });

  it('offers no work where it connected with no harness installed', () => {
    expect(enrolled().register([], NOW).offersWork).toBe(false);
  });

  it('offers no work once its token is revoked', () => {
    expect(
      enrolled()
        .register([has('claude-code')], NOW)
        .revoke(LATER, BY).offersWork,
    ).toBe(false);
  });

  it('records what the runner says it found, and that it was heard from', () => {
    const runner = enrolled().register([has('claude-code'), has('other')], NOW);

    expect(runner.harnesses.map((each) => each.value)).toEqual([
      'claude-code',
      'other',
    ]);
    expect(runner.lastSeenAt).toEqual(NOW);
  });

  it('records the models a harness advertises', () => {
    const runner = enrolled().register(
      [has('claude-code', 'claude-sonnet-5', 'claude-opus-4-8')],
      NOW,
    );

    expect(
      runner.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5', 'claude-opus-4-8']);
  });

  it('does not advertise a model the machine could not name', () => {
    const runner = enrolled().register(
      [has('claude-code', 'claude-sonnet-5', '  ', 'x'.repeat(61))],
      NOW,
    );

    expect(
      runner.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5']);
  });

  it('takes the latest word as the whole truth', () => {
    const runner = enrolled()
      .register([has('claude-code'), has('other')], NOW)
      .register([has('other')], LATER);

    expect(runner.harnesses.map((each) => each.value)).toEqual(['other']);
  });

  it('says it registered, and what it reported, the first time', () => {
    expect(kinds(enrolled().register([has('claude-code')], NOW))).toEqual([
      'runner.registered',
      'runner.reported-harnesses',
    ]);
  });

  it('says nothing was reported when the machine still has the same', () => {
    const runner = enrolled().register([has('claude-code', 'm')], NOW);
    runner.pullEvents();

    expect(kinds(runner.register([has('claude-code', 'm')], LATER))).toEqual([
      'runner.registered',
    ]);
  });

  it('will not hear from a runner whose token was retired', () => {
    const runner = enrolled().revoke(NOW, BY);

    expect(() => runner.register([has('claude-code')], LATER)).toThrow(
      RevokedRunnerError,
    );
  });

  it('keeps its identity across a restart', () => {
    const runner = enrolled().seen(NOW).seen(LATER);

    expect(runner.id.value).toBe('runner_1');
    expect(runner.hasConnected).toBe(true);
    expect(runner.lastSeenAt).toEqual(LATER);
  });

  it('raises nothing for being seen', () => {
    expect(kinds(enrolled().seen(NOW))).toEqual([]);
  });

  it('refuses to be seen once its token is revoked', () => {
    const runner = enrolled().revoke(NOW, BY);

    expect(() => runner.seen(LATER)).toThrow(RevokedRunnerError);
  });

  it('keeps the moment it was first revoked', () => {
    const events = enrolled().revoke(NOW, BY).revoke(LATER, BY).pullEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(RunnerRevoked);
    expect((events[0] as RunnerRevoked).runnerId.value).toBe('runner_1');
  });

  it('leaves the runner it was revoked from untouched', () => {
    const runner = enrolled();
    runner.revoke(NOW, BY);

    expect(runner.pullEvents()).toHaveLength(0);
    expect(runner.revoked).toBe(false);
  });

  it('carries the version it was read at through every change', () => {
    const read = Runner.rehydrate({
      id: RunnerId.of('runner_1'),
      workspaceId: WORKSPACE,
      name: RunnerName.of('Laptop'),
      tokenHash: TokenHash.of(HASH),
      installed: [],
      revokedAt: null,
      lastSeenAt: null,
      version: 7,
    });

    expect(read.register([has('claude-code')], NOW).seen(LATER).version).toBe(
      7,
    );
  });

  it('will not be read back at an impossible version', () => {
    expect(() =>
      Runner.rehydrate({
        id: RunnerId.of('runner_1'),
        workspaceId: WORKSPACE,
        name: RunnerName.of('Laptop'),
        tokenHash: TokenHash.of(HASH),
        installed: [],
        revokedAt: null,
        lastSeenAt: null,
        version: -1,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('takes new labels as a new revision, and says so', () => {
    const redefined = enrolled().redefinedAs(
      {
        name: RunnerName.of('Laptop'),
        labels: RunnerLabels.of(['vpc-internal']),
        tokenHash: null,
      },
      BY,
    );

    expect(redefined.labels.values).toEqual(['vpc-internal']);
    expect(redefined.revision).toBe(1);
    expect(kinds(redefined)).toEqual(['runner.redefined']);
  });

  it('keeps its name for its whole life', () => {
    expect(() =>
      enrolled().redefinedAs(
        {
          name: RunnerName.of('Desktop'),
          labels: RunnerLabels.none(),
          tokenHash: null,
        },
        BY,
      ),
    ).toThrow(RunnerNameFixedError);
  });

  it('refuses a change to a revision no longer current', () => {
    expect(() => enrolled().expecting(1)).toThrow(RunnerRevisedError);
  });

  it('takes a new token without becoming a new revision', () => {
    const rekeyed = enrolled().rekeyed(TokenHash.of('b'.repeat(64)), BY);

    expect(rekeyed.tokenHash.value).toBe('b'.repeat(64));
    expect(rekeyed.revision).toBe(0);
    expect(kinds(rekeyed)).toEqual(['runner.rekeyed']);
  });

  it('records each change to it for the audit, token rotations included', () => {
    const changes = (runner: Runner) =>
      runner
        .pullEvents()
        .filter(changesConfiguration)
        .map(({ change }) => [
          change.action,
          change.key,
          change.recordedDetail,
        ]);

    expect(changes(fresh())).toEqual([['created', 'Laptop', {}]]);
    expect(
      changes(
        enrolled().redefinedAs(
          {
            name: RunnerName.of('Laptop'),
            labels: RunnerLabels.none(),
            tokenHash: TokenHash.of('b'.repeat(64)),
          },
          BY,
        ),
      ),
    ).toEqual([['updated', 'Laptop', { rekeyed: true }]]);
    expect(changes(enrolled().revoke(NOW, BY))).toEqual([
      ['deleted', 'Laptop', {}],
    ]);
  });

  it('takes no new token once revoked', () => {
    expect(() =>
      enrolled()
        .revoke(NOW, BY)
        .rekeyed(TokenHash.of('b'.repeat(64)), BY),
    ).toThrow(RevokedRunnerError);
  });

  describe('standing under a trust', () => {
    const TRUST_ID = RunnerTrustId.of('trust_1');
    const trust = (id = TRUST_ID) =>
      RunnerTrust.rehydrate({
        id,
        workspaceId: WORKSPACE,
        key: TrustKey.of('production'),
        workload: TrustedWorkload.of({
          issuer: 'https://oidc.example.com',
          subject: 'runner',
          audience: 'spotlight',
        }),
        labels: RunnerLabels.of(['vpc-internal', 'gpu']),
        version: 0,
      });
    const trusted = () =>
      Runner.enrol({
        id: RunnerId.of('runner_2'),
        workspaceId: WORKSPACE,
        name: RunnerName.of('pod-a'),
        tokenHash: TokenHash.of(HASH),
        labels: RunnerLabels.of(['gpu']),
        trustId: TRUST_ID,
        by: BY,
      });

    it('answers to its name, its own labels and its trust’s, each once', () => {
      expect(trusted().termsWith(trust()).values).toEqual([
        'pod-a',
        'gpu',
        'vpc-internal',
      ]);
    });

    it('answers only to its name and labels without the trust it enrolled through', () => {
      expect(trusted().termsWith(null).values).toEqual(['pod-a', 'gpu']);
      expect(
        trusted().termsWith(trust(RunnerTrustId.of('trust_2'))).values,
      ).toEqual(['pod-a', 'gpu']);
    });

    it('stands only while the trust it enrolled through stands', () => {
      expect(trusted().standsWith(trust())).toBe(true);
      expect(trusted().standsWith(null)).toBe(false);
      expect(trusted().standsWith(trust().withdrawn(BY))).toBe(false);
      expect(trusted().standsWith(trust(RunnerTrustId.of('trust_2')))).toBe(
        false,
      );
    });

    it('leaves holding its workspace to its trust, where one enrolled it by hand holds it until revoked', () => {
      expect(trusted().holdsWorkspace).toBe(false);
      expect(enrolled().holdsWorkspace).toBe(true);
      expect(enrolled().revoke(NOW, BY).holdsWorkspace).toBe(false);
    });

    it('stands with no trust when it was enrolled by hand, until revoked', () => {
      expect(enrolled().standsWith(null)).toBe(true);
      expect(enrolled().revoke(NOW, BY).standsWith(null)).toBe(false);
    });
  });
});
