import type { GradesPort } from '@insights/application/ports/grades.port';
import { GradeInboxRequests } from '@insights/application/services/grade-inbox-requests.service';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { sampledForGrading } from '@insights/domain/services/judge-sampling';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { judgeScore, personGrade } from '@insights/judging.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  StationFactsInMemory,
} from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-30T12:00:00.000Z');

const runIds = (count: number, sampled: boolean): string[] =>
  Array.from({ length: 400 }, (_, at) => `run_${at}`)
    .filter((each) => sampledForGrading(RunId.of(each)) === sampled)
    .slice(0, count);

const [SAMPLED, OTHER_SAMPLED] = runIds(2, true);

const [NOT_SAMPLED] = runIds(1, false);

class GradesSpy implements GradesPort {
  readonly asked: string[] = [];
  readonly resolved: string[] = [];

  async ask(_: unknown, runId: RunId): Promise<void> {
    this.asked.push(runId.value);
  }

  async resolve(_: unknown, runId: RunId): Promise<void> {
    this.resolved.push(runId.value);
  }
}

const setUp = (scores: readonly Score[], acceptedRuns: readonly string[]) => {
  const records = new RunRecordsInMemory();

  for (const score of scores) {
    const record = endedRecord(score.runId.value);
    records.stored.set(
      score.runId.value,
      acceptedRuns.includes(score.runId.value)
        ? record.recordAction(
            HumanAction.of('accepted', new Date('2026-09-30T11:00:00.000Z')),
          )
        : record,
    );
  }

  const grades = new GradesSpy();
  const service = new GradeInboxRequests(
    grades,
    new StationFactsInMemory(records, {
      scores: { stored: new Map(scores.map((each) => [each.id.value, each])) },
    }),
    { now: () => NOW, sleep: async () => {} },
  );

  return { grades, service };
};

const recordedOf = (score: Score): ScoreRecorded =>
  score.pullEvents()[0] as ScoreRecorded;

describe('GradeInboxRequests', () => {
  it('asks for a grade of a sampled run when few judged runs have an outcome', async () => {
    const score = judgeScore(SAMPLED, [true, true, true]);
    const { grades, service } = setUp([score], []);

    await service.recorded(recordedOf(score));

    expect(grades.asked).toEqual([SAMPLED]);
  });

  it('asks for no grade when most judged runs already have an outcome', async () => {
    const score = judgeScore(SAMPLED, [true, true, true]);
    const other = judgeScore(OTHER_SAMPLED, [true, true, true]);
    const { grades, service } = setUp([score, other], [SAMPLED, OTHER_SAMPLED]);

    await service.recorded(recordedOf(score));

    expect(grades.asked).toEqual([]);
  });

  it('asks for no grade of a run outside the sample', async () => {
    const score = judgeScore(NOT_SAMPLED, [true, true, true]);
    const { grades, service } = setUp([score], []);

    await service.recorded(recordedOf(score));

    expect(grades.asked).toEqual([]);
  });

  it('asks for no grade of a backfill score', async () => {
    const score = judgeScore(SAMPLED, [true, true, true], {
      origin: 'backfill',
    });
    const { grades, service } = setUp([score], []);

    await service.recorded(recordedOf(score));

    expect(grades.asked).toEqual([]);
  });

  it('closes the request when a person grades the run', async () => {
    const grade = personGrade(SAMPLED, [true, true, true]);
    const { grades, service } = setUp([], []);

    await service.recorded(recordedOf(grade));

    expect(grades.resolved).toEqual([SAMPLED]);
  });
});
