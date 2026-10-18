import type {
  EvidencePort,
  StationJudge,
} from '@insights/application/ports/evidence.port';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { taskPullRequestOf } from '@insights/domain/insights.fake-spec';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  personGrade,
  RUBRIC_VERSION,
  ScoresInMemory,
} from '@insights/domain/judging.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import {
  calibrationIn,
  judgeReportOf,
} from '@insights/domain/services/judge-report';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const JUDGE: StationJudge = {
  teamId: 'team_1',
  lineId: 'line_1',
  rubric: 'Did the run retry uploads?',
  rubricVersion: RUBRIC_VERSION,
  claims: [],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
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
      endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        HumanAction.of(at % 2 === 0 ? 'accepted' : 'sent-back', AT),
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
      hasTask: async () => true,
      of: async () => null,
      judgeAt: async () => judge,
      judgesOnTeam: async () =>
        new Map(judge ? [['station_1', judge] as const] : []),
    },
    scores,
    records,
    new TaskPullRequestsInMemory(),
  );
};

const JUDGES: ReadonlyMap<string, StationJudge> = new Map([
  ['station_1', JUDGE],
  ['station_2', { ...JUDGE, minAgreement: 0.9 }],
  ['station_4', { ...JUDGE, rubric: 'scores: stars\nHow well?' }],
  ['station_5', { ...JUDGE, teamId: 'team_2' }],
  ['station_6', { ...JUDGE, lineId: 'line_2' }],
]);

const STATIONS = [
  'station_1',
  'station_2',
  'station_3',
  'station_4',
  'station_5',
  'station_6',
].map((stationId) => ({ lineId: 'line_1', stationId }));

const judgedAcross = async () => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const taskPullRequests = new TaskPullRequestsInMemory();
  const requested: string[] = [];
  const evidence: EvidencePort = {
    hasTask: async () => true,
    of: async () => null,
    judgeAt: async (stationId) => JUDGES.get(stationId) ?? null,
    judgesOnTeam: async (teamId) => {
      requested.push(teamId);

      return new Map(
        [...JUDGES].filter(([, judge]) => judge.teamId === teamId),
      );
    },
  };

  for (let at = 0; at < 12; at += 1) {
    const runId = `run_${at}`;
    await records.add(
      endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        HumanAction.of(at % 2 === 0 ? 'accepted' : 'sent-back', AT),
      ),
    );
    await scores.add(
      judgeScore(runId, ScoreScale.yesNo(), at % 2 === 0 ? 1 : 0),
    );
  }
  for (let at = 0; at < 10; at += 1) {
    const runId = `run_2_${at}`;
    const taskId = `task_2_${at}`;
    await records.add(endedRecord(runId, { taskId, stationId: 'station_2' }));
    await scores.add(
      judgeScore(runId, ScoreScale.yesNo(), at < 3 ? 1 : at % 2, {
        stationId: 'station_2',
        taskId,
      }),
    );
    if (at % 2 === 0) {
      await scores.add(
        personGrade(runId, ScoreScale.yesNo(), at % 2, { taskId }),
      );
    } else {
      await taskPullRequests.add(
        taskPullRequestOf(taskId, { openedAt: AT, closedAt: AT, merged: true }),
      );
    }
  }
  for (const [runId, stationId] of [
    ['run_2_old', 'station_2'],
    ['run_4_1', 'station_4'],
    ['run_5_1', 'station_5'],
    ['run_6_1', 'station_6'],
  ] as const) {
    await records.add(endedRecord(runId, { taskId: `task_${runId}` }));
    await scores.add(
      judgeScore(runId, ScoreScale.yesNo(), 1, {
        stationId,
        rubricVersion:
          stationId === 'station_2' ? NEXT_RUBRIC_VERSION : RUBRIC_VERSION,
      }),
    );
  }

  return { evidence, requested, scores, records, taskPullRequests };
};

