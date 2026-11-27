import type { CommitPullRequestsPort } from '@insights/application/ports/commit-pull-requests.port';
import { WorkClaimsSources } from '@insights/application/services/work-claims-sources.service';
import {
  ClaimsSource,
  type CommitPullRequest,
} from '@insights/domain/aggregates/claims-source.aggregate';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { ClaimsSourcesInMemory } from '@insights/judge-repair.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

const RECORDED_AT = new Date('2026-11-14T09:00:00Z');

const FIRST = RubricVersion.of('a'.repeat(64));

const MINUTE = 60_000;

const MERGED: CommitPullRequest = {
  number: 12,
  url: 'https://github.com/acme/config/pull/12',
  title: 'Tighten the claims',
  merged: true,
};

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const answering = (
  answers: (readonly CommitPullRequest[] | Error)[],
): CommitPullRequestsPort & { asked: string[] } => {
  const asked: string[] = [];

  return {
    asked,
    of: (workspaceId, commit) => {
      asked.push(`${workspaceId.value} ${commit.toString()}`);
      const answer = answers.shift() ?? [];
      if (answer instanceof Error) {
        return Promise.reject(answer);
      }
      return Promise.resolve(answer);
    },
  };
};

const working = async (answers: (readonly CommitPullRequest[] | Error)[]) => {
  const sources = new ClaimsSourcesInMemory();
  const pullRequests = answering(answers);
  let now = RECORDED_AT;
  const clock: ClockPort = { now: () => now, sleep: async () => {} };
  const work = new WorkClaimsSources(
    sources,
    pullRequests,
    clock,
    inTransaction,
    logger,
    { report: () => undefined },
    telemetryInMemory(),
  );

  await sources.add(
    ClaimsSource.recorded({
      station: {
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      },
      rubricVersion: FIRST,
      commit: SourceCommit.of({ repository: 'acme/config', sha: SHA }),
      at: RECORDED_AT,
    }),
  );

  return {
    pullRequests,
    source: () => sources.find(StationId.of('station_1'), FIRST),
    at: async (minutes: number) => {
      now = new Date(RECORDED_AT.getTime() + minutes * MINUTE);
      await work.processDue();
      await work.idle();
    },
  };
};

describe('WorkClaimsSources', () => {
  it('finds the pull request that merged the commit at once', async () => {
    const run = await working([[MERGED]]);

    await run.at(0);

    const source = await run.source();
    expect(run.pullRequests.asked).toEqual([`ws_1 acme/config@${SHA}`]);
    expect(source?.pullRequest).toEqual({
      number: 12,
      url: 'https://github.com/acme/config/pull/12',
      title: 'Tighten the claims',
    });
    expect(source?.resolvedAt).toEqual(RECORDED_AT);
    expect(source?.hasPendingJob).toBe(false);
  });

  it('asks again later while GitHub lists no pull request for the commit yet', async () => {
    const run = await working([[], [], [MERGED]]);

    await run.at(0);
    expect(await run.source()).toMatchObject({
      resolvedAt: null,
      lookups: 1,
    });

    await run.at(0.5);
    expect(run.pullRequests.asked).toHaveLength(1);

    await run.at(1);
    await run.at(6);

    const source = await run.source();
    expect(run.pullRequests.asked).toHaveLength(3);
    expect(source?.pullRequest?.number).toBe(12);
    expect(source?.lookups).toBe(3);
  });

  it('keeps only the commit after the last lookup finds no pull request', async () => {
    const run = await working([[], [], [], []]);

    await run.at(0);
    await run.at(1);
    await run.at(6);
    await run.at(36);

    const source = await run.source();
    expect(run.pullRequests.asked).toHaveLength(4);
    expect(source?.pullRequest).toBeNull();
    expect(source?.resolvedAt).toEqual(
      new Date(RECORDED_AT.getTime() + 36 * MINUTE),
    );

    await run.at(600);
    expect(run.pullRequests.asked).toHaveLength(4);
  });

  it('tries again after GitHub fails for now, without counting a lookup', async () => {
    const run = await working([new Error('GitHub is busy'), [MERGED]]);

    await run.at(0);
    expect(await run.source()).toMatchObject({ resolvedAt: null, lookups: 0 });

    await run.at(1);

    expect((await run.source())?.pullRequest?.number).toBe(12);
  });
});
