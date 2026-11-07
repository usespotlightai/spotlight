import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { InvalidRunTransitionError } from '@runs/domain/exceptions/invalid-run-transition.error';
import { RunActsOnlyOnItselfError } from '@runs/domain/exceptions/run-acts-only-on-itself.error';
import { RunAttemptOverError } from '@runs/domain/exceptions/run-attempt-over.error';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import type { RunSpecParts } from '@runs/domain/value-objects/run-spec.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const aSpec = (executable = 'sh') =>
  RunSpec.of({
    command: { executable, args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    resume: {},
  });

const at = (iso: string) => new Date(iso);
const noon = at('2026-08-23T12:00:00.000Z');

const runner = (id = 'runner_1') => RunnerId.of(id);

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.spec(),
    spec: aSpec('sh'),
  });

const claimed = (by = runner(), when = noon) =>
  queued().claim(claimer(by), when);

const lostAndRequeued = (run: Run) =>
  run.expireLease(run.leaseExpiresAt as Date);

const onAttempt = (attempt: number, leaseUntil: Date) =>
  Run.rehydrate({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.normal,
    ...orderedFor.spec(),
    spec: aSpec(),
    state: 'claimed',
    claimedBy: RunnerId.of('runner_1'),
    leaseExpiresAt: leaseUntil,
    outcome: null,
    attempt,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
    queuedAt: noon,
    createdAt: noon,
  });

