import { BackfillJudgings } from '@insights/application/services/backfill-judgings.service';
import { MAX_LABELLED_RUNS } from '@insights/domain/services/revision-split';
import {
  clockAt,
  judgesWith,
  NEXT_JUDGE,
  NOW,
  type StationRun,
  stationWith,
} from '@insights/judge-repair-setup.fake-spec';
import {
  JudgingsInMemory,
  judgeScore,
  NEXT_RUBRIC_VERSION,
  queuedJudging,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

const LINE_CHANGED = {
  lineId: 'line_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  deleted: false,
  stationIds: ['station_1'],
};

const setUp = async (runs: readonly StationRun[]) => {
  const station = await stationWith(runs);
  const judgings = new JudgingsInMemory();
  const backfilling = new BackfillJudgings(
    judgings,
    station.facts,
    judgesWith(NEXT_JUDGE),
    station.recorder,
    inTransaction,
    clockAt(),
  );

  return { judgings, backfilling };
};

describe('BackfillJudgings', () => {
  it('re-judges the runs that completed or stopped and have people’s verdict, with the new claims, as backfill', async () => {
    const { judgings, backfilling } = await setUp([
      { runId: 'run_1', acted: 'accepted' },
      { runId: 'run_2', acted: null },
      { runId: 'run_3', acted: 'sent-back' },
    ]);
    await judgings.add(queuedJudging('run_1').deadLetter(NOW));

    await backfilling.lineChanged(LINE_CHANGED);

    const run1 = judgings.stored.get('run_1');
    expect([...judgings.stored.keys()].sort()).toEqual(['run_1', 'run_3']);
    expect(run1?.origin).toBe('backfill');
    expect(run1?.rubric.version).toBe(NEXT_RUBRIC_VERSION);
    expect(run1?.hasPendingJob).toBe(true);
    expect(judgings.stored.get('run_3')?.origin).toBe('backfill');
  });

  it('re-judges no run that failed or was superseded, though people sent it back, and re-judges a stopped run a person accepted', async () => {
    const { judgings, backfilling } = await setUp([
      { runId: 'run_1', acted: 'sent-back', ending: 'failed' },
      { runId: 'run_2', acted: 'sent-back', ending: 'superseded' },
      { runId: 'run_3', acted: 'accepted', ending: 'stopped' },
    ]);

    await backfilling.lineChanged(LINE_CHANGED);

    expect([...judgings.stored.keys()]).toEqual(['run_3']);
  });

  it(`re-judges at most the ${MAX_LABELLED_RUNS} newest labelled runs`, async () => {
    const { judgings, backfilling } = await setUp(
      Array.from({ length: MAX_LABELLED_RUNS + 2 }, (_, at) => ({
        runId: `run_${at}`,
        acted: 'accepted' as const,
      })),
    );

    await backfilling.lineChanged(LINE_CHANGED);

    expect(judgings.stored.size).toBe(MAX_LABELLED_RUNS);
  });

  it('re-judges nothing once the new claims have scores', async () => {
    const { judgings, backfilling } = await setUp([
      {
        runId: 'run_1',
        acted: 'accepted',
        scores: [
          judgeScore('run_1', [true], { rubricVersion: NEXT_RUBRIC_VERSION }),
        ],
      },
      { runId: 'run_2', acted: 'accepted' },
    ]);

    await backfilling.lineChanged(LINE_CHANGED);

    expect(judgings.stored.size).toBe(0);
  });

  it('still re-judges where only the old claims have scores', async () => {
    const { judgings, backfilling } = await setUp([
      {
        runId: 'run_1',
        acted: 'accepted',
        scores: [
          judgeScore('run_1', [true, true, true], {
            rubricVersion: RUBRIC_VERSION,
          }),
        ],
      },
    ]);

    await backfilling.lineChanged(LINE_CHANGED);

    expect(judgings.stored.size).toBe(1);
  });

  it('re-judges nothing on a deleted line', async () => {
    const deleted = await setUp([{ runId: 'run_1', acted: 'accepted' }]);

    await deleted.backfilling.lineChanged({ ...LINE_CHANGED, deleted: true });

    expect(deleted.judgings.stored.size).toBe(0);
  });
});
