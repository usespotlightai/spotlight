import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const aSpec = (executable = 'sh') =>
  RunSpec.of({
    command: { executable, args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station' },
  });

const at = (iso: string) => new Date(iso);
const noon = at('2026-08-23T12:00:00.000Z');

const runner = (id = 'runner_1') => RunnerId.of(id);

const queued = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: aSpec('sh'),
  });

const claimed = (by = runner(), when = noon) => queued().claim(by, when);

const onAttempt = (attempt: number, leaseUntil: Date) =>
  Run.rehydrate({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.normal,
    subject: null,
    spec: aSpec(),
    state: 'claimed',
    claimedBy: RunnerId.of('runner_1'),
    leaseExpiresAt: leaseUntil,
    outcome: null,
    attempt,
    reservation: null,
    provisioning: Provisioning.none(),
  });

describe('Run', () => {
  it('gives up rather than requeueing for ever', () => {
    const lapsedAt = at('2026-08-28T12:00:00.000Z');
    const spent = onAttempt(3, lapsedAt);

    const given = spent.requeue(new Date(lapsedAt.getTime() + 600_000));

    expect(given.state).toBe('failed');
    const events = given.pullEvents();
    expect(events.some((each) => each instanceof RunAbandoned)).toBe(true);
  });

  it('goes back on the queue while it still has attempts left', () => {
    const lapsedAt = at('2026-08-28T12:00:00.000Z');
    const first = onAttempt(1, lapsedAt);

    const again = first.requeue(new Date(lapsedAt.getTime() + 600_000));

    expect(again.state).toBe('queued');
    const events = again.pullEvents();
    expect(events.some((each) => each instanceof RunAbandoned)).toBe(false);
  });

  it('starts queued, unclaimed and on its first attempt', () => {
    const run = queued();

    expect(run.state).toBe('queued');
    expect(run.claimedBy).toBeNull();
    expect(run.attempt).toBe(1);
  });

  it('takes a claimant and a lease when claimed', () => {
    const run = claimed();

    expect(run.state).toBe('claimed');
    expect(run.claimedBy).toEqual(runner());
    expect(run.leaseExpiresAt?.getTime()).toBeGreaterThan(noon.getTime());
  });

  it('leaves the run it was claimed from on the queue', () => {
    const waiting = queued();

    waiting.claim(runner(), noon);

    expect(waiting.state).toBe('queued');
    expect(waiting.claimedBy).toBeNull();
  });

  it('cannot be claimed twice', () => {
    const run = claimed();

    expect(() => run.claim(runner('runner_2'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('lapses only once its lease is behind it', () => {
    const run = claimed();
    const lease = run.leaseExpiresAt as Date;

    expect(run.lapsed(new Date(lease.getTime() - 1))).toBe(false);
    expect(run.lapsed(lease)).toBe(true);
  });

  it('is never lapsed while it sits on the queue', () => {
    expect(queued().lapsed(at('2027-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('goes back on the queue for someone else, counting the attempt', () => {
    const held = claimed();

    const again = held.requeue(held.leaseExpiresAt as Date);

    expect(again.state).toBe('queued');
    expect(again.claimedBy).toBeNull();
    expect(again.leaseExpiresAt).toBeNull();
    expect(again.attempt).toBe(2);
  });

  it('refuses to be requeued while its lease still holds', () => {
    const run = claimed();

    expect(() => run.requeue(noon)).toThrow(InvalidRunTransitionError);
  });

  it('lets the runner holding it push the lease out', () => {
    const held = claimed();

    const renewed = held.renewLease(runner(), at('2026-08-23T12:00:30.000Z'));

    expect((renewed.leaseExpiresAt as Date).getTime()).toBeGreaterThan(
      (held.leaseExpiresAt as Date).getTime(),
    );
  });

  it('refuses a lease renewal from a runner that does not hold it', () => {
    const run = claimed();

    expect(() => run.renewLease(runner('someone_else'), noon)).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('refuses to be completed by a runner that does not hold it', () => {
    const run = claimed();

    expect(() =>
      run.complete(
        runner('someone_else'),
        RunOutcome.of({ exitCode: 0, failed: false }),
      ),
    ).toThrow(InvalidRunTransitionError);
  });

  it('records what a finished run produced, and drops the lease', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: 0, failed: false }),
    );

    expect(ended.state).toBe('completed');
    expect(ended.outcome).toEqual(
      RunOutcome.of({ exitCode: 0, failed: false }),
    );
    expect(ended.leaseExpiresAt).toBeNull();
  });

  it('calls a failing run failed even though it reported an exit code', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: 2, failed: true, message: 'no push' }),
    );

    expect(ended.state).toBe('failed');
    expect(ended.outcome?.message).toBe('no push');
  });

  it('cannot be completed once it already is', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: 0, failed: false }),
    );

    expect(() =>
      ended.complete(runner(), RunOutcome.of({ exitCode: 0, failed: false })),
    ).toThrow(InvalidRunTransitionError);
  });

  it('lets any runner claim a queued run nobody reserved', () => {
    expect(queued().claim(runner('runner_9'), noon).claimedBy?.value).toBe(
      'runner_9',
    );
  });

  it('refuses anyone but its holder to act on it', () => {
    const run = claimed(runner('runner_1'));

    expect(() => run.assertHeldBy(runner('runner_2'))).toThrow(
      InvalidRunTransitionError,
    );
    expect(() => run.assertHeldBy(runner('runner_1'))).not.toThrow();
  });

  it('refuses anyone to act on a run nobody holds', () => {
    expect(() => queued().assertHeldBy(runner())).toThrow(
      InvalidRunTransitionError,
    );
  });

  it('goes back on the queue when its claimant can no longer serve it', () => {
    const released = claimed().release();

    expect(released.state).toBe('queued');
    expect(released.claimedBy).toBeNull();
    expect(released.leaseExpiresAt).toBeNull();
    expect(released.attempt).toBe(2);
  });

  it('refuses to release a run nobody is holding', () => {
    expect(() => queued().release()).toThrow(InvalidRunTransitionError);
  });

  describe('keeping a journal', () => {
    it('journals under the attempt its holder is working', () => {
      const journal = claimed().journalFor(runner());

      expect(journal.runId.value).toBe('run_1');
      expect(journal.number).toBe(1);
    });

    it('refuses a journal from a runner that does not hold it', () => {
      expect(() => claimed().journalFor(runner('runner_2'))).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('refuses a journal for a run nobody holds', () => {
      expect(() => queued().journalFor(runner())).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('knowing what it was given', () => {
    const given = (...tools: string[]) =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          continuity: { key: 'task:station' },
          manifest: tools.map((name) => ({
            name,
            description: name,
            inputs: [],
          })),
        }),
      });

    it('was given a tool its spec names', () => {
      expect(given('pull-request').wasGiven(Tool.of('pull-request'))).toBe(
        true,
      );
    });

    it('was not given a tool its spec leaves out', () => {
      expect(given('pull-request').wasGiven(Tool.of('linear.comment'))).toBe(
        false,
      );
    });

    it('was given nothing where its spec names no tools', () => {
      expect(queued().wasGiven(Tool.of('pull-request'))).toBe(false);
    });
  });

  describe('knowing the secrets it wears', () => {
    const wearing = () =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          continuity: { key: 'task:station' },
          wears: ['LINEAR_API_KEY'],
        }),
      });

    it('wears them for the runner holding it', () => {
      expect(wearing().claim(runner(), noon).secretsWornFor(runner())).toEqual([
        'LINEAR_API_KEY',
      ]);
    });

    it('wears nothing for another runner, while it waits, or once it has ended', () => {
      const held = wearing().claim(runner(), noon);

      expect(held.secretsWornFor(runner('runner_2'))).toEqual([]);
      expect(wearing().secretsWornFor(runner())).toEqual([]);
      expect(
        held
          .complete(runner(), RunOutcome.of({ exitCode: 0, failed: false }))
          .secretsWornFor(runner()),
      ).toEqual([]);
    });

    it('wears nothing its spec does not name', () => {
      expect(claimed().secretsWornFor(runner())).toEqual([]);
    });

    it('is never reserved for a runner a pool provisions, which has no egress to wear them', () => {
      expect(wearing().wearsSecrets).toBe(true);
      expect(() => wearing().reservedFor(runner(), 'pool_1', noon)).toThrow(
        InvalidRunTransitionError,
      );
      expect(
        queued().reservedFor(runner(), 'pool_1', noon).reservation,
      ).not.toBeNull();
    });
  });

  describe('knowing who worked it', () => {
    it('was worked by the runner that claimed it, even once it has ended', () => {
      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: 0, failed: false }),
      );

      expect(ended.wasWorkedBy(runner())).toBe(true);
      expect(ended.wasWorkedBy(runner('runner_2'))).toBe(false);
    });

    it('was worked by nobody while it waits', () => {
      expect(queued().wasWorkedBy(runner())).toBe(false);
    });
  });

  describe('being refused before a runner takes it up', () => {
    const LAPSED = RunOutcome.refused([
      CatalogWithheld.of({
        id: 'catalog.web-search@1.1.0',
        reason: 'lapsed',
        because:
          'catalog.web-search@1.1.0 needs the Team plan, and this workspace is on the Free plan',
      }),
    ]);

    it('ends failed, saying why, so whoever handed it over hears of it', () => {
      const refused = queued().refused(LAPSED);

      expect(refused.state).toBe('failed');
      expect(refused.outcome?.message).toBe(
        'entitlement_lapsed: catalog.web-search@1.1.0 needs the Team plan, and this workspace is on the Free plan',
      );

      const [completed] = refused.pullEvents();
      expect(completed).toBeInstanceOf(RunCompleted);
      expect((completed as RunCompleted).workedBy).toBeNull();
    });

    it('cannot be refused once a runner holds it', () => {
      expect(() => claimed().refused(LAPSED)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being withdrawn before a runner takes it up', () => {
    it('ends a queued run as withdrawn, not as abandoned', () => {
      const withdrawn = queued().withdrawn('The task moved on.');

      expect(withdrawn.state).toBe('failed');
      expect(withdrawn.hasEnded).toBe(true);
      expect(withdrawn.outcome?.message).toBe('The task moved on.');
      expect(withdrawn.pullEvents().map((each) => each.kind)).toEqual([
        'run.withdrawn',
      ]);
    });

    it('refuses to withdraw a run that is already being worked', () => {
      expect(() => claimed().withdrawn('The task moved on.')).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being asked to stop', () => {
    it('records when a person asked a claimed run to stop', () => {
      const asked = claimed().requestStop(at('2026-08-23T12:00:30.000Z'));

      expect(asked.stopRequested).toBe(true);
      expect(asked.stopRequestedAt).toEqual(at('2026-08-23T12:00:30.000Z'));
    });

    it('announces the request so it is a fact of the model', () => {
      const [raised] = claimed()
        .requestStop(at('2026-08-23T12:00:30.000Z'))
        .pullEvents();

      expect(raised).toBeInstanceOf(RunStopRequested);
      expect((raised as RunStopRequested).runId).toEqual(RunId.of('run_1'));
    });

    it('is not stop-requested until someone asks', () => {
      expect(claimed().stopRequested).toBe(false);
    });

    it('refuses to stop a run that is not being worked', () => {
      expect(() => queued().requestStop(noon)).toThrow(
        InvalidRunTransitionError,
      );

      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: 0, failed: false }),
      );
      expect(() => ended.requestStop(noon)).toThrow(InvalidRunTransitionError);
    });

    it('keeps the first ask when told twice', () => {
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
          RunOutcome.of({ exitCode: 0, failed: false }),
          HandoverReport.of({
            declared: Declaration.of({ next: 'Spec', note: 'ready' }),
            session: HarnessSession.of('session_1'),
          }),
        )
        .pullEvents();

      expect(raised).toBeInstanceOf(RunCompleted);
      const completed = raised as RunCompleted;
      expect(completed.runId).toEqual(RunId.of('run_1'));
      expect(completed.outcome.failed).toBe(false);
      expect(completed.workedBy).toEqual(runner());
      expect(completed.declared?.next).toBe('Spec');
      expect(completed.session?.value).toBe('session_1');
    });

    it('keeps nothing of what it announced', () => {
      const ended = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: 0, failed: false }),
        HandoverReport.of({ session: HarnessSession.of('session_1') }),
      );

      expect(ended.outcome).toEqual(
        RunOutcome.of({ exitCode: 0, failed: false }),
      );
    });

    it('says so when it is given up on', () => {
      let run = queued();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        run = run.claim(runner(), noon).requeue(at('2026-08-23T12:05:00.000Z'));
      }

      const events = run.pullEvents();
      const [raised] = events;

      expect(raised).toBeInstanceOf(RunAbandoned);
      expect((raised as RunAbandoned).attempt).toBe(3);
      expect(events.some((each) => each instanceof RunAbandoned)).toBe(true);
    });

    it('leaves the run it was completed from with nothing to announce', () => {
      const held = claimed();

      held.complete(runner(), RunOutcome.of({ exitCode: 0, failed: false }));

      expect(held.pullEvents()).toHaveLength(0);
      expect(held.state).toBe('claimed');
    });
  });

  describe('waiting for a runner provisioned for it', () => {
    const later = (ms: number) => new Date(noon.getTime() + ms);
    const reserved = () =>
      queued().reservedFor(runner('pooled_1'), 'burst', noon);

    it('holds itself for the provisioned runner for five minutes', () => {
      const run = reserved();

      expect(run.reservation?.runner.value).toBe('pooled_1');
      expect(run.reservation?.pool).toBe('burst');
      expect(run.reservation?.until).toEqual(later(5 * 60_000));
      expect(run.isReservedAt(later(5 * 60_000 - 1))).toBe(true);
      expect(run.isReservedAt(later(5 * 60_000))).toBe(false);
    });

    it('is provisionable only while queued, open and unreserved', () => {
      expect(queued().provisionableAt(noon)).toBe(true);
      expect(reserved().provisionableAt(noon)).toBe(false);
      expect(claimed().provisionableAt(noon)).toBe(false);
    });

    it('refuses to be reserved twice', () => {
      expect(() =>
        reserved().reservedFor(runner('pooled_2'), 'burst', noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('refuses to be reserved once a runner holds it', () => {
      expect(() =>
        claimed().reservedFor(runner('pooled_1'), 'burst', noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('refuses another runner while the reservation holds', () => {
      expect(() => reserved().claim(runner('runner_9'), later(1_000))).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('lets another runner take it once the reservation lapses', () => {
      const run = reserved().claim(runner('runner_9'), later(5 * 60_000));

      expect(run.claimedBy?.value).toBe('runner_9');
      expect(run.reservation).toBeNull();
    });

    it('is taken by the provisioned runner, dropping the reservation', () => {
      const run = reserved().claim(runner('pooled_1'), later(1_000));

      expect(run.state).toBe('claimed');
      expect(run.claimedBy?.value).toBe('pooled_1');
      expect(run.reservation).toBeNull();
    });

    it('knows its reservation lapsed only once it is behind it while still queued', () => {
      expect(reserved().reservationLapsedAt(later(1_000))).toBe(false);
      expect(reserved().reservationLapsedAt(later(5 * 60_000))).toBe(true);
      expect(queued().reservationLapsedAt(later(5 * 60_000))).toBe(false);
    });

    it('drops its reservation when unreserved by its runner', () => {
      const run = reserved().unreservedFor(runner('pooled_1'));

      expect(run.reservation).toBeNull();
      expect(run.provisionableAt(noon)).toBe(true);
    });

    it('keeps its reservation when another runner lets it go', () => {
      const run = reserved();

      expect(run.unreservedFor(runner('pooled_2'))).toBe(run);
    });

    it('is left as it is when unreserved with nothing reserved', () => {
      const run = queued();

      expect(run.unreservedFor(runner('pooled_1'))).toBe(run);
    });

    it('is left as it is when unreserved once a runner holds it', () => {
      const run = claimed(runner('pooled_1'));

      expect(run.unreservedFor(runner('pooled_1'))).toBe(run);
    });
  });

  describe('failing to be provisioned', () => {
    const later = (ms: number) => new Date(noon.getTime() + ms);
    const refused = ProvisionFailure.of('refused', 'the pool said no');
    const pooled = runner('pooled_1');
    const failedAgain = (run: Run) => {
      const due = run.provisioning.nextAt ?? noon;

      return run
        .reservedFor(pooled, 'burst', due)
        .provisionFailed(pooled, refused, due);
    };

    it('stays queued, unreserved and backs off before the next try', () => {
      const run = failedAgain(queued());

      expect(run.state).toBe('queued');
      expect(run.reservation).toBeNull();
      expect(run.provisioning.failures).toBe(1);
      expect(run.provisioning.nextAt).toEqual(later(5_000));
      expect(run.provisionableAt(later(4_999))).toBe(false);
      expect(run.provisionableAt(later(5_000))).toBe(true);
    });

    it('backs off longer after each failure', () => {
      const twice = failedAgain(failedAgain(queued()));

      expect(twice.provisioning.nextAt).toEqual(later(15_000));
    });

    it('fails for good after five failures, saying why', () => {
      let run = queued();
      for (let failure = 0; failure < 5; failure += 1) {
        run = failedAgain(run);
      }

      expect(run.state).toBe('failed');
      expect(run.hasEnded).toBe(true);
      expect(run.outcome?.failed).toBe(true);
      expect(run.outcome).toEqual(RunOutcome.unprovisioned(refused, 5));
      expect(run.outcome?.message).toBe(
        'No runner was provisioned for it in 5 attempts; the last was refused: the pool said no',
      );

      const events = run.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RunCompleted);
      expect((events[0] as RunCompleted).workedBy).toBeNull();
    });

    it('announces nothing while it still has tries left', () => {
      expect(failedAgain(queued()).pullEvents()).toHaveLength(0);
    });

    it('counts no failure when another runner reports one', () => {
      const run = queued().reservedFor(pooled, 'burst', noon);

      expect(run.provisionFailed(runner('pooled_2'), refused, noon)).toBe(run);
    });

    it('counts no failure when nothing is reserved for it', () => {
      const run = queued();

      expect(run.provisionFailed(pooled, refused, noon)).toBe(run);
    });

    it('counts no failure once a runner holds it', () => {
      const run = claimed(pooled);

      expect(run.provisionFailed(pooled, refused, noon)).toBe(run);
    });

    it('starts provisioning afresh when requeued', () => {
      const again = failedAgain(queued())
        .claim(runner(), later(5_000))
        .requeue(later(10 * 60_000));

      expect(again.provisioning.failures).toBe(0);
      expect(again.provisioning.nextAt).toBeNull();
      expect(again.reservation).toBeNull();
    });

    it('starts provisioning afresh when released', () => {
      const again = failedAgain(queued())
        .claim(runner(), later(5_000))
        .release();

      expect(again.provisioning.failures).toBe(0);
      expect(again.provisionableAt(later(5_000))).toBe(true);
    });
  });

  describe('recording the image it runs in', () => {
    const pinned = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );

    it('runs in no image it knows of until its runner says', () => {
      expect(claimed().ranIn).toBeNull();
    });

    it('keeps the image its holder says it started in', () => {
      expect(claimed().startedIn(runner(), pinned).ranIn).toBe(pinned);
    });

    it('refuses the image from a runner that does not hold it, or while nobody does', () => {
      expect(() => claimed().startedIn(runner('runner_2'), pinned)).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => queued().startedIn(runner(), pinned)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('refuses an image not named by its digest', () => {
      expect(() =>
        claimed().startedIn(runner(), RunnerImage.of('ghcr.io/acme/widgets:1')),
      ).toThrow(/by digest/);
    });

    it('refuses a digest of another image than its line names', () => {
      const inWidgets = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        spec: aSpec('sh'),
        placement: RunnerPlacement.anywhere().in(
          RunnerImage.of('ghcr.io/acme/widgets:main'),
        ),
      }).claim(runner(), noon);

      expect(inWidgets.startedIn(runner(), pinned).ranIn).toBe(pinned);
      expect(() =>
        inWidgets.startedIn(
          runner(),
          RunnerImage.of(`ghcr.io/acme/other@sha256:${'e'.repeat(64)}`),
        ),
      ).toThrow(/runs in ghcr.io\/acme\/widgets:main/);
    });

    it('forgets the image once it goes back on the queue', () => {
      const started = claimed().startedIn(runner(), pinned);

      expect(started.requeue(started.leaseExpiresAt as Date).ranIn).toBeNull();
      expect(started.release().ranIn).toBeNull();
    });
  });
});
