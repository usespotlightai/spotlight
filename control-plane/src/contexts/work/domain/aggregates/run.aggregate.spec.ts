import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
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

const lostAndRequeued = (run: Run) => run.requeue(run.leaseExpiresAt as Date);

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
    expect(given.outcome?.failure?.code).toBe('runner-lost');
    const events = given.pullEvents();
    expect(events.some((each) => each instanceof RunAbandoned)).toBe(true);
  });

  it('goes back on the queue while it still has attempts left, letting go of the runner it lapsed on', () => {
    const lapsedAt = at('2026-08-28T12:00:00.000Z');
    const first = onAttempt(1, lapsedAt);
    const requeuedAt = new Date(lapsedAt.getTime() + 600_000);

    const again = first.requeue(requeuedAt);

    expect(again.state).toBe('queued');
    expect(again.pullEvents()).toEqual([
      new RunLapsed(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        RunnerId.of('runner_1'),
        requeuedAt,
        1,
      ),
    ]);
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

  it('forgets its start when it goes back on the queue, so a run that never starts again has none', () => {
    const image = RunnerImage.of(
      `ghcr.io/acme/widgets@sha256:${'e'.repeat(64)}`,
    );
    const started = claimed().startedIn(runner(), image, noon);

    expect(lostAndRequeued(started).startedAt).toBeNull();
    expect(claimed().unclaimedBy(runner()).startedAt).toBeNull();
    expect(started.handedBack(runner(), noon, 'no room').startedAt).toBeNull();
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

  it('ends as stopped instead of going back on the queue when its runner was lost after it was asked to stop', () => {
    const stopping = claimed().requestStop(noon);
    stopping.pullEvents();

    const ended = stopping.requeue(stopping.leaseExpiresAt as Date);

    expect(ended.hasEnded).toBe(true);
    expect(ended.state).not.toBe('queued');
    expect(ended.outcome?.stopped).toBe(true);
    expect(ended.outcome?.exitCode).toBe(-1);
    expect(ended.attempt).toBe(1);
    expect(
      ended.pullEvents().some((each) => each instanceof RunCompleted),
    ).toBe(true);
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

  it('lets its runner act on the attempt it holds, and on no attempt it has left behind', () => {
    const held = claimed();
    const first = held.currentAttempt;
    const reclaimed = lostAndRequeued(held).claim(
      runner(),
      at('2026-08-28T12:00:00.000Z'),
    );

    expect(() => held.assertStillOn(first, runner())).not.toThrow();
    expect(() => lostAndRequeued(held).assertStillOn(first, runner())).toThrow(
      RunAttemptOverError,
    );
    expect(() => reclaimed.assertStillOn(first, runner())).toThrow(
      RunAttemptOverError,
    );
    expect(() =>
      reclaimed.assertStillOn(reclaimed.currentAttempt, runner()),
    ).not.toThrow();
    expect(() =>
      held.assertStillOn(first, RunnerId.of('runner_other')),
    ).toThrow(RunAttemptOverError);
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
            approval: null,
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

  describe('knowing which workspace to restore', () => {
    const working = (
      subject: RunSubject | null,
      continuity: { key: string; sessionId?: string },
    ) =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        subject,
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'do the thing',
          handover: { options: [], noteLimit: 4_000 },
          continuity,
        }),
      });

    const aTask = RunSubject.task(
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TaskRevision.of(1),
    );
    const aChat = RunSubject.chat(ChatId.of('chat_1'));

    it('restores a task’s workspace whether or not a conversation carries on', () => {
      expect(working(aTask, { key: 'task-task_1' }).restoresFrom?.value).toBe(
        'task-task_1',
      );
      expect(
        working(aTask, { key: 'task-task_1', sessionId: 'session_1' })
          .restoresFrom?.value,
      ).toBe('task-task_1');
    });

    it('restores a chat’s workspace only to carry its conversation on', () => {
      expect(working(aChat, { key: 'chat-chat_1' }).restoresFrom).toBeNull();
      expect(
        working(aChat, { key: 'chat-chat_1', sessionId: 'session_1' })
          .restoresFrom?.value,
      ).toBe('chat-chat_1');
    });

    it('restores nothing for work that does not carry on', () => {
      expect(working(null, { key: ' ' }).restoresFrom).toBeNull();
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
        SecretName.of('LINEAR_API_KEY'),
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

    it('says which memories it was briefed with once enqueued, and nothing when it was told none', () => {
      const briefed = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        spec: aSpec(),
        briefedWith: BriefedMemories.of({
          briefed: [{ id: 'memory_1', handle: 'M-1' }],
          cut: [],
        }),
      });

      expect(briefed.pullEvents().map((each) => each.kind)).toEqual([
        'run.briefed',
      ]);
      expect(queued().pullEvents()).toEqual([]);
    });

    it('is held only by the runner that claimed it, and only until it ends', () => {
      const held = claimed();

      expect(held.isHeldBy(runner())).toBe(true);
      expect(held.isHeldBy(runner('runner_2'))).toBe(false);
      expect(queued().isHeldBy(runner())).toBe(false);
      expect(
        held
          .complete(runner(), RunOutcome.of({ exitCode: 0, failed: false }))
          .isHeldBy(runner()),
      ).toBe(false);
    });

    it('is never reserved for a pool runner when it reaches Spotlight’s API, since only egress wears its token', () => {
      const reaching = Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'set up',
          handover: { options: [], noteLimit: 4_000 },
          continuity: { key: 'chat:chat_1' },
          spotlightApi: true,
        }),
      });

      expect(reaching.provisionableAt(noon)).toBe(false);
      expect(reaching.provisionableAt(noon, true)).toBe(true);
      expect(
        reaching.claim(runner(), noon).reachesSpotlightApiFor(runner()),
      ).toBe(true);
      expect(
        reaching
          .claim(runner(), noon)
          .reachesSpotlightApiFor(runner('runner_2')),
      ).toBe(false);
    });

    it('wears nothing its spec does not name', () => {
      expect(claimed().secretsWornFor(runner())).toEqual([]);
    });

    it('is never reserved for a runner a pool provisions, which has no egress to wear them', () => {
      expect(wearing().wearsSecrets).toBe(true);
      expect(wearing().provisionableAt(noon)).toBe(false);
      expect(() =>
        wearing().reservedFor(runner(), PoolId.of('pool_1'), noon),
      ).toThrow(InvalidRunTransitionError);
      expect(
        queued().reservedFor(runner(), PoolId.of('pool_1'), noon).reservation,
      ).not.toBeNull();
    });

    it('is reserved for a runner a pool provisions when the pool names an egress to wear them', () => {
      expect(wearing().provisionableAt(noon, true)).toBe(true);
      expect(
        wearing().reservedFor(runner(), PoolId.of('pool_1'), noon, true)
          .reservation,
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

    it('names the attempt its runner worked, also once it has ended, but none after the runner lost it', () => {
      const held = claimed();
      const ended = held.complete(
        runner(),
        RunOutcome.of({ exitCode: 0, failed: false }),
      );

      expect(ended.attemptWorkedBy(runner())?.equals(held.currentAttempt)).toBe(
        true,
      );
      expect(ended.attemptWorkedBy(runner('runner_2'))).toBeNull();
      expect(lostAndRequeued(held).attemptWorkedBy(runner())).toBeNull();
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

  describe('being unclaimed when its runner could not take it', () => {
    it('goes back on the queue as it was, counting neither an attempt nor a hand-back', () => {
      const before = queued();
      const unclaimed = claimed().unclaimedBy(runner());

      expect(unclaimed.state).toBe('queued');
      expect(unclaimed.claimedBy).toBeNull();
      expect(unclaimed.leaseExpiresAt).toBeNull();
      expect(unclaimed.attempt).toBe(before.attempt);
      expect(unclaimed.handBacks).toEqual(before.handBacks);
      expect(unclaimed.claimableAt(noon)).toBe(true);
      expect(unclaimed.pullEvents()).toEqual([]);
    });

    it('is unclaimed only by the runner that claimed it', () => {
      expect(() => claimed().unclaimedBy(runner('runner_2'))).toThrow(
        InvalidRunTransitionError,
      );
      expect(() => queued().unclaimedBy(runner())).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('cannot be unclaimed once it has started', () => {
      const started = claimed().startedIn(
        runner(),
        RunnerImage.of(`ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`),
        noon,
      );

      expect(() => started.unclaimedBy(runner())).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being handed back before it starts', () => {
    const DOWN = 'connect ECONNREFUSED';
    const laterBy = (ms: number) => new Date(noon.getTime() + ms);

    it('waits to be claimed again without spending an attempt', () => {
      const back = claimed().handedBack(runner(), noon, DOWN);

      expect(back.state).toBe('queued');
      expect(back.claimedBy).toBeNull();
      expect(back.leaseExpiresAt).toBeNull();
      expect(back.attempt).toBe(1);
      expect(back.pullEvents()).toEqual([]);
    });

    it('is not claimed again until its back-off has passed', () => {
      const back = claimed().handedBack(runner(), noon, DOWN);

      expect(back.claimableAt(laterBy(4_999))).toBe(false);
      expect(back.provisionableAt(laterBy(4_999))).toBe(false);
      expect(back.claimableAt(laterBy(5_000))).toBe(true);
      expect(back.provisionableAt(laterBy(5_000))).toBe(true);
      expect(back.claim(runner('runner_2'), laterBy(5_000)).state).toBe(
        'claimed',
      );
    });

    it('waits twice as long each time it is handed back', () => {
      let run = claimed();
      const waits: number[] = [];

      for (let each = 0; each < 5; each++) {
        run = run.handedBack(runner(), noon, DOWN);
        waits.push(
          (run.handBacks.claimableFrom?.getTime() ?? 0) - noon.getTime(),
        );
        run = run.claim(runner(), noon);
      }

      expect(waits).toEqual([5_000, 10_000, 20_000, 40_000, 80_000]);
    });

    it('ends failed, saying its hooks could not be asked, the sixth time it is handed back', () => {
      let run = claimed();

      for (let each = 0; each < 5; each++) {
        run = run.handedBack(runner(), noon, DOWN).claim(runner(), noon);
      }
      run.pullEvents();

      const ended = run.handedBack(runner(), noon, DOWN);

      expect(ended.state).toBe('failed');
      expect(ended.outcome?.message).toBe(
        `Hooks did not answer after 6 tries. Last error: ${DOWN}`,
      );
      expect(ended.pullEvents()[0]).toBeInstanceOf(RunCompleted);
    });

    it('ends stopped, not queued, when a stop was asked for while its hooks were asked', () => {
      const stopping = claimed().requestStop(noon);
      stopping.pullEvents();

      const ended = stopping.handedBack(runner(), noon, DOWN);

      expect(ended.state).toBe('completed');
      expect(ended.outcome?.stopped).toBe(true);
      expect(ended.claimedBy).toBeNull();
      const [completed] = ended.pullEvents();
      expect(completed).toBeInstanceOf(RunCompleted);
      expect((completed as RunCompleted).outcome.stopped).toBe(true);
    });

    it('starts counting afresh on a later attempt', () => {
      const back = claimed()
        .handedBack(runner(), noon, DOWN)
        .claim(runner(), laterBy(5_000));

      expect(lostAndRequeued(back).handBacks.count).toBe(0);
    });

    it('is handed back only by the runner that claimed it', () => {
      expect(() =>
        claimed().handedBack(runner('runner_2'), noon, DOWN),
      ).toThrow(InvalidRunTransitionError);
      expect(() => queued().handedBack(runner(), noon, DOWN)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being refused to start by a hook', () => {
    const REASON = 'The hook core/freeze refused: deploys are frozen.';

    it('ends failed with the hook’s reason, worked by nobody', () => {
      const refused = claimed().refusedToStart(runner(), REASON);

      expect(refused.state).toBe('failed');
      expect(refused.outcome?.message).toBe(REASON);
      expect(refused.claimedBy).toBeNull();
      expect(refused.wasWorkedBy(runner())).toBe(false);

      const [completed] = refused.pullEvents();
      expect(completed).toBeInstanceOf(RunCompleted);
      expect((completed as RunCompleted).outcome.failed).toBe(true);
      expect((completed as RunCompleted).workedBy).toBeNull();
    });

    it('is refused only by the runner that claimed it', () => {
      expect(() =>
        claimed().refusedToStart(runner('runner_2'), REASON),
      ).toThrow(InvalidRunTransitionError);
    });

    it('cannot be refused before a runner claims it', () => {
      expect(() => queued().refusedToStart(runner(), REASON)).toThrow(
        InvalidRunTransitionError,
      );
    });
  });

  describe('being withdrawn before a runner takes it up', () => {
    it('ends a queued run as superseded, since its task moved on without it', () => {
      const withdrawn = queued().withdrawn('The task moved on.');

      expect(withdrawn.state).toBe('superseded');
      expect(withdrawn.outcome?.failure?.code).toBe('superseded');
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

    it('goes back on the queue when its host times it out, as for a lapsed lease, and is given up on as timed out', () => {
      let run = queued();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        run = run.claim(runner(), noon).timedOut(runner(), noon);
        expect(run.state).toBe('queued');
      }

      const given = run.claim(runner(), noon).timedOut(runner(), noon);
      const events = given.pullEvents();
      const abandoned = events.find(
        (each): each is RunAbandoned => each instanceof RunAbandoned,
      );

      expect(abandoned?.failure).toBe('timed-out');
      expect(given.outcome?.failure?.code).toBe('timed-out');
      expect(events.some((each) => each instanceof RunLapsed)).toBe(true);
      expect(() =>
        queued().claim(runner(), noon).timedOut(RunnerId.of('elsewhere'), noon),
      ).toThrow();
    });

    it('says so when it is given up on', () => {
      let run = queued();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        run = run.claim(runner(), noon).requeue(at('2026-08-23T12:05:00.000Z'));
      }

      const raised = run
        .pullEvents()
        .filter((each) => each instanceof RunAbandoned);

      expect(raised).toHaveLength(1);
      expect((raised[0] as RunAbandoned).attempt).toBe(3);
      expect((raised[0] as RunAbandoned).failure).toBe('runner-lost');
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
      queued().reservedFor(runner('pooled_1'), PoolId.of('burst'), noon);

    it('holds itself for the provisioned runner for five minutes', () => {
      const run = reserved();

      expect(run.reservation?.runner.value).toBe('pooled_1');
      expect(run.reservation?.pool.value).toBe('burst');
      expect(run.reservation?.until).toEqual(later(5 * 60_000));
      expect(run.isReservedAt(later(5 * 60_000 - 1))).toBe(true);
      expect(run.isReservedAt(later(5 * 60_000))).toBe(false);
    });

    it('is provisionable only while queued, open, unreserved and wearing no secrets', () => {
      expect(queued().provisionableAt(noon)).toBe(true);
      expect(reserved().provisionableAt(noon)).toBe(false);
      expect(claimed().provisionableAt(noon)).toBe(false);
    });

    it('refuses to be reserved twice', () => {
      expect(() =>
        reserved().reservedFor(runner('pooled_2'), PoolId.of('burst'), noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('refuses to be reserved once a runner holds it', () => {
      expect(() =>
        claimed().reservedFor(runner('pooled_1'), PoolId.of('burst'), noon),
      ).toThrow(InvalidRunTransitionError);
    });

    it('refuses another runner while the reservation holds', () => {
      expect(() => reserved().claim(runner('runner_9'), later(1_000))).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('lets another runner take it once the reservation lapses, letting go of the runner reserved', () => {
      const run = reserved().claim(runner('runner_9'), later(5 * 60_000));

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
      const run = reserved().claim(runner('pooled_1'), later(1_000));

      expect(run.state).toBe('claimed');
      expect(run.claimedBy?.value).toBe('pooled_1');
      expect(run.reservation).toBeNull();
      expect(run.pullEvents()).toEqual([]);
    });

    it('knows its reservation lapsed only once it is behind it while still queued', () => {
      expect(reserved().reservationLapsedAt(later(1_000))).toBe(false);
      expect(reserved().reservationLapsedAt(later(5 * 60_000))).toBe(true);
      expect(queued().reservationLapsedAt(later(5 * 60_000))).toBe(false);
    });

    it('drops its reservation when unreserved by its runner, letting the runner go', () => {
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

    it('lets its provisioned runner go when withdrawn', () => {
      const run = reserved().withdrawn('The task moved on.');

      expect(run.reservation).toBeNull();
      expect(run.pullEvents().map((each) => each.kind)).toEqual([
        'run.reservation-dropped',
        'run.withdrawn',
      ]);
    });

    it('lets its provisioned runner go when refused', () => {
      const run = reserved().refused(
        RunOutcome.refused([{ saying: 'The plan lapsed.' }]),
      );

      expect(run.reservation).toBeNull();
      expect(run.pullEvents().map((each) => each.kind)).toEqual([
        'run.reservation-dropped',
        'run.completed',
      ]);
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
        .reservedFor(pooled, PoolId.of('burst'), due)
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
        'No runner was provisioned after 5 attempts. Last failure: refused: the pool said no',
      );

      const completed = run
        .pullEvents()
        .filter((each) => each instanceof RunCompleted);
      expect(completed).toHaveLength(1);
      expect((completed[0] as RunCompleted).workedBy).toBeNull();
    });

    it('only lets go of the runner reserved for it while it still has tries left', () => {
      expect(failedAgain(queued()).pullEvents()).toEqual([
        new RunReservationDropped(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          pooled,
        ),
      ]);
    });

    it('is refused by a provisioned runner without its harness, and by no other', () => {
      const run = queued().reservedFor(pooled, PoolId.of('burst'), noon);

      expect(
        run.provisionRefusedBy(pooled, [HarnessId.of('claude-code')]),
      ).toEqual(ProvisionFailure.harnessMissing('dev'));
      expect(run.provisionRefusedBy(pooled, [HarnessId.of('dev')])).toBeNull();
      expect(
        run.provisionRefusedBy(runner('pooled_2'), [
          HarnessId.of('claude-code'),
        ]),
      ).toBeNull();
      expect(
        queued().provisionRefusedBy(pooled, [HarnessId.of('claude-code')]),
      ).toBeNull();
    });

    it('counts no failure when another runner reports one', () => {
      const run = queued().reservedFor(pooled, PoolId.of('burst'), noon);

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

    it('keeps the image its holder says it started in', () => {
      expect(claimed().startedIn(runner(), pinned, noon).ranIn).toBe(pinned);
    });

    it('refuses the image from a runner that does not hold it, or while nobody does', () => {
      expect(() =>
        claimed().startedIn(runner('runner_2'), pinned, noon),
      ).toThrow(InvalidRunTransitionError);
      expect(() => queued().startedIn(runner(), pinned, noon)).toThrow(
        InvalidRunTransitionError,
      );
    });

    it('refuses an image not named by its digest', () => {
      expect(() =>
        claimed().startedIn(
          runner(),
          RunnerImage.of('ghcr.io/acme/widgets:1'),
          noon,
        ),
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

      expect(inWidgets.startedIn(runner(), pinned, noon).ranIn).toBe(pinned);
      expect(() =>
        inWidgets.startedIn(
          runner(),
          RunnerImage.of(`ghcr.io/acme/other@sha256:${'e'.repeat(64)}`),
          noon,
        ),
      ).toThrow(/runs in ghcr.io\/acme\/widgets:main/);
    });

    it('forgets the image once it goes back on the queue', () => {
      const started = claimed().startedIn(runner(), pinned, noon);

      expect(started.requeue(started.leaseExpiresAt as Date).ranIn).toBeNull();
    });
  });

  describe('superseded by its task', () => {
    const failedRun = () =>
      claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: 1, failed: true }),
      );

    it('supersedes a failure its task has since moved on from', () => {
      const failed = failedRun();
      failed.pullEvents();
      const superseded = failed.supersededByItsTask();

      expect(superseded.state).toBe('superseded');
      expect(superseded.hasEnded).toBe(true);
      expect(superseded.outcome?.failure?.code).toBe('superseded');
      expect(superseded.outcome?.message).toBe(failed.outcome?.message);
      expect(superseded.pullEvents().map((each) => each.kind)).toEqual([
        'run.superseded',
      ]);
    });

    it('leaves a run that succeeded, is still going, or was already superseded as it was', () => {
      const succeeded = claimed().complete(
        runner(),
        RunOutcome.of({ exitCode: 0, failed: false }),
      );
      const superseded = failedRun().supersededByItsTask();

      expect(succeeded.supersededByItsTask()).toBe(succeeded);
      expect(claimed().supersededByItsTask().state).toBe('claimed');
      expect(superseded.supersededByItsTask()).toBe(superseded);
    });

    it('ends failed, not superseded, when it exits badly while its task still holds it', () => {
      expect(failedRun().state).toBe('failed');
      expect(failedRun().outcome?.failure?.code).toBe('exited');
    });
  });
});