const oneByOne = async (
  fixture: Awaited<ReturnType<typeof judgedAcross>>,
  station: { lineId: string; stationId: string },
) => {
  const found = await fixture.evidence.judgeAt(station.stationId);
  const judge =
    found && found.teamId === 'team_1' && found.lineId === station.lineId
      ? found
      : null;
  const rubric =
    judge &&
    Rubric.readable({
      text: judge.rubric,
      claims: judge.claims,
      passThreshold: judge.passThreshold,
      version: judge.rubricVersion,
    });
  const judged =
    judge && rubric
      ? await fixture.scores.judgedAtStation({
          workspaceId: WORKSPACE,
          teamId: TeamId.of('team_1'),
          ...station,
          rubricVersion: judge.rubricVersion,
          last: 500,
        })
      : [];
  const records = await fixture.records.ofRuns(
    judged.map((each) => each.runId),
  );
  const grades = (
    await fixture.scores.ofRuns(
      [...new Set([...records, ...judged].map((each) => each.runId.value))].map(
        RunId.of,
      ),
    )
  ).filter((each) => !each.fromJudge);
  const taskPullRequests = await fixture.taskPullRequests.forTasks(
    records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
  );

  return {
    stationId: station.stationId,
    rubricVersion: judge?.rubricVersion ?? null,
    ...calibrationIn(
      judgeReportOf({
        judged,
        grades,
        records,
        covering: [],
        taskPullRequests,
      }),
      judge && {
        rubricVersion: judge.rubricVersion,
        scale: rubric?.scale ?? null,
        minAgreement: judge.minAgreement,
      },
    ),
  };
};

describe('StationJudgeReports', () => {
  it('gives each station of a team the calibration it has alone, with one look at the team’s judges', async () => {
    const fixture = await judgedAcross();
    const reports = new StationJudgeReports(
      fixture.evidence,
      fixture.scores,
      fixture.records,
      fixture.taskPullRequests,
    );

    const calibrations = await reports.calibrationsOf(
      { workspaceId: WORKSPACE.value, teamId: 'team_1' },
      STATIONS,
    );

    expect(calibrations).toEqual(
      await Promise.all(STATIONS.map((each) => oneByOne(fixture, each))),
    );
    expect(calibrations.map((each) => each.hiddenReason)).toEqual([
      null,
      expect.not.stringMatching(/no-judge|unreadable-rubric/),
      'no-judge',
      'unreadable-rubric',
      'no-judge',
      'no-judge',
    ]);
    expect(calibrations[1]?.pairs).toBe(10);
    expect(fixture.requested).toEqual(['team_1']);
  });

  it('reports how often the station’s judge agrees with people, and qualifies it once it agrees enough', async () => {
    const { judge, report, calibration } = await (await reporting()).at(
      STATION,
    );

    expect(judge?.scale?.kind).toBe('yes-no');
    expect(report.versions[0]?.agreement.kappa).toBe(1);
    expect(report.coverage).toEqual({
      runs: 13,
      both: 12,
      judgeOnly: 0,
      peopleOnly: 1,
      neither: 0,
      rates: { both: 12 / 13, judgeOnly: 0, peopleOnly: 1 / 13, neither: 0 },
    });
    expect(calibration.qualified).toBe(true);
  });

  it('answers Insights whether a station’s judge is qualified', async () => {
    const [calibration] = await (await reporting()).calibrationsOf(
      { workspaceId: 'ws_1', teamId: 'team_1' },
      [{ lineId: 'line_1', stationId: 'station_1' }],
    );

    expect(calibration).toMatchObject({
      stationId: 'station_1',
      rubricVersion: RUBRIC_VERSION,
      qualified: true,
      measure: 'kappa',
      pairs: 12,
    });
  });

  it('knows no judge of a station on another team', async () => {
    const { judge, calibration } = await (
      await reporting({ ...JUDGE, teamId: 'team_2' })
    ).at(STATION);

    expect(judge).toBeNull();
    expect(calibration.hiddenReason).toBe('no-judge');
  });

  it('says so, rather than guessing a scale, where the station’s rubric cannot be read', async () => {
    const { calibration } = await (
      await reporting({ ...JUDGE, rubric: 'scores: stars\nHow well?' })
    ).calibrationAt(STATION);

    expect(calibration.hiddenReason).toBe('unreadable-rubric');
  });

  it('weighs only the current rubric’s scores for the run page’s calibration, and names that rubric', async () => {
    expect(await (await reporting()).calibrationAt(STATION)).toMatchObject({
      rubricVersion: RUBRIC_VERSION,
      calibration: { qualified: true, pairs: 12 },
    });
  });
});
