import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type {
  ConfigCommit,
  ConfigPullRequestOpening,
  ConfigRepositoryPort,
} from '@replays/application/ports/config-repository.port';
import type {
  StationSourceEdit,
  StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import {
  judgeClaimsBranchOf,
  OpenJudgeClaimsPullRequests,
} from '@replays/application/services/judge-claims-pull-requests.service';
import {
  FakeLines,
  peopleWho,
  STATION_VIEW,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { RequestJudgeClaimsPullRequests } from '@replays/application/services/request-judge-claims-pull-requests.service';
import { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import { JudgeClaimsPullRequestVersionConflictError } from '@replays/domain/exceptions/judge-claims-pull-request-version-conflict.error';
import type { JudgeClaimsPullRequestRepository } from '@replays/domain/repositories/judge-claims-pull-request.repository';
import type { JudgeClaimsProposal } from '@replays/domain/value-objects/judge-claims-proposal';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const LIVE_CLAIMS = ['It retries the upload.', 'It adds a test.'];

const REVISION = '4f1c2a9e-7b3d-4c11-9a0e-2d5f6b7c8d90';

const STATION_AT = {
  workspaceId: STATION_VIEW.workspaceId,
  teamId: STATION_VIEW.teamId,
  lineId: STATION_VIEW.lineId,
  stationId: STATION_VIEW.stationId,
};

const NOW = new Date('2026-11-14T10:00:00.000Z');

const PROPOSAL: JudgeClaimsProposal = {
  trigger: 'claim-wrong',
  claimsBefore: LIVE_CLAIMS,
  claimsAfter: ['It retries the upload.', 'It adds or changes a test.'],
  searched: { before: 0.2, after: 0.6, runs: 28 },
  heldOut: { before: 0.1, after: 0.5, runs: 12 },
  disagreementRuns: [
    {
      runId: 'run_1',
      taskId: 'task_1',
      direction: 'judge-failed',
      claimsWrong: [1],
      notes: [{ claim: 1, text: 'The test sits in another file.' }],
    },
  ],
};

class PullRequestsInMemory implements JudgeClaimsPullRequestRepository {
  readonly stored = new Map<string, JudgeClaimsPullRequest>();
  readonly events: DomainEvent[] = [];

  add(pullRequest: JudgeClaimsPullRequest): Promise<void> {
    if (this.stored.has(pullRequest.revisionId)) {
      return Promise.reject(
        new JudgeClaimsPullRequestVersionConflictError(pullRequest.revisionId),
      );
    }
    this.events.push(...pullRequest.pullEvents());
    this.stored.set(pullRequest.revisionId, pullRequest);
    return Promise.resolve();
  }

  save(pullRequest: JudgeClaimsPullRequest): Promise<void> {
    const existing = this.stored.get(pullRequest.revisionId);

    if (!existing || existing.version !== pullRequest.version) {
      return Promise.reject(
        new JudgeClaimsPullRequestVersionConflictError(pullRequest.revisionId),
      );
    }
    if (pullRequest.isDeleted) {
      this.stored.delete(pullRequest.revisionId);
      return Promise.resolve();
    }
    this.events.push(...pullRequest.pullEvents());
    this.stored.set(
      pullRequest.revisionId,
      JudgeClaimsPullRequest.rehydrate({
        revisionId: pullRequest.revisionId,
        station: pullRequest.station,
        proposal: pullRequest.proposal,
        state: pullRequest.state,
        job: pullRequest.job,
        lastCommit: pullRequest.lastCommit,
        url: pullRequest.url,
        reason: pullRequest.reason,
        requestedAt: pullRequest.requestedAt,
        updatedAt: pullRequest.updatedAt,
        version: pullRequest.version + 1,
      }),
    );
    return Promise.resolve();
  }

  find(revisionId: string): Promise<JudgeClaimsPullRequest | null> {
    return Promise.resolve(this.stored.get(revisionId) ?? null);
  }

  ofTeam(teamId: TeamId): Promise<readonly JudgeClaimsPullRequest[]> {
    return Promise.resolve(
      [...this.stored.values()].filter((each) =>
        each.station.teamId.equals(teamId),
      ),
    );
  }

  nextDueJob(now: Date): Promise<JudgeClaimsPullRequest | null> {
    return Promise.resolve(
      [...this.stored.values()].find(
        (each) => each.job?.isDue(now) === true && !each.job.exhausted,
      ) ?? null,
    );
  }
}

class JudgedLines extends FakeLines {
  claims: unknown = LIVE_CLAIMS;

  override stationSettings = () =>
    Promise.resolve({
      block: StationBlock.of({
        key: 'build',
        name: 'Build',
        kind: 'work',
        prompt: 'Build it.',
        judge: { claims: this.claims, sample: 0.2 },
      }),
      threshold: null,
      search: null,
      agent: null,
    });
}

class FakeConfigs implements ConfigRepositoryPort {
  readonly commits: ConfigCommit[] = [];
  readonly openings: ConfigPullRequestOpening[] = [];
  failing: Error | null = null;
  failingOnce: Error | null = null;

  fileAt(_workspace: unknown, _repository: unknown, path: string) {
    return Promise.resolve({
      path,
      content: 'resource "spotlight_line" "x" {}\n',
      commit: 'c1',
    });
  }

  filesUnder() {
    return Promise.resolve([]);
  }

  committed(_workspace: unknown, _repository: unknown, commit: ConfigCommit) {
    this.commits.push(commit);
    if (this.failing) {
      return Promise.reject(this.failing);
    }

    return Promise.resolve('commit_1');
  }

  opened(
    _workspace: unknown,
    _repository: unknown,
    opening: ConfigPullRequestOpening,
  ) {
    this.openings.push(opening);
    if (this.failingOnce) {
      const failing = this.failingOnce;
      this.failingOnce = null;
      return Promise.reject(failing);
    }

    return Promise.resolve({
      url: 'https://github.com/acme/platform/pull/9',
      number: 9,
      hostId: 109,
      repository: 'acme/platform',
    });
  }

  statusOf() {
    return Promise.resolve({ state: 'open' as const, closedAt: null });
  }

  async closed() {}

  async commented() {}
}

class FakeEditor implements StationSourceEditorPort {
  readonly edits: StationSourceEdit[] = [];

  edited(edit: StationSourceEdit) {
    this.edits.push(edit);

    return Promise.resolve({
      ok: true as const,
      files: [{ path: 'teams/core/delivery.tf', content: 'edited\n' }],
      unchecked: [],
    });
  }
}

const opening = async () => {
  const lines = new JudgedLines();
  const configs = new FakeConfigs();
  const editor = new FakeEditor();
  const pullRequests = new PullRequestsInMemory();
  let now = NOW;
  const clock = { now: () => now, sleep: async () => {} };
  const requesting = new RequestJudgeClaimsPullRequests(
    pullRequests,
    TRANSACTION,
    clock,
  );
  const service = new OpenJudgeClaimsPullRequests(
    { pullRequests, lines, people: peopleWho(true), configs, editor },
    clock,
    TRANSACTION,
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    { report: () => undefined },
    telemetryInMemory(),
  );

  await requesting.request({
    revisionId: REVISION,
    station: STATION_AT,
    proposal: PROPOSAL,
  });

  const run = async () => {
    await service.processDue();
    await service.idle();
  };
  const later = (ms: number) => {
    now = new Date(NOW.getTime() + ms);
  };
  const stored = () => pullRequests.stored.get(REVISION);
  const kinds = () => pullRequests.events.map((each) => each.kind);

  return { lines, configs, editor, requesting, run, later, stored, kinds };
};

describe('OpenJudgeClaimsPullRequests', () => {
  it('opens a config pull request that changes only the judge claims, and says so', async () => {
    const { configs, editor, run, stored, kinds } = await opening();

    await run();

    expect(stored()?.state).toBe('opened');
    expect(stored()?.url).toBe('https://github.com/acme/platform/pull/9');
    expect(kinds()).toEqual(['judge-claims-pull-request.opened']);
    expect(editor.edits[0]?.seed.value.judge).toEqual({
      claims: LIVE_CLAIMS,
      sample: 0.2,
    });
    expect(editor.edits[0]?.candidate.value).toEqual({
      ...editor.edits[0]?.seed.value,
      judge: { claims: PROPOSAL.claimsAfter, sample: 0.2 },
    });
    expect(configs.commits[0]?.branch).toBe(
      'spotlight/claims-delivery-build-4f1c2a9e',
    );
    expect(configs.commits[0]?.base).toBe('c1');
    expect(configs.openings[0]?.title).toBe(
      'Revise the judge claims of the build station',
    );
    expect(configs.openings[0]?.body).toContain('It adds or changes a test.');
    expect(configs.openings[0]?.body).toContain('run_1');
  });

  it('reports the agreement before and after on the searched and on the held-out runs', async () => {
    const { configs, run } = await opening();

    await run();

    const body = configs.openings[0]?.body ?? '';
    expect(body).toContain('| Searched runs | Held-out runs |');
    expect(body).toContain('| Runs | 28 | 12 |');
    expect(body).toContain('| Current claims | 0.20 | 0.10 |');
    expect(body).toContain('| New claims | 0.60 | 0.50 |');
  });

  it('tries again later when the code host does not answer, and commits over its own commit', async () => {
    const { configs, run, later, stored, kinds } = await opening();
    configs.failingOnce = new Error('The code host did not answer.');

    await run();

    expect(stored()?.state).toBe('opening');
    expect(stored()?.lastCommit).toBe('commit_1');
    expect(kinds()).toEqual([]);

    later(86_400_000);
    await run();

    expect(stored()?.state).toBe('opened');
    expect(configs.commits.map((each) => each.replacing)).toEqual([
      null,
      'commit_1',
    ]);
    expect(kinds()).toEqual(['judge-claims-pull-request.opened']);
  });

  it('fails with the reason when the config repository refuses the change', async () => {
    const { configs, run, stored, kinds } = await opening();
    configs.failing = new ConfigRepositoryError(
      'repository-unreachable',
      'The branch is protected.',
    );

    await run();

    expect(stored()?.state).toBe('failed');
    expect(stored()?.reason).toBe('The branch is protected.');
    expect(kinds()).toEqual(['judge-claims-pull-request.failed']);
  });

  it('fails without a commit when the live claims changed after the revision started', async () => {
    const { lines, configs, run, stored } = await opening();
    lines.claims = ['It ships.'];

    await run();

    expect(stored()?.state).toBe('failed');
    expect(configs.commits).toEqual([]);
  });

  it('keeps one pull request for a revision however often it is asked', async () => {
    const { requesting, run, configs } = await opening();

    await requesting.request({
      revisionId: REVISION,
      station: STATION_AT,
      proposal: PROPOSAL,
    });
    await run();
    await requesting.request({
      revisionId: REVISION,
      station: STATION_AT,
      proposal: PROPOSAL,
    });
    await run();

    expect(configs.openings).toHaveLength(1);
  });

  it('deletes the pull requests of a deleted team', async () => {
    const { requesting, stored } = await opening();

    await requesting.ofTeam(STATION_AT.teamId);

    expect(stored()).toBeUndefined();
  });
});

describe('judgeClaimsBranchOf', () => {
  it('names the branch after the line, the station and the revision', () => {
    expect(
      judgeClaimsBranchOf({
        lineKey: 'Delivery Line',
        stationKey: 'build',
        revisionId: '9a0e2d5f-0000-4000-8000-000000000000',
      }),
    ).toBe('spotlight/claims-delivery-line-build-9a0e2d5f');
  });
});
