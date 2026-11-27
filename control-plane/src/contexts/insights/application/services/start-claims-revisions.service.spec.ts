import { LabelledRuns } from '@insights/application/services/labelled-runs.service';
import { StartClaimsRevisions } from '@insights/application/services/start-claims-revisions.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import { REVISION_COOLDOWN_MS } from '@insights/domain/services/revision-trigger';
import {
  clockAt,
  judgesWith,
  NEXT_JUDGE,
  NOW,
  sequence,
  stationWith,
} from '@insights/judge-repair-setup.fake-spec';
import {
  ClaimsRevisionsInMemory,
  JudgeDisagreementsInMemory,
  answeredDisagreement,
  openDisagreement,
} from '@insights/judge-repair.fake-spec';
import { judgeScore } from '@insights/judging.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

const answeredAt = (runId: string, at: Date): JudgeDisagreement =>
  answeredDisagreement(
    runId,
    [
      [1, 'claim-wrong', 'The test sits in another file.'],
      [2, 'judge-right'],
    ],
    at,
  );

const eventOf = (disagreement: JudgeDisagreement) =>
  new JudgeDisagreementAnswered(
    disagreement.id,
    disagreement.runId,
    disagreement.workspaceId,
    disagreement.location,
    disagreement.rubricVersion,
  );

const openedOf = (disagreement: JudgeDisagreement) =>
  new JudgeDisagreementOpened(
    disagreement.id,
    disagreement.runId,
    disagreement.workspaceId,
    disagreement.location,
    disagreement.rubricVersion,
  );

const labelledStation = (runs: number, judgeAgrees: boolean) =>
  stationWith(
    Array.from({ length: runs }, (_, at) => {
      const runId = `labelled_${at}`;
      const accepted = at % 2 === 0;
      const met = accepted || !judgeAgrees;

      return {
        runId,
        acted: accepted ? ('accepted' as const) : ('sent-back' as const),
        scores: [judgeScore(runId, [met, met, met])],
      };
    }),
  );

const setUp = async (
  answered: readonly JudgeDisagreement[],
  change: {
    now?: Date;
    judge?: ReturnType<typeof judgesWith>;
    labelled?: number;
    judgeAgrees?: boolean;
  } = {},
) => {
  const station = await labelledStation(
    change.labelled ?? 40,
    change.judgeAgrees ?? true,
  );
  const disagreements = new JudgeDisagreementsInMemory();
  const revisions = new ClaimsRevisionsInMemory();
  const judges = change.judge ?? judgesWith();
  const ids = sequence('revision');

  for (const each of answered) {
    disagreements.stored.set(each.id.value, each);
  }

  const starting = (now: Date) =>
    new StartClaimsRevisions(
      revisions,
      disagreements,
      judges,
      new StationJudgeReports(judges, station.facts),
      new LabelledRuns(station.facts),
      station.recorder,
      inTransaction,
      ids,
      clockAt(now),
    );

  return {
    disagreements,
    revisions,
    starting: starting(change.now ?? NOW),
    startingAt: starting,
  };
};

const BEFORE = new Date(NOW.getTime() - 60_000);

const SOON = new Date(NOW.getTime() + REVISION_COOLDOWN_MS - 1);

const AFTER = new Date(NOW.getTime() + REVISION_COOLDOWN_MS);

const endAll = async (revisions: ClaimsRevisionsInMemory) => {
  for (const each of revisions.stored.values()) {
    const leased = each.leaseJob(NOW);

    await revisions.save(
      leased
        .reserveJudgeCalls(leased.round, 40)
        .ended({ reason: 'no-gain', now: NOW }),
    );
  }
};

const endFruitless = async (revisions: ClaimsRevisionsInMemory) => {
  for (const each of revisions.stored.values()) {
    if (!each.endedAt) {
      await revisions.save(each.ended({ reason: 'no-candidates', now: NOW }));
    }
  }
};

const three = () =>
  ['run_1', 'run_2', 'run_3'].map((each) => answeredAt(each, BEFORE));

