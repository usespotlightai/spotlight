import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { ReplayRunEnded } from '@replays/application/services/record-replay-run-ending.service';
import { RecordReplayRunEnding } from '@replays/application/services/record-replay-run-ending.service';
import { aReplay, FINGERPRINT } from '@replays/domain/replays.fake-spec';
import { resultOf } from '@replays/domain/services/entry-result';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import {
  type ReplaysReactions,
  replaysSubscribers,
} from '@replays/presentation/events/replays.subscribers';
import { RUNS_EVENT_MAPPERS } from '@runs/application/integration-events/runs.event-mappers';
import { claimer } from '@runs/application/ports/run-fixtures.fake-spec';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { RunExtensions } from '@runs/domain/value-objects/run-extensions.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const RUNNER = RunnerId.of('runner_1');
const COMMIT = 'a'.repeat(40);

const replayRun = (id = 'run_1') =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    priority: RunPriority.of(-1),
    now: NOW,
    requester: RunRequester.of({
      owner: 'replays',
      kind: 'replay',
      id,
      team: TeamId.of('team_1'),
    }),
    policy: RunPolicy.of({
      holdsTurn: false,
      gated: false,
      actsBeyondItself: false,
      asks: 'recorded',
      listed: false,
      exclusive: false,
    }),
    workspace: RunWorkspace.of({
      key: WorkspaceKey.of('replays', `replay-${id}`),
      rejoinable: false,
      restores: 'when-continuing',
    }),
    extensions: RunExtensions.of({
      replay: {
        archive: 'archive_1',
        checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
        movesOnAfter: ['build', 'done'],
      },
    }),
    spec: RunSpec.of({
      checkouts: [{ remote: 'spotlight:repository', path: 'api', ref: COMMIT }],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: ['review'], noteLimit: 0 },
      resume: {},
    }),
  });

const receivedBy = async (
  events: readonly DomainEvent[],
): Promise<ReplayRunEnded> => {
  const received: ReplayRunEnded[] = [];
  const subscribers = replaysSubscribers({
    ending: { ended: async (ended: ReplayRunEnded) => received.push(ended) },
  } as unknown as ReplaysReactions);
  const published = events.flatMap((event) =>
    RUNS_EVENT_MAPPERS.filter((each) => each.from === event.kind).flatMap(
      (each) => each.map(event, new Date()) ?? [],
    ),
  );

  for (const event of published) {
    for (const subscriber of subscribers) {
      if (subscriber.kinds.includes(event.kind)) {
        await subscriber.handle(event);
      }
    }
  }

  const [ended] = received;

  if (!ended) {
    throw new Error('Replays never received the run end');
  }

  return ended;
};

const scored = (ended: ReplayRunEnded) =>
  resultOf(
    {
      unreplayableReason: null,
      notRun: false,
      end: RunEnd.of({
        result: ended.outcome,
        failure: ended.failure,
        stopped: ended.stopped,
        asked: ended.askedAPerson,
        next: ended.next,
        at: NOW,
      }),
      measures: null,
      checks: null,
      judging: null,
    },
    { judges: false, checks: false },
  );

describe('how a replay run’s ending becomes its score, from Work’s events to Replays (e2e)', () => {
  it('leaves unscored a replay run no runner finished, after Work used all its attempts', async () => {
    let run = replayRun();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      run = run
        .claim(claimer(RUNNER), NOW)
        .expireLease(new Date(NOW.getTime() + (attempt + 1) * 600_000));
    }

    const ended = await receivedBy(run.pullEvents());

    expect(ended).toMatchObject({
      outcome: 'exhausted',
      failure: 'runner-lost',
    });
    expect(scored(ended)).toMatchObject({
      succeeded: null,
      reasons: [{ code: 'run-failed', detail: 'runner-lost' }],
    });
  });

  it('leaves unscored a replay run that failed before its agent received it', async () => {
    const run = replayRun()
      .claim(claimer(RUNNER), NOW)
      .complete(
        RUNNER,
        RunOutcome.of({ exitCode: -1, failed: true, setupFailed: true }),
        HandoverReport.none(),
        NOW,
      );

    const ended = await receivedBy(run.pullEvents());

    expect(ended).toMatchObject({ outcome: 'failed', failure: 'unprepared' });
    expect(scored(ended).succeeded).toBeNull();
  });

  it('fails a replay run whose agent failed', async () => {
    const run = replayRun()
      .claim(claimer(RUNNER), NOW)
      .complete(
        RUNNER,
        RunOutcome.of({ exitCode: 1, failed: true }),
        HandoverReport.none(),
        NOW,
      );

    const ended = await receivedBy(run.pullEvents());

    expect(ended).toMatchObject({ outcome: 'failed', failure: 'exited' });
    expect(scored(ended).succeeded).toBe(false);
  });
});

