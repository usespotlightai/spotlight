import { rubricVersionOf } from '@insights/application/dto/station-judge.dto';
import { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import {
  agreementOf,
  type VerdictPair,
} from '@insights/domain/services/judge-agreement';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import type { RubricReport } from '@insights/domain/services/judge-report';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  agreement: 0.9,
  pairs: 12,
  minAgreement: 0.5,
  hiddenReason: null,
};

const reportOf = (rubricVersion: string): RubricReport => ({
  rubricVersion,
  judged: 4,
  agreement: agreementOf([], []),
  trend: [
    { day: '2026-09-30', judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
  ],
  firstAt: new Date('2026-09-30T10:00:00.000Z'),
  lastAt: new Date('2026-09-30T12:00:00.000Z'),
});

const judgeOnTrend = (
  rubricVersion: string,
  calibration: JudgeCalibration,
): (number | null)[] =>
  rubricVersionOf(
    reportOf(rubricVersion),
    CURRENT,
    calibration,
    null,
  ).trend.map((each) => each.judge);

describe('rubricVersionOf', () => {
  it('draws the judge’s trend for every rubric, even while its scores are hidden on runs', () => {
    expect(judgeOnTrend(CURRENT, QUALIFIED)).toEqual([0.75]);
    expect(judgeOnTrend(EARLIER, QUALIFIED)).toEqual([0.75]);
    expect(
      judgeOnTrend(CURRENT, {
        ...QUALIFIED,
        qualified: false,
        hiddenReason: 'below-min-agreement',
      }),
    ).toEqual([0.75]);
  });

  it('holds the trend back until enough runs have both scores', () => {
    const version = rubricVersionOf(
      reportOf(CURRENT),
      CURRENT,
      QUALIFIED,
      null,
    );

    expect(version.trendShown).toBe(false);
    expect(version.trendMinPairs).toBe(30);
  });
});

describe('rubricVersionOf distribution', () => {
  it('labels each verdict’s counts the way the confusion is labelled', () => {
    const version = rubricVersionOf(
      {
        ...reportOf(CURRENT),
        agreement: agreementOf(
          [
            { judge: true, human: true },
            { judge: true, human: false },
            { judge: false, human: false },
          ],
          [],
        ),
      },
      CURRENT,
      QUALIFIED,
      null,
    );

    expect(version.distribution).toEqual([
      { label: 'fails', judge: 1, people: 2 },
      { label: 'passes', judge: 2, people: 1 },
    ]);
  });
});

describe('rubricVersionOf agreement', () => {
  const versionOf = (pairs: VerdictPair[]) =>
    rubricVersionOf(
      {
        ...reportOf(CURRENT),
        agreement: agreementOf(pairs, []),
      },
      CURRENT,
      QUALIFIED,
      null,
    ).agreement;

  it('counts the verdicts that agree, and says how far the pairs are towards the minimum', () => {
    expect(
      versionOf([
        { judge: true, human: true },
        { judge: true, human: false },
        { judge: false, human: false },
      ]),
    ).toMatchObject({
      measured: false,
      pairsProgress: 0.3,
      agreed: 2,
      compared: 3,
    });
  });

  it('marks the agreement measured once enough runs have both scores, and flags kappa below the minimum', () => {
    const agreement = versionOf(
      Array.from({ length: 12 }, (_, at) => ({
        judge: at % 2 === 1,
        human: at % 3 === 0,
      })),
    );

    expect(agreement.measured).toBe(true);
    expect(agreement.pairsProgress).toBe(1);
    expect(agreement.belowMinimum).toBe(true);
  });
});

describe('rubricVersionOf source', () => {
  const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

  const recorded = ClaimsSource.recorded({
    station: {
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    },
    rubricVersion: RubricVersion.of(CURRENT),
    commit: SourceCommit.of({ repository: 'acme/config', sha: SHA }),
    at: new Date('2026-11-14T09:00:00Z'),
  });

  const sourceOf = (source: ClaimsSource | null) =>
    rubricVersionOf(reportOf(CURRENT), CURRENT, QUALIFIED, source).source;

  it('names the commit the claims came from and the pull request that merged it', () => {
    expect(
      sourceOf(
        recorded.mergedBy(
          [
            {
              number: 12,
              url: 'https://github.com/acme/config/pull/12',
              title: 'Tighten the claims',
              merged: true,
            },
          ],
          new Date('2026-11-14T09:01:00Z'),
        ),
      ),
    ).toEqual({
      repository: 'acme/config',
      sha: SHA,
      shortSha: '3f1c9a7',
      url: `https://github.com/acme/config/commit/${SHA}`,
      pullRequest: {
        number: 12,
        url: 'https://github.com/acme/config/pull/12',
        title: 'Tighten the claims',
      },
    });
  });

  it('names only the commit while no pull request is known', () => {
    expect(sourceOf(recorded)?.pullRequest).toBeNull();
  });

  it('names no source for claims that came from no known commit', () => {
    expect(sourceOf(null)).toBeNull();
  });
});
