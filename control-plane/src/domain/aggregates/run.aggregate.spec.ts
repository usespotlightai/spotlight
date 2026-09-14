import { Run } from '@domain/aggregates/run.aggregate';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import { RunStopRequested } from '@domain/events/run-stop-requested.event';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import { Declaration } from '@domain/value-objects/declaration.vo';
import { HandoverReport } from '@domain/value-objects/handover-report.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunPriority } from '@domain/value-objects/run-priority.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const aSpec = (executable = 'sh') =>
  RunSpec.of({
    command: { executable, args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station', keep: true },
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

const openedFor = (target: string) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: aSpec('claude'),
    targetRunner: runner(target),
  });

const claimed = (by = runner(), when = noon) => queued().claim(by, when);

const onAttempt = (attempt: number, leaseUntil: Date) =>
  Run.rehydrate({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.normal,
    taskId: null,
    stationId: null,
    spec: aSpec(),
    targetRunner: null,
    state: 'claimed',
    claimedBy: RunnerId.of('runner_1'),
    leaseExpiresAt: leaseUntil,
    result: null,
    attempt,
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
    expect(ended.result).toEqual(RunOutcome.of({ exitCode: 0, failed: false }));
    expect(ended.leaseExpiresAt).toBeNull();
  });

  it('calls a failing run failed even though it reported an exit code', () => {
    const ended = claimed().complete(
      runner(),
      RunOutcome.of({ exitCode: 2, failed: true, message: 'no push' }),
    );

    expect(ended.state).toBe('failed');
    expect(ended.result?.message).toBe('no push');
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

  describe('opened against one runner', () => {
    it('is claimable by the runner it was opened for', () => {
      const run = openedFor('runner_2').claim(runner('runner_2'), noon);

      expect(run.state).toBe('claimed');
      expect(run.claimedBy?.value).toBe('runner_2');
    });

    it('refuses a runner it was not opened for', () => {
      const run = openedFor('runner_2');

      expect(() => run.claim(runner('runner_1'), noon)).toThrow(
        InvalidRunTransitionError,
      );
      expect(run.state).toBe('queued');
    });

    it('still belongs to that runner after being requeued', () => {
      const again = openedFor('runner_2')
        .claim(runner('runner_2'), noon)
        .requeue(at('2026-08-23T12:05:00.000Z'));

      expect(again.targetRunner?.value).toBe('runner_2');
      expect(() => again.claim(runner('runner_1'), noon)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  it('lets any runner claim a run opened against none', () => {
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
      expect(completed.result.failed).toBe(false);
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

      expect(ended.result).toEqual(
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
});
