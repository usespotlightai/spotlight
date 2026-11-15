import { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import { InvalidJudgeClaimsPullRequestError } from '@replays/domain/exceptions/invalid-judge-claims-pull-request.error';
import { CommitSha } from '@replays/domain/value-objects/commit-sha.vo';
import type { JudgeClaimsProposal } from '@replays/domain/value-objects/judge-claims-proposal';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const REVISION = '4f1c2a9e-7b3d-4c11-9a0e-2d5f6b7c8d90';

const STATION_AT = {
  workspaceId: WorkspaceId.of('workspace_1'),
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
};

const NOW = new Date('2026-11-14T10:00:00.000Z');

const LATER = new Date('2026-11-14T11:00:00.000Z');

const URL = 'https://github.com/acme/platform/pull/9';

const PROPOSAL: JudgeClaimsProposal = {
  trigger: 'claim-wrong',
  claimsBefore: ['It retries the upload.', 'It adds a test.'],
  claimsAfter: ['It retries the upload.', 'It adds or changes a test.'],
  searched: { before: 0.2, after: 0.6, runs: 28 },
  heldOut: { before: 0.1, after: 0.5, runs: 12 },
  disagreementRuns: [],
};

const requested = (
  change: Partial<{ revisionId: string; claims: readonly string[] }> = {},
) =>
  JudgeClaimsPullRequest.requested({
    revisionId: change.revisionId ?? REVISION,
    station: STATION_AT,
    proposal: {
      ...PROPOSAL,
      claimsAfter: change.claims ?? PROPOSAL.claimsAfter,
    },
    now: NOW,
  });

describe('JudgeClaimsPullRequest', () => {
  it('opens with a fresh job, and records nothing until it ends', () => {
    const pullRequest = requested();

    expect(pullRequest.state).toBe('opening');
    expect(pullRequest.hasPendingJob).toBe(true);
    expect(pullRequest.job?.attempts).toBe(0);
    expect(pullRequest.pullEvents()).toEqual([]);
  });

  it('names its revision and proposes claims', () => {
    expect(() => requested({ revisionId: ' ' })).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
    expect(() => requested({ claims: [] })).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
  });

  it('leases its job only while due, and counts each try', () => {
    const leased = requested().leaseJob(NOW);

    expect(leased.job?.attempts).toBe(1);
    expect(leased.updatedAt).toEqual(NOW);
    expect(() => leased.leaseJob(NOW)).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
  });

  it('waits before the next try, and runs out of tries', () => {
    let pullRequest = requested();

    for (let tried = 0; tried < MAX_JOB_ATTEMPTS; tried += 1) {
      pullRequest = pullRequest.leaseJob(LATER).scheduleRetry(NOW);
    }

    expect(pullRequest.jobExhausted).toBe(true);
    expect(() => pullRequest.leaseJob(LATER)).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
  });

  it('keeps its last commit while it opens', () => {
    const commit = CommitSha.of('3ded59c84');
    const committed = requested().committed(commit, NOW);

    expect(committed.lastCommit).toBe(commit);
    expect(() => committed.opened(URL, NOW).committed(commit, NOW)).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
  });

  it('opens with a link, drops its job and tells the revision', () => {
    const opened = requested().opened(URL, LATER);

    expect(opened.state).toBe('opened');
    expect(opened.url).toBe(URL);
    expect(opened.hasPendingJob).toBe(false);
    expect(opened.pullEvents().map((each) => each.kind)).toEqual([
      'judge-claims-pull-request.opened',
    ]);
    expect(() => requested().opened(' ', NOW)).toThrow(
      InvalidJudgeClaimsPullRequestError,
    );
  });

  it('fails with a reason, or a general one when it has none', () => {
    expect(requested().failed('The branch is protected.', NOW).reason).toBe(
      'The branch is protected.',
    );
    expect(requested().failed(' ', NOW).reason).toBe(
      'Spotlight could not open the pull request after several tries.',
    );
  });

  it('fails once it runs out of tries', () => {
    const failed = requested().deadLetter(NOW);

    expect(failed.state).toBe('failed');
    expect(failed.hasPendingJob).toBe(false);
    expect(failed.reason).toBe(
      'Spotlight could not open the pull request after several tries.',
    );
    expect(failed.pullEvents().map((each) => each.kind)).toEqual([
      'judge-claims-pull-request.failed',
    ]);
  });

  it('opens or fails only once', () => {
    const opened = requested().opened(URL, NOW);

    expect(opened.failed('Too late.', NOW)).toBe(opened);
    expect(opened.opened('https://github.com/acme/platform/pull/10', NOW)).toBe(
      opened,
    );
  });

  it('keeps a job while it opens, a link once opened and a reason once failed', () => {
    expect(() =>
      JudgeClaimsPullRequest.rehydrate({
        revisionId: REVISION,
        station: STATION_AT,
        proposal: PROPOSAL,
        state: 'opened',
        job: null,
        lastCommit: null,
        url: null,
        reason: null,
        requestedAt: NOW,
        updatedAt: NOW,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is deleted with the team, and keeps what it recorded', () => {
    const deleted = requested().opened(URL, NOW).delete();

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents().map((each) => each.kind)).toEqual([
      'judge-claims-pull-request.opened',
    ]);
  });
});
