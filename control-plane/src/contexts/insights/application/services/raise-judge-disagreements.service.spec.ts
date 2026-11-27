import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RaiseJudgeDisagreements } from '@insights/application/services/raise-judge-disagreements.service';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { JudgeDisagreementVersionConflictError } from '@insights/domain/exceptions/judge-disagreement-version-conflict.error';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { day, ownedRecordOf } from '@insights/insights.fake-spec';
import {
  type Acted,
  ACTOR,
  clockAt,
  judgeOf,
  judgesWith,
  NEXT_JUDGE,
  sequence,
  stationWith,
} from '@insights/judge-repair-setup.fake-spec';
import {
  JudgeDisagreementsInMemory,
  openDisagreement,
} from '@insights/judge-repair.fake-spec';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import { PullRequestRecordsInMemory } from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  StationFactsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { firstOf } from '@shared-kernel/domain/item-at';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const recordedOf = (score: Score): ScoreRecorded =>
  new ScoreRecorded(
    score.id,
    score.runId,
    WORKSPACE,
    score.location,
    score.origin,
  );

const setUp = async (
  acted: Acted,
  scores: readonly Score[],
  judge = judgesWith(),
) => {
  const station = await stationWith([{ runId: 'run_1', acted, scores }]);
  const disagreements = new JudgeDisagreementsInMemory();
  const raising = new RaiseJudgeDisagreements(
    disagreements,
    station.facts,
    judge,
    station.recorder,
    inTransaction,
    sequence('disagreement'),
    clockAt(),
  );

  return { disagreements, raising, station };
};

const FAILED = () => judgeScore('run_1', [true, false, false]);

const PASSED = () => judgeScore('run_1', [true, true, true]);

