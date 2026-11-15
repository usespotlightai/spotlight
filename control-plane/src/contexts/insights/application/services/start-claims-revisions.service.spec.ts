import { StartClaimsRevisions } from '@insights/application/services/start-claims-revisions.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
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
} from '@insights/judge-repair.fake-spec';
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

const setUp = async (
  answered: readonly JudgeDisagreement[],
  change: { now?: Date; judge?: ReturnType<typeof judgesWith> } = {},
) => {
  const station = await stationWith([]);
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
    await revisions.save(each.ended({ reason: 'no-gain', now: NOW }));
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

  it('waits 7 days after a revision ended', async () => {
    const answered = three();
    const event = eventOf(answered[2]);
    const { revisions, starting, startingAt } = await setUp(answered);

    await starting.disagreed(event);
    await endAll(revisions);
    await startingAt(SOON).disagreed(event);

    expect(revisions.stored.size).toBe(1);
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