describe('StartClaimsRevisions', () => {
  it('starts a revision once one claim is answered wrong 3 times', async () => {
    const answered = three();
    const { revisions, starting } = await setUp(answered);

    await starting.disagreed(eventOf(answered[2]));

    const [revision] = [...revisions.stored.values()];
    expect(revision?.trigger).toBe('claim-wrong');
    expect(revision?.hasPendingJob).toBe(true);
    expect(revisions.events.map((each) => each.kind)).toEqual([
      'claims-revision.started',
    ]);
  });

  it('never counts the answer of a withdrawn disagreement', async () => {
    const [first, second, third] = three();
    const answered = [first, second, third.withdraw(BEFORE, 'claims-changed')];
    const { revisions, starting } = await setUp(answered);

    await starting.disagreed(eventOf(answered[1]));

    expect(revisions.stored.size).toBe(0);
  });

  it('waits for more answers', async () => {
    const answered = three().slice(0, 2);
    const { revisions, starting } = await setUp(answered);

    await starting.disagreed(eventOf(answered[1]));

    expect(revisions.stored.size).toBe(0);
  });

  it('starts at most one open revision for a station', async () => {
    const answered = three();
    const { revisions, starting } = await setUp(answered);

    await starting.disagreed(eventOf(answered[2]));
    await starting.disagreed(eventOf(answered[2]));

    expect(revisions.stored.size).toBe(1);
  });

  it('waits 7 days after a revision that judged candidates ended', async () => {
    const answered = three();
    const event = eventOf(answered[2]);
    const { disagreements, revisions, starting, startingAt } =
      await setUp(answered);

    await starting.disagreed(event);
    await endAll(revisions);
    for (const each of ['run_4', 'run_5', 'run_6']) {
      const fresh = answeredAt(each, new Date(NOW.getTime() + 60_000));
      disagreements.stored.set(fresh.id.value, fresh);
    }
    await startingAt(SOON).disagreed(event);

    expect(revisions.stored.size).toBe(1);
  });

  it('waits for an answer before it revises the claims of a failing calibration', async () => {
    const { disagreements, revisions, starting } = await setUp([], {
      judgeAgrees: false,
    });
    const opened = openDisagreement('run_1');
    disagreements.stored.set(opened.id.value, opened);

    await starting.disagreed(openedOf(opened));

    expect(revisions.stored.size).toBe(0);

    const answered = answeredAt('run_1', BEFORE);
    disagreements.stored.set(answered.id.value, answered);
    await starting.disagreed(eventOf(answered));

    expect([...revisions.stored.values()][0]?.trigger).toBe(
      'calibration-failed',
    );
  });

  it('starts nothing while too few labelled runs are held out', async () => {
    const answered = three();
    const { revisions, starting } = await setUp(answered, { labelled: 4 });

    await starting.disagreed(eventOf(answered[2]));

    expect(revisions.stored.size).toBe(0);
  });

  it('starts again on the next answer after a revision that judged nothing', async () => {
    const answered = [answeredAt('run_1', BEFORE)];
    const { disagreements, revisions, startingAt } = await setUp(answered, {
      judgeAgrees: false,
    });
    const event = eventOf(answered[0]);
    const later = new Date(NOW.getTime() + 60_000);

    await startingAt(NOW).disagreed(event);
    await endFruitless(revisions);
    await startingAt(later).disagreed(event);

    expect(revisions.stored.size).toBe(1);

    const fresh = answeredAt('run_2', later);
    disagreements.stored.set(fresh.id.value, fresh);
    await startingAt(later).disagreed(eventOf(fresh));

    expect(revisions.stored.size).toBe(2);
  });

  it('after the cooldown, counts only answers newer than the last revision', async () => {
    const answered = three();
    const event = eventOf(answered[2]);
    const { disagreements, revisions, starting, startingAt } =
      await setUp(answered);

    await starting.disagreed(event);
    await endAll(revisions);
    await startingAt(AFTER).disagreed(event);

    expect(revisions.stored.size).toBe(1);

    for (const each of ['run_4', 'run_5', 'run_6']) {
      const fresh = answeredAt(each, AFTER);
      disagreements.stored.set(fresh.id.value, fresh);
    }
    await startingAt(AFTER).disagreed(event);

    expect(revisions.stored.size).toBe(2);
  });

  it('starts nothing for answers about claims that changed since', async () => {
    const answered = three();
    const { revisions, starting } = await setUp(answered, {
      judge: judgesWith(NEXT_JUDGE),
    });

    await starting.disagreed(eventOf(answered[2]));

    expect(revisions.stored.size).toBe(0);
  });
});
