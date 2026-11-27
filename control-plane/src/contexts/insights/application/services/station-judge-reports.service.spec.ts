import type {
  StationJudge,
  StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import {
  calibrationIn,
  judgeReportOf,
} from '@insights/domain/services/judge-report';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { ownedRecordOf } from '@insights/insights.fake-spec';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import { PullRequestRecordsInMemory } from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ACTOR = UserId.of('user_actor');

const AT = new Date('2026-09-30T11:00:00.000Z');

const JUDGE: StationJudge = {
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  rubricVersion: RUBRIC_VERSION,
  claims: ['It retries the upload.'],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const STATION = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
};

const reporting = async (judge: StationJudge | null = JUDGE) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();

  for (let at = 0; at < 12; at += 1) {
    const runId = `run_${at}`;
    await records.add(
      endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        PersonAction.of(at % 2 === 0 ? 'accepted' : 'sent-back', AT, ACTOR),
      ),
    );
    await scores.add(judgeScore(runId, [at % 2 === 0]));
  }
  await records.add(
    endedRecord('run_unjudged', { taskId: 'task_unjudged' }).recordAction(
      PersonAction.of('accepted', AT, ACTOR),
    ),
  );

  return new StationJudgeReports(
    {
      judgeAt: () => Promise.resolve(judge),
      judgesOnTeam: () =>
        Promise.resolve(new Map(judge ? [['station_1', judge] as const] : [])),
    },
    new StationFactsInMemory(records, { scores }),
  );
};

const JUDGES: ReadonlyMap<string, StationJudge> = new Map([
  ['station_1', JUDGE],
  ['station_2', { ...JUDGE, minAgreement: 0.9 }],
  ['station_4', { ...JUDGE, claims: [] }],
  ['station_5', { ...JUDGE, teamId: TeamId.of('team_2') }],
  ['station_6', { ...JUDGE, lineId: LineId.of('line_2') }],
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
  const pullRequestRecords = new PullRequestRecordsInMemory();
  const requested: string[] = [];
  const judges: StationJudgesPort = {
    judgeAt: (stationId) =>
      Promise.resolve(JUDGES.get(stationId.value) ?? null),
    judgesOnTeam: (teamId) => {
      requested.push(teamId.value);

      return Promise.resolve(
        new Map([...JUDGES].filter(([, judge]) => judge.teamId.equals(teamId))),
      );
    },
  };

  for (let at = 0; at < 12; at += 1) {
    const runId = `run_${at}`;
    await records.add(
      endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        PersonAction.of(at % 2 === 0 ? 'accepted' : 'sent-back', AT, ACTOR),
      ),
    );
    await scores.add(judgeScore(runId, [at % 2 === 0]));
  }
  for (let at = 0; at < 10; at += 1) {
    const runId = `run_2_${at}`;
    const taskId = `task_2_${at}`;
    const record = endedRecord(runId, { taskId, stationId: 'station_2' });
    await records.add(
      at % 2 === 0
        ? record.recordAction(PersonAction.of('sent-back', AT, ACTOR))
        : record,
    );
    await scores.add(
      judgeScore(runId, [at < 3 || at % 2 === 1], {
        stationId: 'station_2',
        taskId,
      }),
    );
    if (at % 2 === 1) {
      await pullRequestRecords.add(
        ownedRecordOf(taskId, {
          openedAt: AT,
          closedAt: AT,
          merged: true,
        }),
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
      judgeScore(runId, [true], {
        stationId,
        rubricVersion:
          stationId === 'station_2' ? NEXT_RUBRIC_VERSION : RUBRIC_VERSION,
      }),
    );
  }

  return { judges, requested, scores, records, pullRequestRecords };
};

const oneByOne = async (
  fixture: Awaited<ReturnType<typeof judgedAcross>>,
  station: { lineId: string; stationId: string },
) => {
  const found = await fixture.judges.judgeAt(StationId.of(station.stationId));
  const judge =
    found &&
    found.teamId.value === 'team_1' &&
    found.lineId.value === station.lineId
      ? found
      : null;
  const rubric =
    judge &&
    Rubric.readable({
      claims: judge.claims,
      passThreshold: judge.passThreshold,
      version: judge.rubricVersion,
    });
  const facts = new StationFactsInMemory(fixture.records, {
    scores: fixture.scores,
    pullRequests: fixture.pullRequestRecords,
  });
  const judged =
    judge && rubric
      ? await facts.judgedAtStation({
          workspaceId: WORKSPACE,
          teamId: TeamId.of('team_1'),
          lineId: LineId.of(station.lineId),
          stationId: StationId.of(station.stationId),
          rubricVersion: RubricVersion.of(judge.rubricVersion),
          last: 500,
        })
      : [];
  const runFacts = await facts.ofRuns(judged.map((each) => each.runId));

  return {
    stationId: station.stationId,
    rubricVersion: judge?.rubricVersion ?? null,
    ...calibrationIn(
      judgeReportOf({
        judged,
        facts: runFacts,
        covering: [],
      }),
      judge && {
        rubricVersion: judge.rubricVersion,
        rubric,
        minAgreement: judge.minAgreement,
      },
    ),
  };
};

describe('StationJudgeReports', () => {
  it('gives each station of a team the calibration it has alone, with one look at the team’s judges', async () => {
    const fixture = await judgedAcross();
    const reports = new StationJudgeReports(
      fixture.judges,
      new StationFactsInMemory(fixture.records, {
        scores: fixture.scores,
        pullRequests: fixture.pullRequestRecords,
      }),
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
    const { judge, report, calibration } = await (
      await reporting()
    ).at(STATION);

    expect(judge?.rubric?.claims).toEqual(['It retries the upload.']);
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
    const [calibration] = await (
      await reporting()
    ).calibrationsOf({ workspaceId: 'ws_1', teamId: 'team_1' }, [
      { lineId: 'line_1', stationId: 'station_1' },
    ]);

    expect(calibration).toMatchObject({
      stationId: 'station_1',
      rubricVersion: RUBRIC_VERSION,
      qualified: true,
      pairs: 12,
    });
  });

  it('knows no judge of a station on another team', async () => {
    const { judge, calibration } = await (
      await reporting({ ...JUDGE, teamId: TeamId.of('team_2') })
    ).at(STATION);

    expect(judge).toBeNull();
    expect(calibration.hiddenReason).toBe('no-judge');
  });

  it('says so where the station’s claims cannot be read', async () => {
    const { calibration } = await (
      await reporting({ ...JUDGE, claims: [] })
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