describe('Run', () => {
  it('is exhausted rather than requeued for ever', () => {
    const expiredAt = at('2026-08-28T12:00:00.000Z');
    const spent = onAttempt(3, expiredAt);

    const exhausted = spent.expireLease(
      new Date(expiredAt.getTime() + 600_000),
    );

    expect(exhausted.state).toBe('failed');
    expect(exhausted.outcome?.failure?.code).toBe('runner-lost');
    const events = exhausted.pullEvents();
    expect(events.some((each) => each instanceof RunExhausted)).toBe(true);
  });

  it('goes back on the queue while it still has attempts left, releasing the runner whose lease expired', () => {
    const expiredAt = at('2026-08-28T12:00:00.000Z');
    const first = onAttempt(1, expiredAt);
    const requeuedAt = new Date(expiredAt.getTime() + 600_000);

    const again = first.expireLease(requeuedAt);

    expect(again.state).toBe('queued');
    expect(again.pullEvents()).toEqual([
      new RunLeaseExpired(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        RunnerId.of('runner_1'),
        requeuedAt,
        RunAttempt.of(RunId.of('run_1'), 1),
      ),
    ]);
  });

  it('starts queued, unclaimed and on its first attempt', () => {
    const run = queued();

    expect(run.state).toBe('queued');
    expect(run.claimedBy).toBeNull();
    expect(run.attempt.number).toBe(1);
  });

  it('takes a claimant and a lease when claimed', () => {
    const run = claimed();

    expect(run.state).toBe('claimed');
    expect(run.claimedBy).toEqual(runner());
    expect(run.leaseExpiresAt?.getTime()).toBeGreaterThan(noon.getTime());
  });

  it('has not started once claimed, only once its runner says it started in its image', () => {
    const later = at('2026-08-28T12:00:00.000Z');
    const image = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );

    expect(queued().startedAt).toBeNull();
    expect(claimed().startedAt).toBeNull();
    expect(claimed().startedIn(runner(), image, later).startedAt).toEqual(
      later,
    );
  });

  it('keeps the start it was first told of while the same claim says it again', () => {
    const later = at('2026-08-28T12:00:00.000Z');
    const image = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );

    expect(
      claimed()
        .startedIn(runner(), image, noon)
        .startedIn(runner(), image, later).startedAt,
    ).toEqual(noon);
  });

  it('clears its start when it goes back on the queue, so a run that never starts again has none', () => {
    const image = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );
    const started = claimed().startedIn(runner(), image, noon);

    expect(lostAndRequeued(started).startedAt).toBeNull();
    expect(claimed().unclaimedBy(runner(), noon).startedAt).toBeNull();
    expect(started.requeue(runner(), noon, 'no room').startedAt).toBeNull();
  });

  it('leaves the run it was claimed from on the queue', () => {
    const waiting = queued();

    waiting.claim(claimer(runner()), noon);

    expect(waiting.state).toBe('queued');
    expect(waiting.claimedBy).toBeNull();
  });

  it('cannot be claimed by a runner of another workspace', () => {
    expect(() => queued().claim(claimer(runner(), 'ws_other'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('cannot be claimed twice', () => {
    const run = claimed();

    expect(() => run.claim(claimer(runner('runner_2')), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('has an expired lease only once its lease is behind it', () => {
    const run = claimed();
    const lease = run.leaseExpiresAt as Date;

    expect(run.leaseExpired(new Date(lease.getTime() - 1))).toBe(false);
    expect(run.leaseExpired(lease)).toBe(true);
  });

  it('never has an expired lease while it sits on the queue', () => {
    expect(queued().leaseExpired(at('2027-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('goes back on the queue for someone else, counting the attempt', () => {
    const leased = claimed();

    const again = leased.expireLease(leased.leaseExpiresAt as Date);

    expect(again.state).toBe('queued');
    expect(again.claimedBy).toBeNull();
    expect(again.leaseExpiresAt).toBeNull();
    expect(again.attempt.number).toBe(2);
  });

  it('ends as stopped instead of going back on the queue when its runner was lost after a stop request', () => {
    const stopping = claimed().requestStop(noon);
    stopping.pullEvents();

    const ended = stopping.expireLease(stopping.leaseExpiresAt as Date);

    expect(ended.hasEnded).toBe(true);
    expect(ended.state).not.toBe('queued');
    expect(ended.outcome?.stopped).toBe(true);
    expect(ended.outcome?.exitCode.value).toBe(-1);
    expect(ended.attempt.number).toBe(1);
    expect(ended.pullEvents().some((each) => each instanceof RunEnded)).toBe(
      true,
    );
  });

  it('cannot expire its lease while the lease is still valid', () => {
    const run = claimed();

    expect(() => run.expireLease(noon)).toThrow(InvalidRunTransitionError);
  });

  it('lets the runner that leases it push the lease out', () => {
    const leased = claimed();

    const renewed = leased.renewLease(runner(), at('2026-08-23T12:00:30.000Z'));

    expect((renewed.leaseExpiresAt as Date).getTime()).toBeGreaterThan(
      (leased.leaseExpiresAt as Date).getTime(),
    );
  });

  it('rejects a lease renewal from a runner that does not lease it', () => {
    const run = claimed();

    expect(() => run.renewLease(runner('someone_else'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('cannot be completed by a runner that does not lease it', () => {
    const run = claimed();

    expect(() =>
      run.complete(
        runner('someone_else'),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('records what a finished run produced, and drops the lease', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
      HandoverReport.none(),
      noon,
    );

    expect(ended.state).toBe('completed');
    expect(ended.outcome).toEqual(
      RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
    );
    expect(ended.leaseExpiresAt).toBeNull();
  });

  it('calls a failing run failed even though it reported an exit code', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({
        exitCode: ExitCode.of(2),
        failed: true,
        detail: 'no push',
      }),
      HandoverReport.none(),
      noon,
    );

    expect(ended.state).toBe('failed');
    expect(ended.outcome?.detail).toBe('no push');
  });

  it('cannot be completed once it already is', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
      HandoverReport.none(),
      noon,
    );

    expect(() =>
      ended.complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('lets any runner claim a queued run nobody reserved', () => {
    expect(
      queued().claim(claimer(runner('runner_9')), noon).claimedBy?.value,
    ).toBe('runner_9');
  });

  it('lets nobody but its runner act on it', () => {
    const run = claimed(runner('runner_1'));

    expect(() => run.assertLeasedBy(runner('runner_2'))).toThrow(
      InvalidRunTransitionError,
    );
    expect(() => run.assertLeasedBy(runner('runner_1'))).not.toThrow();
  });

  it('lets nobody act on a run nobody leases', () => {
    expect(() => queued().assertLeasedBy(runner())).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('lets its runner act on the attempt it leases, and on no attempt it has left behind', () => {
    const leased = claimed();
    const first = leased.attempt;
    const reclaimed = lostAndRequeued(leased).claim(
      claimer(runner()),
      at('2026-08-28T12:00:00.000Z'),
    );

    expect(() => leased.assertStillOn(first, runner())).not.toThrow();
    expect(() =>
      lostAndRequeued(leased).assertStillOn(first, runner()),
    ).toThrow(RunAttemptOverError);
    expect(() => reclaimed.assertStillOn(first, runner())).toThrow(
      RunAttemptOverError,
    );
    expect(() =>
      reclaimed.assertStillOn(reclaimed.attempt, runner()),
    ).not.toThrow();
    expect(() =>
      leased.assertStillOn(first, RunnerId.of('runner_other')),
    ).toThrow(RunAttemptOverError);
  });

  describe('keeping a journal', () => {
    it('journals under the attempt its runner is working', () => {
      const journal = claimed().journalFor(runner());

      expect(journal.runId.value).toBe('run_1');
      expect(journal.number).toBe(1);
    });

    it('rejects a journal from a runner that does not lease it', () => {
      expect(() => claimed().journalFor(runner('runner_2'))).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('rejects a journal for a run nobody leases', () => {
      expect(() => queued().journalFor(runner())).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('knowing what it has enabled', () => {
    const enabling = (...tools: string[]) =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.spec(),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
          manifest: tools.map((name) => ({
            name,
            description: name,
            inputs: [],
            approval: null,
          })),
        }),
      });

    it('has a tool enabled that its spec names', () => {
      expect(enabling('pull-request').isEnabled(Tool.of('pull-request'))).toBe(
        true,
      );
    });

    it('does not have a tool enabled that its spec leaves out', () => {
      expect(
        enabling('pull-request').isEnabled(Tool.of('linear.comment')),
      ).toBe(false);
    });

    it('has nothing enabled where its spec names no tools', () => {
      expect(queued().isEnabled(Tool.of('pull-request'))).toBe(false);
    });
  });

  describe('knowing which working copy to restore', () => {
    const working = (
      ordered: ReturnType<typeof orderedFor.holdingTurn>,
      resume: { sessionId?: string },
    ) =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...ordered,
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          resume,
        }),
      });

    const newestOf = (run: Run) => {
      const source = run.restoresFrom;

      return source && 'newestOf' in source ? source.newestOf.value : null;
    };

    it('restores a working copy that always restores whether or not a conversation carries on', () => {
      expect(newestOf(working(orderedFor.holdingTurn('task_1'), {}))).toBe(
        'requester/subject-task_1',
      );
      expect(
        newestOf(
          working(orderedFor.holdingTurn('task_1'), { sessionId: 'session_1' }),
        ),
      ).toBe('requester/subject-task_1');
    });

    it('restores a working copy that restores when continuing only to carry its conversation on', () => {
      expect(
        working(orderedFor.conversing('chat_1'), {}).restoresFrom,
      ).toBeNull();
      expect(
        newestOf(
          working(orderedFor.conversing('chat_1'), { sessionId: 'session_1' }),
        ),
      ).toBe('requester/conversation-chat_1');
    });

    it('restores nothing for work without a working copy', () => {
      expect(working(orderedFor.spec(), {}).restoresFrom).toBeNull();
    });

    it('restores exactly the archive it was ordered to, before any of its key', () => {
      const run = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.isolated(),
        restore: WorkingCopyArchiveId.of('archive_1'),
        spec: aSpec(),
      });

      expect(run.restoresFrom).toEqual({
        archive: WorkingCopyArchiveId.of('archive_1'),
      });
    });
  });

  describe('choosing the archive to restore', () => {
    const candidate = (
      id: string,
      key: string,
      completedAt: Date | null,
      workspace = 'ws_1',
    ) => ({
      id: WorkingCopyArchiveId.of(id),
      workingCopyKey: WorkingCopyKey.parse(key),
      completedAt,
      isAvailableIn: (workspaceId: WorkspaceId) =>
        completedAt !== null && workspaceId.value === workspace,
    });

    const ofTask = () =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.holdingTurn('task_1'),
        spec: aSpec(),
      });

    it('takes the newest completed archive of its working copy in its own workspace', () => {
      const chosen = ofTask().archiveToRestore([
        candidate(
          'older',
          'requester/subject-task_1',
          at('2026-08-20T00:00:00Z'),
        ),
        candidate(
          'newer',
          'requester/subject-task_1',
          at('2026-08-21T00:00:00Z'),
        ),
        candidate(
          'other',
          'requester/subject-task_2',
          at('2026-08-22T00:00:00Z'),
        ),
        candidate(
          'elsewhere',
          'requester/subject-task_1',
          at('2026-08-23T00:00:00Z'),
          'ws_2',
        ),
      ]);

      expect(chosen?.id.value).toBe('newer');
    });

    it('takes the exact archive it was ordered to only while it is stored in its workspace', () => {
      const exact = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.isolated(),
        restore: WorkingCopyArchiveId.of('archive_1'),
        spec: aSpec(),
      });

      expect(
        exact.archiveToRestore([
          candidate('archive_1', 'requester/subject-task_9', noon),
        ])?.id.value,
      ).toBe('archive_1');
      expect(
        exact.archiveToRestore([
          candidate('archive_1', 'requester/subject-task_9', noon, 'ws_2'),
        ]),
      ).toBeNull();
      expect(
        exact.archiveToRestore([
          candidate('archive_1', 'requester/subject-task_9', null),
        ]),
      ).toBeNull();
    });
  });

  describe('knowing the secrets that egress injects for it', () => {
    const injecting = () =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.spec(),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
          injectedSecrets: ['LINEAR_API_KEY'],
        }),
      });

    it('injects them for the runner that leases it', () => {
      expect(
        injecting().claim(claimer(runner()), noon).injectedSecretsFor(runner()),
      ).toEqual([SecretName.of('LINEAR_API_KEY')]);
    });

    it('injects nothing for another runner, while it waits, or once it has ended', () => {
      const leased = injecting().claim(claimer(runner()), noon);

      expect(leased.injectedSecretsFor(runner('runner_2'))).toEqual([]);
      expect(injecting().injectedSecretsFor(runner())).toEqual([]);
      expect(
        leased
          .complete(
            runner(),
            RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
            HandoverReport.none(),
            noon,
          )
          .injectedSecretsFor(runner()),
      ).toEqual([]);
    });

    it('is leased only by the runner that claimed it, and only until it ends', () => {
      const leased = claimed();

      expect(leased.isLeasedBy(runner())).toBe(true);
      expect(leased.isLeasedBy(runner('runner_2'))).toBe(false);
      expect(queued().isLeasedBy(runner())).toBe(false);
      expect(
        leased
          .complete(
            runner(),
            RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
            HandoverReport.none(),
            noon,
          )
          .isLeasedBy(runner()),
      ).toBe(false);
    });

    it('is never reserved for a pool runner when it uses Spotlight’s API, since only egress injects its token', () => {
      const usingApi = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.conversing(),
        apiGrant: RunApiGrant.of({
          actingFor: 'user_1',
          scopes: ['plan'],
          lifetimeMs: 60_000,
        }),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'set up',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
          spotlightApi: true,
        }),
      });

      expect(usingApi.provisionableAt(noon)).toBe(false);
      expect(usingApi.provisionableAt(noon, true)).toBe(true);
      expect(
        usingApi.claim(claimer(runner()), noon).apiGrantFor(runner()),
      ).not.toBeNull();
      expect(
        usingApi.claim(claimer(runner()), noon).apiGrantFor(runner('runner_2')),
      ).toBeNull();
    });

    it('injects nothing that its spec does not name', () => {
      expect(claimed().injectedSecretsFor(runner())).toEqual([]);
    });

    it('is never reserved for a runner a pool provisions, which has no egress to inject them', () => {
      expect(injecting().injectsSecrets).toBe(true);
      expect(injecting().provisionableAt(noon)).toBe(false);
      expect(() =>
        injecting().reservedFor(runner(), PoolId.of('pool_1'), noon),
      ).toThrow(InvalidRunTransitionError);
      expect(
        queued().reservedFor(runner(), PoolId.of('pool_1'), noon).reservation,
      ).not.toBeNull();
    });

    it('is reserved for a runner a pool provisions when the pool names an egress to inject them', () => {
      expect(injecting().provisionableAt(noon, true)).toBe(true);
      expect(
        injecting().reservedFor(runner(), PoolId.of('pool_1'), noon, true)
          .reservation,
      ).not.toBeNull();
    });
  });

  describe('knowing who worked it', () => {
    it('was worked by the runner that claimed it, even once it has ended', () => {
      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      );

      expect(ended.wasClaimedBy(runner())).toBe(true);
      expect(ended.wasClaimedBy(runner('runner_2'))).toBe(false);
    });

    it('was worked by nobody while it waits', () => {
      expect(queued().wasClaimedBy(runner())).toBe(false);
    });

    it('names the attempt its runner worked, also once it has ended, but none after the runner lost it', () => {
      const leased = claimed();
      const ended = leased.complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      );

      expect(ended.attemptClaimedBy(runner())?.equals(leased.attempt)).toBe(
        true,
      );
      expect(ended.attemptClaimedBy(runner('runner_2'))).toBeNull();
      expect(lostAndRequeued(leased).attemptClaimedBy(runner())).toBeNull();
    });
  });

  describe('being refused before a runner claims it', () => {
    const EXPIRED = RunOutcome.refused([
      {
        description:
          'entitlement_expired: catalog.web-search@1.1.0 requires the Team plan, and this workspace is on the Free plan',
      },
    ]);

    it('ends failed, saying why, so whoever handed it over learns of it', () => {
      const refused = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.spec(),
        spec: aSpec('sh'),
        refusal: [{ description: EXPIRED.detail ?? '' }],
      });

      expect(refused.state).toBe('failed');
      expect(refused.outcome?.detail).toBe(
        'entitlement_expired: catalog.web-search@1.1.0 requires the Team plan, and this workspace is on the Free plan',
      );

      const [completed] = refused.pullEvents();
      expect(completed).toBeInstanceOf(RunEnded);
      expect((completed as RunEnded).claimedBy).toBeNull();
      expect(refused.endedAt).toEqual(refused.createdAt);
    });
  });

  describe('being unclaimed when its runner could not take it', () => {
    it('goes back on the queue as it was, counting neither an attempt nor a requeue', () => {
      const before = queued();
      const unclaimed = claimed().unclaimedBy(runner(), noon);

      expect(unclaimed.state).toBe('queued');
      expect(unclaimed.claimedBy).toBeNull();
      expect(unclaimed.leaseExpiresAt).toBeNull();
      expect(unclaimed.attempt.equals(before.attempt)).toBe(true);
      expect(unclaimed.requeueCount).toEqual(before.requeueCount);
      expect(unclaimed.claimableAt(noon)).toBe(true);
      expect(unclaimed.pullEvents()).toEqual([]);
    });

    it('ends as stopped, not back on the queue, when someone asked it to stop', () => {
      const unclaimed = claimed().requestStop(noon).unclaimedBy(runner(), noon);

      expect(unclaimed.hasEnded).toBe(true);
      expect(unclaimed.state).not.toBe('queued');
      expect(unclaimed.outcome?.stopped).toBe(true);
    });

    it('is unclaimed only by the runner that claimed it', () => {
      expect(() => claimed().unclaimedBy(runner('runner_2'), noon)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => queued().unclaimedBy(runner(), noon)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('cannot be unclaimed once it has started', () => {
      const started = claimed().startedIn(
        runner(),
        RunnerImage.of(`ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`),
        noon,
      );

      expect(() => started.unclaimedBy(runner(), noon)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being requeued before it starts', () => {
    const DOWN = 'connect ECONNREFUSED';
    const laterBy = (ms: number) => new Date(noon.getTime() + ms);

    it('waits to be claimed again without spending an attempt', () => {
      const back = claimed().requeue(runner(), noon, DOWN);

      expect(back.state).toBe('queued');
      expect(back.claimedBy).toBeNull();
      expect(back.leaseExpiresAt).toBeNull();
      expect(back.attempt.number).toBe(1);
      expect(back.pullEvents()).toEqual([]);
    });

    it('is not claimed again until its back-off has passed', () => {
      const back = claimed().requeue(runner(), noon, DOWN);

      expect(back.claimableAt(laterBy(4_999))).toBe(false);
      expect(back.provisionableAt(laterBy(4_999))).toBe(false);
      expect(back.claimableAt(laterBy(5_000))).toBe(true);
      expect(back.provisionableAt(laterBy(5_000))).toBe(true);
      expect(
        back.claim(claimer(runner('runner_2')), laterBy(5_000)).state,
      ).toBe('claimed');
    });

    it('waits twice as long each time it is requeued', () => {
      let run = claimed();
      const waits: number[] = [];

      for (let each = 0; each < 5; each++) {
        run = run.requeue(runner(), noon, DOWN);
        waits.push(
          (run.requeueCount.claimableFrom?.getTime() ?? 0) - noon.getTime(),
        );
        run = run.claim(
          claimer(runner()),
          run.requeueCount.claimableFrom as Date,
        );
      }

      expect(waits).toEqual([5_000, 10_000, 20_000, 40_000, 80_000]);
    });

    it('cannot be claimed while it waits out its back-off', () => {
      const requeued = claimed().requeue(runner(), noon, DOWN);

      expect(() => requeued.claim(claimer(runner()), noon)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('ends failed, saying its hooks could not be called, the sixth time it is requeued', () => {
      let run = claimed();

      for (let each = 0; each < 5; each++) {
        run = run.requeue(runner(), noon, DOWN);
        run = run.claim(
          claimer(runner()),
          run.requeueCount.claimableFrom as Date,
        );
      }
      run.pullEvents();

      const ended = run.requeue(runner(), noon, DOWN);

      expect(ended.state).toBe('failed');
      expect(ended.outcome?.failure?.code).toBe('start-gate-unanswered');
      expect(ended.outcome?.detail).toBe(DOWN);
      expect(ended.outcome?.attempts).toBe(6);
      expect(ended.pullEvents()[0]).toBeInstanceOf(RunEnded);
    });

    it('ends stopped, not queued, when a stop was requested while its hooks were called', () => {
      const stopping = claimed().requestStop(noon);
      stopping.pullEvents();

      const ended = stopping.requeue(runner(), noon, DOWN);

      expect(ended.state).toBe('completed');
      expect(ended.outcome?.stopped).toBe(true);
      expect(ended.claimedBy).toBeNull();
      const [completed] = ended.pullEvents();
      expect(completed).toBeInstanceOf(RunEnded);
      expect((completed as RunEnded).outcome.stopped).toBe(true);
    });

    it('starts counting afresh on a later attempt', () => {
      const back = claimed()
        .requeue(runner(), noon, DOWN)
        .claim(claimer(runner()), laterBy(5_000));

      expect(lostAndRequeued(back).requeueCount.count).toBe(0);
    });

    it('is requeued only by the runner that claimed it', () => {
      expect(() => claimed().requeue(runner('runner_2'), noon, DOWN)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => queued().requeue(runner(), noon, DOWN)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('having its start denied by a hook', () => {
    const REASON = 'The hook core/freeze denied the start: deploys are frozen.';

    it('ends failed with the hook’s reason, worked by nobody', () => {
      const denied = claimed().deniedStart(runner(), REASON, noon);

      expect(denied.state).toBe('failed');
      expect(denied.outcome?.detail).toBe(REASON);
      expect(denied.claimedBy).toBeNull();
      expect(denied.wasClaimedBy(runner())).toBe(false);

      const [completed] = denied.pullEvents();
      expect(completed).toBeInstanceOf(RunEnded);
      expect((completed as RunEnded).outcome.failed).toBe(true);
      expect((completed as RunEnded).claimedBy).toBeNull();
    });

    it('has its start denied only by the runner that claimed it', () => {
      expect(() =>
        claimed().deniedStart(runner('runner_2'), REASON, noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('cannot have its start denied before a runner claims it', () => {
      expect(() => queued().deniedStart(runner(), REASON, noon)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being cancelled before a runner claims it', () => {
    it('ends a queued run as cancelled, since its task moved on without it', () => {
      const { run: cancelled, was } = queued().cancel(
        'The task moved on.',
        noon,
      );

      expect(was).toBe('queued');
      expect(cancelled.endedAt).toEqual(noon);
      expect(cancelled.state).toBe('cancelled');
      expect(cancelled.outcome?.failure?.code).toBe('cancelled');
      expect(cancelled.outcome?.cancelled).toBe(true);
      expect(cancelled.hasEnded).toBe(true);
      expect(cancelled.outcome?.detail).toBe('The task moved on.');
      expect(cancelled.pullEvents().map((each) => each.kind)).toEqual([
        'run.cancelled',
      ]);
    });

    it('only requests a stop of a run that is already being worked', () => {
      const { run, was } = claimed().cancel('The task moved on.', noon);

      expect(was).toBe('claimed');
      expect(run.state).toBe('claimed');
      expect(run.stopRequested).toBe(true);
    });

    it('leaves a claimed run alone when cancelling only a queued one', () => {
      const claimedRun = claimed();
      const cancelled = claimedRun.cancelledIfQueued('Stopped.', noon);

      expect(cancelled.outcome).toBe('claimed');
      expect(cancelled.run).toBe(claimedRun);
    });
  });

  describe('getting a stop request', () => {
    it('records when a person requested a claimed run to stop', () => {
      const stopping = claimed().requestStop(at('2026-08-23T12:00:30.000Z'));

      expect(stopping.stopRequested).toBe(true);
      expect(stopping.stopRequestedAt).toEqual(at('2026-08-23T12:00:30.000Z'));
    });

    it('is not stop-requested until someone requests it', () => {
      expect(claimed().stopRequested).toBe(false);
    });

    it('does not stop a run that is not being worked', () => {
      expect(() => queued().requestStop(noon)).toThrow(
        InvalidRunTransitionError,
      );

      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      );
      expect(() => ended.requestStop(noon)).toThrow(InvalidRunTransitionError);
    });

    it('keeps the first request when told twice', () => {
      const first = claimed().requestStop(at('2026-08-23T12:00:30.000Z'));
      const again = first.requestStop(at('2026-08-23T12:00:45.000Z'));

      expect(again.stopRequestedAt).toEqual(at('2026-08-23T12:00:30.000Z'));
    });
  });

  describe('announcing how it ended', () => {
    it('says what the agent reported when it completes', () => {
      const [raised] = claimed()
        .complete(
          runner(),
          RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
          HandoverReport.of({
            handover: Handover.of({ next: 'Spec', note: 'ready' }),
            session: HarnessSession.of('session_1'),
          }),
          noon,
        )
        .pullEvents();

      expect(raised).toBeInstanceOf(RunEnded);
      const completed = raised as RunEnded;
      expect(completed.runId).toEqual(RunId.of('run_1'));
      expect(completed.outcome.failed).toBe(false);
      expect(completed.claimedBy).toEqual(runner());
      expect(completed.handover?.next).toBe('Spec');
      expect(completed.session?.value).toBe('session_1');
    });

    it('keeps nothing of what it announced', () => {
      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.of({ session: HarnessSession.of('session_1') }),
        noon,
      );

      expect(ended.outcome).toEqual(
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
      );
    });

    it('goes back on the queue when its host times it out, as for an expired lease, and is exhausted as timed out', () => {
      let run = queued();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        run = run.claim(claimer(runner()), noon).timedOut(runner(), noon);
        expect(run.state).toBe('queued');
      }

      const timedOut = run
        .claim(claimer(runner()), noon)
        .timedOut(runner(), noon);
      const events = timedOut.pullEvents();
      const exhausted = events.find(
        (each): each is RunExhausted => each instanceof RunExhausted,
      );

      expect(exhausted?.failure).toBe('timed-out');
      expect(timedOut.outcome?.failure?.code).toBe('timed-out');
      expect(events.some((each) => each instanceof RunLeaseExpired)).toBe(true);
      expect(() =>
        queued()
          .claim(claimer(runner()), noon)
          .timedOut(RunnerId.of('elsewhere'), noon),
      ).toThrow();
    });

    it('says so when it is exhausted', () => {
      let run = queued();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        run = run
          .claim(claimer(runner()), noon)
          .expireLease(at('2026-08-23T12:05:00.000Z'));
      }

      const raised = run
        .pullEvents()
        .filter((each) => each instanceof RunExhausted);

      expect(raised).toHaveLength(1);
      expect((raised[0] as RunExhausted).attempt.number).toBe(3);
      expect((raised[0] as RunExhausted).failure).toBe('runner-lost');
    });

    it('leaves the run it was completed from with nothing to announce', () => {
      const leased = claimed();

      leased.complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.none(),
        noon,
      );

      expect(leased.pullEvents()).toHaveLength(0);
      expect(leased.state).toBe('claimed');
    });
  });

  describe('waiting for a runner provisioned for it', () => {
    const later = (ms: number) => new Date(noon.getTime() + ms);
    const reserved = () =>
      queued().reservedFor(runner('pooled_1'), PoolId.of('burst'), noon);

    it('reserves itself for the provisioned runner for five minutes', () => {
      const run = reserved();

      expect(run.reservation?.runner.value).toBe('pooled_1');
      expect(run.reservation?.pool.value).toBe('burst');
      expect(run.reservation?.until).toEqual(later(5 * 60_000));
      expect(run.isReservedAt(later(5 * 60_000 - 1))).toBe(true);
      expect(run.isReservedAt(later(5 * 60_000))).toBe(false);
    });

    it('is provisionable only while queued, open, unreserved and without injected secrets', () => {
      expect(queued().provisionableAt(noon)).toBe(true);
      expect(reserved().provisionableAt(noon)).toBe(false);
      expect(claimed().provisionableAt(noon)).toBe(false);
    });

    it('cannot be reserved twice', () => {
      expect(() =>
        reserved().reservedFor(runner('pooled_2'), PoolId.of('burst'), noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('cannot be reserved once a runner leases it', () => {
      expect(() =>
        claimed().reservedFor(runner('pooled_1'), PoolId.of('burst'), noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('rejects another runner while the reservation is active', () => {
      expect(() =>
        reserved().claim(claimer(runner('runner_9')), later(1_000)),
      ).toThrow(InvalidRunTransitionError);
    });

    it('lets another runner take it once the reservation expires, releasing the runner reserved', () => {
      const run = reserved().claim(
        claimer(runner('runner_9')),
        later(5 * 60_000),
      );

      expect(run.claimedBy?.value).toBe('runner_9');
      expect(run.reservation).toBeNull();
      expect(run.pullEvents()).toEqual([
        new RunReservationDropped(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          runner('pooled_1'),
        ),
      ]);
    });

    it('is taken by the provisioned runner, dropping the reservation', () => {
      const run = reserved().claim(claimer(runner('pooled_1')), later(1_000));

      expect(run.state).toBe('claimed');
      expect(run.claimedBy?.value).toBe('pooled_1');
      expect(run.reservation).toBeNull();
      expect(run.pullEvents()).toEqual([]);
    });

    it('knows its reservation expired only once it is behind it while still queued', () => {
      expect(reserved().reservationExpiredAt(later(1_000))).toBe(false);
      expect(reserved().reservationExpiredAt(later(5 * 60_000))).toBe(true);
      expect(queued().reservationExpiredAt(later(5 * 60_000))).toBe(false);
    });

    it('drops its reservation when unreserved by its runner, releasing the runner', () => {
      const run = reserved().unreservedFor(runner('pooled_1'));

      expect(run.reservation).toBeNull();
      expect(run.provisionableAt(noon)).toBe(true);
      expect(run.pullEvents()).toEqual([
        new RunReservationDropped(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          runner('pooled_1'),
        ),
      ]);
    });

    it('releases its provisioned runner when cancelled', () => {
      const { run } = reserved().cancel('The task moved on.', noon);

      expect(run.reservation).toBeNull();
      expect(run.pullEvents().map((each) => each.kind)).toEqual([
        'run.reservation-dropped',
        'run.cancelled',
      ]);
    });

    it('keeps its reservation when another runner drops it', () => {
      const run = reserved();

      expect(run.unreservedFor(runner('pooled_2'))).toBe(run);
    });

    it('is left as it is when unreserved with nothing reserved', () => {
      const run = queued();

      expect(run.unreservedFor(runner('pooled_1'))).toBe(run);
    });

    it('is left as it is when unreserved once a runner leases it', () => {
      const run = claimed(runner('pooled_1'));

      expect(run.unreservedFor(runner('pooled_1'))).toBe(run);
    });
  });

  describe('failing to be provisioned', () => {
    const later = (ms: number) => new Date(noon.getTime() + ms);
    const failure = ProvisionFailure.of('http-error', 'the pool said no');
    const pooled = runner('pooled_1');
    const failedAgain = (run: Run) => {
      const due = run.provisioning.nextAttemptAt ?? noon;

      return run
        .reservedFor(pooled, PoolId.of('burst'), due)
        .provisionFailed(pooled, failure, due);
    };

    it('stays queued, unreserved and backs off before the next try', () => {
      const run = failedAgain(queued());

      expect(run.state).toBe('queued');
      expect(run.reservation).toBeNull();
      expect(run.provisioning.attempts).toBe(1);
      expect(run.provisioning.nextAttemptAt).toEqual(later(5_000));
      expect(run.provisionableAt(later(4_999))).toBe(false);
      expect(run.provisionableAt(later(5_000))).toBe(true);
    });

    it('backs off longer after each failure', () => {
      const twice = failedAgain(failedAgain(queued()));

      expect(twice.provisioning.nextAttemptAt).toEqual(later(15_000));
    });

    it('fails for good after five failures, saying why', () => {
      let run = queued();
      for (let failure = 0; failure < 5; failure += 1) {
        run = failedAgain(run);
      }

      expect(run.state).toBe('failed');
      expect(run.hasEnded).toBe(true);
      expect(run.outcome?.failed).toBe(true);
      expect(run.outcome).toEqual(RunOutcome.unprovisioned(failure, 5));
      expect(run.outcome?.detail).toBe('http-error: the pool said no');
      expect(run.outcome?.attempts).toBe(5);

      const completed = run
        .pullEvents()
        .filter((each) => each instanceof RunEnded);
      expect(completed).toHaveLength(1);
      expect((completed[0] as RunEnded).claimedBy).toBeNull();
    });

    it('records the failure and releases the runner reserved for it while it still has tries left', () => {
      const events = failedAgain(queued()).pullEvents();

      expect(events[0]?.kind).toBe('run.provision-failed');
      expect(events.slice(1)).toEqual([
        new RunReservationDropped(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          pooled,
        ),
      ]);
    });

    it('fails to provision on a runner without its harness, and on no other', () => {
      const run = queued().reservedFor(pooled, PoolId.of('burst'), noon);

      expect(
        run.provisionFailureFor(pooled, [HarnessId.of('claude-code')]),
      ).toEqual(ProvisionFailure.harnessMissing('dev'));
      expect(run.provisionFailureFor(pooled, [HarnessId.of('dev')])).toBeNull();
      expect(
        run.provisionFailureFor(runner('pooled_2'), [
          HarnessId.of('claude-code'),
        ]),
      ).toBeNull();
      expect(
        queued().provisionFailureFor(pooled, [HarnessId.of('claude-code')]),
      ).toBeNull();
    });

    it('counts no failure when another runner reports one', () => {
      const run = queued().reservedFor(pooled, PoolId.of('burst'), noon);

      expect(run.provisionFailed(runner('pooled_2'), failure, noon)).toBe(run);
    });

    it('counts no failure when nothing is reserved for it', () => {
      const run = queued();

      expect(run.provisionFailed(pooled, failure, noon)).toBe(run);
    });

    it('counts no failure once a runner leases it', () => {
      const run = claimed(pooled);

      expect(run.provisionFailed(pooled, failure, noon)).toBe(run);
    });

    it('starts provisioning afresh when requeued', () => {
      const again = failedAgain(queued())
        .claim(claimer(runner()), later(5_000))
        .expireLease(later(10 * 60_000));

      expect(again.provisioning.attempts).toBe(0);
      expect(again.provisioning.nextAttemptAt).toBeNull();
      expect(again.reservation).toBeNull();
      expect(again.provisionableAt(later(10 * 60_000))).toBe(true);
    });
  });

  describe('recording the image it runs in', () => {
    const pinned = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );

    it('runs in no image it knows of until its runner says', () => {
      expect(claimed().ranIn).toBeNull();
    });

    it('keeps the image its runner says it started in', () => {
      expect(claimed().startedIn(runner(), pinned, noon).ranIn).toBe(pinned);
    });

    it('rejects the image from a runner that does not lease it, or while nobody does', () => {
      expect(() =>
        claimed().startedIn(runner('runner_2'), pinned, noon),
      ).toThrow(InvalidRunTransitionError);
      expect(() => queued().startedIn(runner(), pinned, noon)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('rejects an image not named by its digest', () => {
      expect(() =>
        claimed().startedIn(
          runner(),
          RunnerImage.of('ghcr.io/acme/widgets:1'),
          noon,
        ),
      ).toThrow(/by digest/);
    });

    it('rejects a digest of another image than its line names', () => {
      const inWidgets = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...orderedFor.spec(),
        spec: aSpec('sh'),
        placement: RunnerPlacement.anywhere().in(
          RunnerImage.of('ghcr.io/acme/widgets:main'),
        ),
      }).claim(claimer(runner()), noon);

      expect(inWidgets.startedIn(runner(), pinned, noon).ranIn).toBe(pinned);
      expect(() =>
        inWidgets.startedIn(
          runner(),
          RunnerImage.of(`ghcr.io/acme/other@sha256:${'e'.repeat(64)}`),
          noon,
        ),
      ).toThrow(/runs in ghcr.io\/acme\/widgets:main/);
    });

    it('clears the image once it goes back on the queue', () => {
      const started = claimed().startedIn(runner(), pinned, noon);

      expect(
        started.expireLease(started.leaseExpiresAt as Date).ranIn,
      ).toBeNull();
    });
  });

  describe('failing', () => {
    const failedRun = () =>
      claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: ExitCode.of(1), failed: true }),
        HandoverReport.none(),
        noon,
      );

    it('ends failed, not superseded, when it exits badly while its task still has it as its current run', () => {
      expect(failedRun().state).toBe('failed');
      expect(failedRun().outcome?.failure?.code).toBe('exited');
    });
  });

  describe('keeping to its order', () => {
    const ordered = (
      ordering: ReturnType<typeof orderedFor.holdingTurn>,
      spec: Partial<RunSpecParts> = {},
      extra: { apiGrant?: RunApiGrant | null } = {},
    ) =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        ...ordering,
        ...extra,
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          resume: {},
          ...spec,
        }),
      });

    it('refuses a working copy of another requester', () => {
      expect(() =>
        ordered({
          ...orderedFor.spec(),
          workingCopy: orderedFor.holdingTurn('task_1').workingCopy,
        }),
      ).toThrow(InvalidRunOrderError);
    });

    it('refuses to act beyond itself when its policy keeps it to itself', () => {
      for (const spec of [
        { injectedSecrets: ['LINEAR_API_KEY'] },
        {
          manifest: [
            {
              name: 'pull-request',
              description: '',
              inputs: [],
              approval: null,
            },
          ],
        },
        { catalog: ['linear.comment'] },
        { resume: { sessionId: 'session_1' } },
        { startingPoint: true },
        {
          harnessSetup: {
            files: [],
            mcpServers: [{ name: 'm', command: 'x', args: [], env: [] }],
            askKinds: [],
          },
        },
      ] satisfies Partial<RunSpecParts>[]) {
        expect(() => ordered(orderedFor.isolated(), spec)).toThrow(
          InvalidRunOrderError,
        );
      }

      expect(ordered(orderedFor.isolated()).policy.actsBeyondItself).toBe(
        false,
      );
    });

    it('grants Spotlight’s API exactly when its spec uses it', () => {
      const grant = RunApiGrant.of({
        actingFor: 'user_1',
        scopes: ['plan'],
        lifetimeMs: 60_000,
      });

      expect(() =>
        ordered(orderedFor.conversing(), { spotlightApi: true }),
      ).toThrow(InvalidRunOrderError);
      expect(() =>
        ordered(orderedFor.conversing(), {}, { apiGrant: grant }),
      ).toThrow(InvalidRunOrderError);
      expect(
        ordered(
          orderedFor.conversing(),
          { spotlightApi: true },
          { apiGrant: grant },
        ).apiGrant,
      ).toBe(grant);
    });

    it('records that it asked a person only when its policy records asks', () => {
      const leased = ordered(orderedFor.holdingTurn()).claim(
        claimer(runner()),
        noon,
      );

      expect(() => leased.askedAPersonBy(runner())).toThrow(
        InvalidRunTransitionError,
      );
      expect(
        ordered(orderedFor.isolated())
          .claim(claimer(runner()), noon)
          .askedAPersonBy(runner()).askedAPerson,
      ).toBe(true);
    });

    it('refuses to act beyond itself for a run that keeps to itself', () => {
      expect(() =>
        ordered(orderedFor.isolated()).mayActBeyondItself('push'),
      ).toThrow(RunActsOnlyOnItselfError);
      expect(() =>
        ordered(orderedFor.holdingTurn()).mayActBeyondItself('push'),
      ).not.toThrow();
    });
  });
});