describe('RaiseJudgeDisagreements', () => {
  it('opens a disagreement where the live judge failed a run a person accepted', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp('accepted', [score]);

    await raising.scoreRecorded(recordedOf(score));

    const disagreement = firstOf([...disagreements.stored.values()]);
    expect(disagreement?.direction).toBe('judge-failed');
    expect(disagreement?.labelFrom).toBe('accepted');
    expect(disagreement?.disputedClaims).toEqual([1, 2]);
    expect(disagreement?.verdict.scoreId).toEqual(score.id);
    expect(disagreement?.askedOf).toEqual(ACTOR);
    expect(disagreements.events.map((each) => each.kind)).toEqual([
      'judge-disagreement.opened',
    ]);
  });

  it('opens a disagreement where the live judge passed a run a person sent back', async () => {
    const score = PASSED();
    const { disagreements, raising } = await setUp('sent-back', [score]);

    await raising.scoreRecorded(recordedOf(score));

    expect([...disagreements.stored.values()][0]?.direction).toBe(
      'judge-passed',
    );
    expect([...disagreements.stored.values()][0]?.askedOf).toEqual(ACTOR);
  });

  it('opens at most one disagreement for a run', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp('accepted', [score]);

    await raising.scoreRecorded(recordedOf(score));
    await raising.outcomeChanged(
      new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
    );

    expect(disagreements.stored.size).toBe(1);
  });

  it('opens nothing where the judge and the person agree', async () => {
    const score = PASSED();
    const { disagreements, raising } = await setUp('accepted', [score]);

    await raising.scoreRecorded(recordedOf(score));

    expect(disagreements.stored.size).toBe(0);
  });

  it('opens nothing before the run has a label', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp(null, [score]);

    await raising.scoreRecorded(recordedOf(score));

    expect(disagreements.stored.size).toBe(0);
  });

  it('opens nothing for a backfill score', async () => {
    const score = judgeScore('run_1', [true, false, false], {
      origin: 'backfill',
    });
    const { disagreements, raising } = await setUp('accepted', [score]);

    await raising.scoreRecorded(recordedOf(score));

    expect(disagreements.stored.size).toBe(0);
  });

  it('opens nothing for a score of claims that changed since', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp(
      'accepted',
      [score],
      judgesWith(NEXT_JUDGE),
    );

    await raising.scoreRecorded(recordedOf(score));

    expect(disagreements.stored.size).toBe(0);
  });

  it('asks the person who took the run’s deciding action, whatever the task’s history holds', async () => {
    const score = FAILED();
    const { disagreements, raising, station } = await setUp('accepted', [
      score,
    ]);
    station.taskActions.stored.clear();

    await raising.scoreRecorded(recordedOf(score));

    expect([...disagreements.stored.values()][0]?.askedOf).toEqual(ACTOR);
  });

  it('withdraws the open disagreements of a station whose claims changed, and keeps them while the claims stay', async () => {
    const score = FAILED();
    let judge = judgeOf();
    const { disagreements, raising } = await setUp('accepted', [score], {
      judgeAt: () => Promise.resolve(judge),
      judgesOnTeam: () => Promise.resolve(new Map()),
    });
    await raising.scoreRecorded(recordedOf(score));
    const changed = {
      workspaceId: WORKSPACE.value,
      deleted: false,
      stationIds: [score.location.stationId.value],
    };

    await raising.lineChanged(changed);
    expect([...disagreements.stored.values()][0]?.state).toBe('open');

    judge = NEXT_JUDGE;
    await raising.lineChanged(changed);
    expect([...disagreements.stored.values()][0]).toMatchObject({
      state: 'withdrawn',
      withdrawnBecause: 'claims-changed',
    });
  });

  it('withdraws every outdated disagreement of a station, more than one batch holds', async () => {
    const { disagreements, raising } = await setUp('accepted', [], {
      judgeAt: () => Promise.resolve(NEXT_JUDGE),
      judgesOnTeam: () => Promise.resolve(new Map()),
    });
    const outdated = Array.from({ length: 250 }, (_, at) =>
      openDisagreement(`run_${at + 2}`),
    );
    for (const each of outdated) {
      each.pullEvents();
      disagreements.stored.set(each.id.value, each);
    }

    await raising.lineChanged({
      workspaceId: WORKSPACE.value,
      deleted: false,
      stationIds: [openDisagreement('run_0').location.stationId.value],
    });

    expect(
      [...disagreements.stored.values()].every((each) => each.isWithdrawn),
    ).toBe(true);
    expect(disagreements.events.map((each) => each.kind)).toEqual(
      outdated.map(() => 'judge-disagreement.withdrawn'),
    );
  });

  it('opens a new disagreement under new claims once the old one is withdrawn', async () => {
    const score = FAILED();
    let judge = judgeOf();
    const { disagreements, raising, station } = await setUp(
      'accepted',
      [score],
      {
        judgeAt: () => Promise.resolve(judge),
        judgesOnTeam: () => Promise.resolve(new Map()),
      },
    );
    await raising.scoreRecorded(recordedOf(score));
    judge = NEXT_JUDGE;
    const next = judgeScore('run_1', [false], {
      rubricVersion: NEXT_RUBRIC_VERSION,
    });
    await station.scores.add(next);

    await raising.scoreRecorded(recordedOf(next));

    const stored = [...disagreements.stored.values()];
    expect(
      stored.map((each) => [
        each.rubricVersion,
        each.state,
        each.withdrawnBecause,
      ]),
    ).toEqual([
      [score.rubricVersion, 'withdrawn', 'claims-changed'],
      [NEXT_RUBRIC_VERSION, 'open', null],
    ]);
  });

  it('opens one disagreement when two subscribers try at once, and the late one ends quietly', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp('accepted', [score]);
    disagreements.ofRun = () => Promise.resolve([]);

    await raising.scoreRecorded(recordedOf(score));
    await expect(
      raising.outcomeChanged(
        new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
      ),
    ).resolves.toBeUndefined();

    expect(disagreements.stored.size).toBe(1);
  });

  it('opens a disagreement when a person acts after the judge scored', async () => {
    const score = FAILED();
    const { disagreements, raising } = await setUp('accepted', [score]);

    await raising.outcomeChanged(
      new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
    );

    expect(disagreements.stored.size).toBe(1);
  });

  it('never compares a backfill score of new claims', async () => {
    const score = judgeScore('run_1', [true, false, false], {
      rubricVersion: NEXT_RUBRIC_VERSION,
      origin: 'backfill',
    });
    const { disagreements, raising } = await setUp(
      'accepted',
      [score],
      judgesWith(NEXT_JUDGE),
    );

    await raising.outcomeChanged(
      new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
    );

    expect(disagreements.stored.size).toBe(0);
  });

  describe('on a task whose pull request merged', () => {
    const onTheTask = async () => {
      const records = new RunRecordsInMemory();
      const scores = new ScoresInMemory();
      const pullRequests = new PullRequestRecordsInMemory();
      await pullRequests.add(
        ownedRecordOf('task_1', {
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
        clockAt(),
      );
      const score = judgeScore('run_1', [true, false, false], {
        taskId: 'task_1',
      });
      await scores.add(score);
      const endedRun = (runId: string, hour: number, stationId?: string) =>
        endedRecord(runId, {
          taskId: 'task_1',
          stationId,
          endedAt: day('2026-09-30', hour),
        });
      const added = async (record: RunRecord) => {
        const events = record.pullEvents();
        await records.add(record);
        return events;
      };

      return {
        records,
        pullRequests,
        disagreements,
        raising,
        score,
        endedRun,
        added,
      };
    };

    it('withdraws the disagreement a merge opened once a person sends the run back, since people now agree with the judge', async () => {
      const { records, disagreements, raising, score, endedRun, added } =
        await onTheTask();
      const run = endedRun('run_1', 10);
      await added(run);
      await raising.scoreRecorded(recordedOf(score));

      expect([...disagreements.stored.values()][0]?.labelFrom).toBe('merged');

      await records.save(
        run.recordAction(
          PersonAction.of('sent-back', day('2026-09-30', 14), ACTOR),
        ),
      );
      await raising.outcomeChanged(
        new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
      );

      const disagreement = firstOf([...disagreements.stored.values()]);
      expect(disagreement?.state).toBe('withdrawn');
      expect(disagreement?.withdrawnBecause).toBe('verdicts-agree');
    });

    it('keeps the disagreement a merge opened, still asked of the team, once a person accepts the run', async () => {
      const { records, disagreements, raising, score, endedRun, added } =
        await onTheTask();
      const run = endedRun('run_1', 10);
      await added(run);
      await raising.scoreRecorded(recordedOf(score));

      await records.save(
        run.recordAction(
          PersonAction.of('accepted', day('2026-09-30', 14), ACTOR),
        ),
      );
      await raising.outcomeChanged(
        new RunOutcomeChanged(RunId.of('run_1'), WORKSPACE, score.location),
      );

      const stored = [...disagreements.stored.values()];
      expect(stored).toHaveLength(1);
      expect(stored[0]?.state).toBe('open');
      expect(stored[0]?.labelFrom).toBe('merged');
      expect(stored[0]?.askedOf).toBeNull();
    });

    it('withdraws the first run’s disagreement once a later run of the station completes and takes the merge', async () => {
      const { disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      await raising.scoreRecorded(recordedOf(score));
      expect([...disagreements.stored.values()][0]?.labelFrom).toBe('merged');

      const [ended] = await added(endedRun('run_2', 12));
      await raising.runEnded(instanceOf(RunRecordEnded, ended));

      const disagreement = firstOf([...disagreements.stored.values()]);
      expect(disagreement?.state).toBe('withdrawn');
      expect(disagreement?.withdrawnBecause).toBe('label-gone');
    });

    it('withdraws a disagreement it opened while a later run took the merge', async () => {
      const { disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      const opened = disagreements.add.bind(disagreements);
      disagreements.add = async (disagreement) => {
        await added(endedRun('run_2', 12));
        await opened(disagreement);
      };

      await raising.scoreRecorded(recordedOf(score));

      const disagreement = firstOf([...disagreements.stored.values()]);
      expect(disagreement?.state).toBe('withdrawn');
      expect(disagreement?.withdrawnBecause).toBe('label-gone');
    });

    it('withdraws again when another writer changed the disagreement meanwhile, and leaves a second conflict to the event retry', async () => {
      const { disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      await raising.scoreRecorded(recordedOf(score));
      const [ended] = await added(endedRun('run_2', 12));
      const saved = disagreements.save.bind(disagreements);
      let conflicts = 0;
      disagreements.save = (disagreement) => {
        conflicts += 1;
        return Promise.reject(
          new JudgeDisagreementVersionConflictError(disagreement.id.value),
        );
      };

      await expect(
        raising.runEnded(instanceOf(RunRecordEnded, ended)),
      ).rejects.toThrow(JudgeDisagreementVersionConflictError);
      expect(conflicts).toBe(2);

      disagreements.save = saved;
      await raising.runEnded(instanceOf(RunRecordEnded, ended));
      expect([...disagreements.stored.values()][0]?.state).toBe('withdrawn');
    });

    it('leaves the merge with a station’s run when a run at another station of the task ends', async () => {
      const { disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      await raising.scoreRecorded(recordedOf(score));
      const [ended] = await added(endedRun('run_2', 12, 'station_2'));

      await raising.runEnded(instanceOf(RunRecordEnded, ended));

      expect([...disagreements.stored.values()][0]?.state).not.toBe(
        'withdrawn',
      );
    });

    it('ends quietly when another subscriber withdrew the disagreement first', async () => {
      const { disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      await raising.scoreRecorded(recordedOf(score));
      const [ended] = await added(endedRun('run_2', 12));
      const saved = disagreements.save.bind(disagreements);
      disagreements.save = async (disagreement) => {
        disagreements.save = saved;
        await saved(disagreement);
        await saved(disagreement);
      };

      await expect(
        raising.runEnded(instanceOf(RunRecordEnded, ended)),
      ).resolves.toBeUndefined();
      expect([...disagreements.stored.values()][0]?.state).toBe('withdrawn');
    });

    it('withdraws the first run’s disagreement when the pull request closes after a later run completed', async () => {
      const { pullRequests, disagreements, raising, score, endedRun, added } =
        await onTheTask();
      await added(endedRun('run_1', 10));
      await raising.scoreRecorded(recordedOf(score));
      await added(endedRun('run_2', 12));
      const [merged] = [...pullRequests.stored.values()];

      await raising.pullRequestClosed(
        new PullRequestRecordClosed(
          WORKSPACE,
          merged.pullRequest,
          TaskId.of('task_1'),
          TEAM,
          true,
        ),
      );

      expect([...disagreements.stored.values()][0]?.withdrawnBecause).toBe(
        'label-gone',
      );
    });

    it('considers only the runs of the event’s workspace', async () => {
      const { disagreements, raising, endedRun, added } = await onTheTask();
      const [ended] = await added(endedRun('run_1', 10));
      const event = instanceOf(RunRecordEnded, ended);

      await raising.runEnded(
        new RunRecordEnded(event.runId, WorkspaceId.of('ws_2'), event.location),
      );

      expect(disagreements.stored.size).toBe(0);
    });
  });
});