describe('a replay run’s ending, stored on its replay through Replays (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await openApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  let nextSlot = 0;

  const storedAfter = async (end: (run: Run) => Run) => {
    const runId = randomUUID();
    const replayId = randomUUID();
    const replays = app.get(DrizzleReplayRepository);

    await replays.add(
      aReplay({ id: replayId, count: 1 })
        .reserving([nextSlot++], () => RunId.of(runId))
        .confirm(RunId.of(runId), FINGERPRINT, NOW),
    );

    const ended = end(replayRun(runId).claim(claimer(RUNNER), NOW));
    const subscribers = replaysSubscribers({
      ending: app.get(RecordReplayRunEnding),
    } as unknown as ReplaysReactions);
    const published = ended
      .pullEvents()
      .flatMap((event) =>
        RUNS_EVENT_MAPPERS.filter((each) => each.from === event.kind).flatMap(
          (each) => each.map(event, new Date()) ?? [],
        ),
      );

    for (const event of published) {
      for (const subscriber of subscribers) {
        if (subscriber.kinds.includes(event.kind)) {
          await subscriber.handle(event);
        }
      }
    }

    const [entry] = (await replays.find(ReplayId.of(replayId)))?.entries ?? [];

    return {
      succeeded: entry?.succeeded,
      reasons: entry?.reasons.map((each) => [each.code, each.detail]),
    };
  };

  it('stores a run whose agent failed as failed', async () => {
    expect(
      await storedAfter((run) =>
        run.complete(
          RUNNER,
          RunOutcome.of({ exitCode: 1, failed: true }),
          HandoverReport.none(),
          NOW,
        ),
      ),
    ).toEqual({ succeeded: false, reasons: [['run-failed', 'exited']] });
  });

  it('stores a run that asked a person as failed', async () => {
    expect(
      await storedAfter((run) =>
        run.askedAPersonBy(RUNNER).complete(
          RUNNER,
          RunOutcome.of({ exitCode: 0, failed: false }),
          HandoverReport.of({
            handover: Handover.of({ next: 'build' }),
            session: null,
          }),
          NOW,
        ),
      ),
    ).toEqual({ succeeded: false, reasons: [['asked-a-person', null]] });
  });

  it('stores a run that failed before its agent received it as unscored', async () => {
    expect(
      await storedAfter((run) =>
        run.complete(
          RUNNER,
          RunOutcome.of({ exitCode: -1, failed: true, setupFailed: true }),
          HandoverReport.none(),
          NOW,
        ),
      ),
    ).toEqual({ succeeded: null, reasons: [['run-failed', 'unprepared']] });
  });

  it('stores a run no runner finished as unscored, and one that kept running past its time as failed', async () => {
    const losingEveryAttempt =
      (lose: (run: Run, at: Date) => Run) => (run: Run) => {
        let lost = lose(run, NOW);
        for (let attempt = 1; attempt < 3; attempt += 1) {
          lost = lose(lost.claim(claimer(RUNNER), NOW), NOW);
        }
        return lost;
      };
    const later = (at: Date) => new Date(at.getTime() + 3_600_000);

    expect(
      await storedAfter(
        losingEveryAttempt((run, at) => run.expireLease(later(at))),
      ),
    ).toEqual({ succeeded: null, reasons: [['run-failed', 'runner-lost']] });
    expect(
      await storedAfter(
        losingEveryAttempt((run, at) => run.timedOut(RUNNER, at)),
      ),
    ).toEqual({ succeeded: false, reasons: [['run-failed', 'timed-out']] });
  });
});
