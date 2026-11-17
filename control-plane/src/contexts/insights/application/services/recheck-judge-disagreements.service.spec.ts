import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RaiseJudgeDisagreements } from '@insights/application/services/raise-judge-disagreements.service';
import {
  RECHECKED_AT_ONCE,
  RecheckJudgeDisagreements,
} from '@insights/application/services/recheck-judge-disagreements.service';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { day, taskPullRequestOf } from '@insights/insights.fake-spec';
import {
  judgesWith,
  NOW,
  sequence,
} from '@insights/judge-repair-setup.fake-spec';
import { JudgeDisagreementsInMemory } from '@insights/judge-repair.fake-spec';
import { judgeScore, ScoresInMemory } from '@insights/judging.fake-spec';
import { PullRequestRecordsInMemory } from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it, vi } from 'vitest';

const HOUR_MS = 60 * 60_000;

const setUp = async () => {
  let now = NOW;
  const clock = { now: () => now, sleep: async () => {} };
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const pullRequests = new PullRequestRecordsInMemory();
  await pullRequests.add(
    taskPullRequestOf('task_1', {
      openedAt: day('2026-09-30', 9),
      closedAt: day('2026-09-30', 13),
    }),
  );
  const facts = new StationFactsInMemory(records, { scores, pullRequests });
  const disagreements = new JudgeDisagreementsInMemory();
  const raising = new RaiseJudgeDisagreements(
    disagreements,
    facts,
    judgesWith(),
    new FactRecorder(deletionsInMemory()),
    inTransaction,
    sequence('disagreement'),
    clock,
  );
  const logger: LoggerPort = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const recheck = new RecheckJudgeDisagreements(
    raising,
    disagreements,
    facts,
    clock,
    logger,
  );
  const visit = (runId: string, hour: number) =>
    records.add(
      endedRecord(runId, {
        taskId: 'task_1',
        endedAt: day('2026-09-30', hour),
      }),
    );
  const judged = async (runId: string, at = day('2026-09-30', 14)) => {
    const score = judgeScore(runId, [true, false, false], {
      taskId: 'task_1',
      at,
    });
    await scores.add(score);
    return score;
  };
  const recorded = (score: Score) =>
    raising.scoreRecorded(
      new ScoreRecorded(
        score.id,
        score.runId,
        WORKSPACE,
        score.location,
        score.origin,
      ),
    );
  const stored = () => [...disagreements.stored.values()];

  return {
    facts,
    logger,
    raising,
    recheck,
    swept: async () => {
      for (let tick = 0; tick < 5; tick += 1) {
        await recheck.processDue();
      }
    },
    visit,
    judged,
    recorded,
    stored,
    later: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

describe('RecheckJudgeDisagreements', () => {
  it('withdraws a standing disagreement whose label is gone though no event said so', async () => {
    const { swept, visit, judged, recorded, stored } = await setUp();
    await visit('run_1', 10);
    await recorded(
      await judged('run_1', new Date(NOW.getTime() - 31 * 24 * HOUR_MS)),
    );
    expect(stored()[0]?.labelFrom).toBe('merged');

    await visit('run_2', 12);
    await swept();

    expect(stored()[0]?.state).toBe('withdrawn');
    expect(stored()[0]?.withdrawnBecause).toBe('label-gone');
  });

  it('opens a disagreement that no event opened', async () => {
    const { swept, visit, judged, stored } = await setUp();
    await visit('run_1', 10);
    await judged('run_1');

    await swept();

    expect(stored()).toHaveLength(1);
    expect(stored()[0]?.labelFrom).toBe('merged');
    expect(stored()[0]?.state).not.toBe('withdrawn');
  });

  it('leaves a run alone when its judge verdict is older than 30 days', async () => {
    const { swept, visit, judged, stored } = await setUp();
    await visit('run_1', 10);
    await judged('run_1', new Date(NOW.getTime() - 31 * 24 * HOUR_MS));

    await swept();

    expect(stored()).toHaveLength(0);
  });

  it('checks one page each time, and starts again only after six hours', async () => {
    const { raising, recheck, swept, judged, later } = await setUp();
    for (let each = 0; each <= RECHECKED_AT_ONCE; each += 1) {
      await judged(`run_${String(each).padStart(3, '0')}`);
    }
    const reconsider = vi.spyOn(raising, 'reconsider');
    const checked = () => reconsider.mock.calls.map(([runs]) => runs.length);

    await recheck.processDue();
    await recheck.processDue();
    expect(checked()).toEqual([0, RECHECKED_AT_ONCE]);

    await swept();
    expect(checked()).toEqual([0, RECHECKED_AT_ONCE, 1]);

    later(5 * HOUR_MS);
    await swept();
    expect(checked()).toHaveLength(3);

    later(HOUR_MS);
    await swept();
    expect(checked()).toEqual([
      0,
      RECHECKED_AT_ONCE,
      1,
      0,
      RECHECKED_AT_ONCE,
      1,
    ]);
  });

  it('reads the same page again on the next tick when the read fails', async () => {
    const { facts, swept, visit, judged, stored } = await setUp();
    await visit('run_1', 10);
    await judged('run_1');
    const liveJudgedSince = facts.liveJudgedSince.bind(facts);
    let failures = 1;
    facts.liveJudgedSince = async (criteria) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error('The verdicts could not be read');
      }
      return liveJudgedSince(criteria);
    };

    await expect(swept()).rejects.toThrow('The verdicts could not be read');
    await swept();

    expect(stored()).toHaveLength(1);
  });

  it('checks the other runs when one fails, and names the one that failed', async () => {
    const { facts, logger, swept, visit, judged, stored } = await setUp();
    await visit('run_1', 10);
    await visit('run_2', 8);
    await judged('run_1');
    await judged('run_2');
    const scoresOfRuns = facts.scoresOfRuns.bind(facts);
    facts.scoresOfRuns = async (runIds: readonly RunId[]) => {
      if (runIds.some((each) => each.value === 'run_2')) {
        throw new Error('The scores could not be read');
      }
      return scoresOfRuns(runIds);
    };

    await swept();

    expect(stored().map((each) => each.runId.value)).toEqual(['run_1']);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ failed: 1, runIds: ['run_2'] }),
      'Some judge disagreements could not be checked again',
    );
  });
});
