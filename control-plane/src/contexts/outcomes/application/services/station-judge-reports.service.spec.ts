import type { StationJudge } from '@outcomes/application/ports/evidence.port';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import {
  judgeScore,
  personGrade,
  RUBRIC_VERSION,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const JUDGE: StationJudge = {
  teamId: 'team_1',
  lineId: 'line_1',
  rubric: 'Did the run retry uploads?',
  rubricVersion: RUBRIC_VERSION,
  sample: 1,
  trust: 0.5,
};

const STATION = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  lineId: 'line_1',
  stationId: 'station_1',
};

const reporting = async (judge: StationJudge | null = JUDGE) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();

  for (let at = 0; at < 12; at += 1) {
    const runId = `run_${at}`;
    await records.add(
      endedRecord(runId, { taskId: `task_${runId}` }).actedOn(
        NextAct.of(at % 2 === 0 ? 'approved' : 'sent-back', AT),
      ),
    );
    await scores.add(
      judgeScore(runId, ScoreScale.yesNo(), at % 2 === 0 ? 1 : 0),
    );
  }
  await records.add(endedRecord('run_unjudged', { taskId: 'task_unjudged' }));
  await scores.add(personGrade('run_unjudged', ScoreScale.yesNo(), 1));

  return new StationJudgeReports(
    {
      holds: async () => true,
      of: async () => null,
      judgeAt: async () => judge,
    },
    scores,
    records,
    new TaskDeliveriesInMemory(),
  );
};

describe('StationJudgeReports', () => {
  it('reports how often the station’s judge agrees with people, and trusts it once it agrees enough', async () => {
    const { judge, report, standing } = await (await reporting()).at(STATION);

    expect(judge?.scale?.kind).toBe('yes-no');
    expect(report.versions[0]?.agreement.kappa).toBe(1);
    expect(report.coverage).toEqual({
      runs: 13,
      both: 12,
      judgeOnly: 0,
      peopleOnly: 1,
      neither: 0,
    });
    expect(standing.trusted).toBe(true);
  });

  it('answers Insights whether a station’s judge is trusted', async () => {
    const standing = await (await reporting()).of({
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
    });

    expect(standing).toMatchObject({
      stationId: 'station_1',
      rubricVersion: RUBRIC_VERSION,
      trusted: true,
      measure: 'kappa',
      pairs: 12,
    });
  });

  it('knows no judge of a station on another team', async () => {
    const { judge, standing } = await (
      await reporting({ ...JUDGE, teamId: 'team_2' })
    ).at(STATION);

    expect(judge).toBeNull();
    expect(standing.hiddenBecause).toBe('no-judge');
  });

  it('says so, rather than guessing a scale, where the station’s rubric cannot be read', async () => {
    const { standing } = await (
      await reporting({ ...JUDGE, rubric: 'scores: stars\nHow well?' })
    ).standingAt(STATION);

    expect(standing.hiddenBecause).toBe('unreadable-rubric');
  });

  it('weighs only the current rubric’s scores for the run page’s standing, and names that rubric', async () => {
    expect(await (await reporting()).standingAt(STATION)).toMatchObject({
      rubricVersion: RUBRIC_VERSION,
      standing: { trusted: true, pairs: 12 },
    });
  });
});
