import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type {
  ConfigCommit,
  ConfigPullRequestAt,
  ConfigPullRequestOpening,
  ConfigPullRequestStatus,
  ConfigRepositoryPort,
} from '@replays/application/ports/config-repository.port';
import type {
  StationSourceEdit,
  StationSourceEdited,
  StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import {
  CloseStaleConfigPullRequests,
  STALE_COMMENT,
} from '@replays/application/services/close-stale-config-pull-requests.service';
import { FollowConfigPullRequests } from '@replays/application/services/follow-config-pull-requests.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { PickSearchCandidates } from '@replays/application/services/pick-search-candidates.service';
import { ReconcileConfigPullRequests } from '@replays/application/services/reconcile-config-pull-requests.service';
import { replayedWorld } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  CLOCK,
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  peopleWho,
  QUIET,
  STATION_VIEW,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SearchSchedules } from '@replays/application/services/search-schedules.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import {
  ConfigPullRequest,
  MAX_RETRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import {
  aSearch,
  candidateOf,
  FINGERPRINT,
  later,
  NOW,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

class FakeConfigs implements ConfigRepositoryPort {
  readonly commits: ConfigCommit[] = [];
  readonly openings: ConfigPullRequestOpening[] = [];
  readonly closings: number[] = [];
  readonly comments: { number: number; body: string }[] = [];
  readonly statuses = new Map<number, ConfigPullRequestStatus>();
  closeFailing: Error | null = null;
  commentFailing: Error | null = null;
  failing: Error | null = null;
  hasFile = true;

  async fileAt(_workspace: unknown, _repository: unknown, path: string) {
    if (this.failing) {
      throw this.failing;
    }

    return this.hasFile
      ? { path, content: 'resource "spotlight_line" "x" {}\n', commit: 'c1' }
      : null;
  }

  async filesIn() {
    return ['teams/core/delivery.tf', 'teams/core/skills.tf', 'README.md'];
  }

  async committed(
    _workspace: unknown,
    _repository: unknown,
    commit: ConfigCommit,
  ) {
    this.commits.push(commit);

    return `commit_${this.commits.length}`;
  }

  async opened(
    _workspace: unknown,
    repository: { value: string },
    opening: ConfigPullRequestOpening,
  ) {
    const at = this.openings.findIndex(
      (each) => each.branch === opening.branch,
    );

    if (at < 0) {
      this.openings.push(opening);
    }

    const number = at < 0 ? this.openings.length : at + 1;

    return {
      url: `https://github.com/${repository.value}/pull/${number}`,
      number,
      gitHubId: 100 + number,
      repository: 'Acme/Platform',
    };
  }

  async statusOf(_workspace: unknown, at: ConfigPullRequestAt) {
    if (this.closeFailing) {
      throw this.closeFailing;
    }

    return this.statuses.get(at.number) ?? { state: 'open', closedAt: null };
  }

  async closed(_workspace: unknown, at: ConfigPullRequestAt) {
    if (this.closeFailing) {
      throw this.closeFailing;
    }

    this.closings.push(at.number);
  }

  async commented(_workspace: unknown, at: ConfigPullRequestAt, body: string) {
    if (this.commentFailing) {
      throw this.commentFailing;
    }

    this.comments.push({ number: at.number, body });
  }
}

class FakeEditor implements StationSourceEditorPort {
  readonly edits: StationSourceEdit[] = [];
  answer: StationSourceEdited = {
    ok: true,
    files: [{ path: 'teams/core/delivery.tf', content: 'edited\n' }],
    unchecked: [],
  };

  async edited(edit: StationSourceEdit) {
    this.edits.push(edit);

    return this.answer;
  }
}

const charged = { spent: Money.of(1, 'USD'), unpriced: 0 };

const TERSE = CandidateId.of('candidate_terse');

const PROPOSED = StationFingerprint.of('e'.repeat(64));

const searchWithTerse = (): Search => {
  const runIds = searchRunIds();

  return aSearch()
    .recordReplayStopReason(
      ReplayId.of('replay_seed'),
      'finished',
      charged,
      NOW,
      runIds,
      true,
    )
    .acceptProposal(RunId.of('search_run_1'), {
      candidateId: TERSE,
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .recordReplayStopReason(
      ReplayId.of('replay_terse'),
      'finished',
      charged,
      later(1),
      runIds,
      true,
    );
};

let memory: InMemoryReplays;
let work: FakeWork;
let pullRequests: InMemoryConfigPullRequests;
let configs: FakeConfigs;
let editor: FakeEditor;
let search: Search;
let now: Date;

const clock: ClockPort = { ...CLOCK, now: () => now };

const picking = () =>
  new PickSearchCandidates(
    memory.searchRepository,
    memory.replayRepository,
    pullRequests,
    memory.candidateRepository,
    memory.scheduleRepository,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
    work,
    IDS,
    clock,
    TRANSACTION,
  );

const pick = (candidateId = TERSE.value) =>
  picking().candidatePicked(
    new SearchCandidatePicked(
      search.id,
      search.workspaceId,
      CandidateId.of(candidateId),
    ),
  );

const opening = () =>
  new OpenConfigPullRequests(
    pullRequests,
    memory.searchRepository,
    memory.candidateRepository,
    memory.replayRepository,
    work,
    peopleWho(true),
    configs,
    editor,
    TRANSACTION,
    clock,
    QUIET,
    'https://app.example.com/',
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
  );

const following = () =>
  new FollowConfigPullRequests(pullRequests, work, TRANSACTION, clock);

const closing = () =>
  new CloseStaleConfigPullRequests(
    pullRequests,
    configs,
    TRANSACTION,
    clock,
    QUIET,
  );

const schedules = () =>
  new SearchSchedules(memory.scheduleRepository, work, TRANSACTION, clock);

const reconciling = () =>
  new ReconcileConfigPullRequests(
    pullRequests,
    configs,
    TRANSACTION,
    clock,
    QUIET,
  );

const liveIs = (fingerprint: StationFingerprint) => {
  const live = work.live;

  work.live = async () => ({ ...(await live()), fingerprint });
};

const onGitHub = (
  over: {
    number?: number;
    gitHubId?: number | null;
    repository?: string;
    workspaceId?: string;
  } = {},
) => {
  const number = over.number ?? 1;
  const repository = over.repository ?? 'acme/platform';

  return {
    workspaceId: WorkspaceId.of(
      over.workspaceId ?? STATION_VIEW.workspaceId.value,
    ),
    repository: Repository.of(repository),
    pullRequest: PullRequestUrl.of(
      `https://github.com/${repository}/pull/${number}`,
    ),
    gitHubId: over.gitHubId === undefined ? 100 + number : over.gitHubId,
    at: later(100),
  };
};

const closedOnGitHub = (
  merged: boolean,
  over: Parameters<typeof onGitHub>[0] = {},
) => following().closedOnGitHub({ ...onGitHub(over), merged });

const opened = async () => {
  await pick();
  await opening().processDue();
  await following().check(only().id);
};

const only = (): ConfigPullRequest => {
  const [pullRequest, ...rest] = pullRequests.stored.values();

  if (!pullRequest || rest.length > 0) {
    throw new Error(`expected one pull request, found ${rest.length + 1}`);
  }

  return pullRequest;
};

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  pullRequests = new InMemoryConfigPullRequests();
  configs = new FakeConfigs();
  editor = new FakeEditor();
  search = searchWithTerse();
  search.pullEvents();
  now = later(10);
  memory.searches.set(search.id.value, search);
  for (const each of [
    candidateOf('live', search.seed.candidateId.value),
    candidateOf('proposed', TERSE.value, null, null, PROPOSED),
  ]) {
    memory.candidates.set(each.id.value, each);
  }
});

describe('picking a search candidate', () => {
  it('opens one pull request as Spotlight however often the pick is heard', async () => {
    await pick();
    await pick();

    expect(only()).toMatchObject({
      current: 'opening',
      repository: 'acme/platform',
      path: 'teams/core/delivery.tf',
      branch: `spotlight/search-${search.id.value.slice(0, 8)}-terse`,
    });
    expect(
      pullRequests.events.find(
        (each) => each instanceof ConfigPullRequestRequested,
      ),
    ).toMatchObject({ change: { by: { actor: null } } });

    await opening().processDue();
    await opening().processDue();

    expect(only()).toMatchObject({
      current: 'opened',
      url: 'https://github.com/acme/platform/pull/1',
      lastCommit: 'commit_1',
    });
    expect(
      pullRequests.events.filter(
        (each) => each instanceof ConfigPullRequestOpened,
      ),
    ).toEqual([
      expect.objectContaining({
        pullRequestId: only().id,
        stationId: STATION_VIEW.stationId,
        proposing: PROPOSED,
        url: PullRequestUrl.of('https://github.com/acme/platform/pull/1'),
      }),
    ]);
    expect(configs.commits).toEqual([
      {
        branch: only().branch,
        base: 'c1',
        replacing: null,
        message: expect.stringMatching(/^build: terse\n/),
        files: [{ path: 'teams/core/delivery.tf', content: 'edited\n' }],
      },
    ]);
    expect(configs.openings[0]).toMatchObject({ title: 'build: terse' });
    expect(configs.openings[0]?.body).toContain(
      `https://app.example.com/w/acme/team/${STATION_VIEW.teamId.value}/lines/${STATION_VIEW.lineId}/stations/${STATION_VIEW.stationId}/searches/${search.id.value}`,
    );
    expect(editor.edits[0]).toMatchObject({
      lineKey: 'delivery',
      stationKey: 'build',
      file: { path: 'teams/core/delivery.tf' },
      module: ['teams/core/skills.tf'],
    });
  });

  it('opens nothing for a candidate the search never proposed', async () => {
    await pick(search.seed.candidateId.value);
    await pick('candidate_none');

    expect(pullRequests.stored.size).toBe(0);
  });

  it('records why the file could not be edited', async () => {
    editor.answer = {
      ok: false,
      reason: ConfigPullRequestReason.of({
        code: 'computed-attribute',
        message: '`prompt` is computed in Terraform (`local.prompt`)',
        attribute: 'prompt',
        expression: 'local.prompt',
        wanted: 'Build it.',
      }),
    };
    await pick();
    await opening().processDue();

    expect(only()).toMatchObject({ current: 'failed' });
    expect(only().reason).toMatchObject({
      code: 'computed-attribute',
      wanted: 'Build it.',
    });
    expect(configs.commits).toEqual([]);
  });

  it('lists in the body what the edit could not check', async () => {
    editor.answer = { ok: true, files: [], unchecked: ['judge.rubric'] };
    await pick();
    await opening().processDue();

    expect(only().current).toBe('opened');
    expect(configs.openings[0]?.body).toContain('## Not checked');
    expect(configs.openings[0]?.body).toContain('`judge.rubric`');
  });

  it('fails for a repository the GitHub App cannot access, and for a file it does not contain', async () => {
    configs.failing = new ConfigRepositoryError(
      'repository-unreachable',
      'not installed',
    );
    await pick();
    await opening().processDue();

    expect(only().reason).toMatchObject({
      code: 'repository-unreachable',
      message: 'not installed',
    });

    configs.failing = null;
    configs.hasFile = false;
    pullRequests = new InMemoryConfigPullRequests();
    await pick();
    await opening().processDue();

    expect(only().reason?.code).toBe('file-missing');
  });

  it('fails at once on what GitHub rejects for good', async () => {
    configs.failing = null;
    await pick();

    configs.opened = async () => {
      throw new ConfigRepositoryError(
        'github-error',
        'Resource not accessible by integration',
      );
    };
    await opening().processDue();

    expect(only()).toMatchObject({
      current: 'failed',
      retries: 0,
      lastCommit: 'commit_1',
    });
    expect(only().reason).toMatchObject({
      code: 'github-error',
      message: 'Resource not accessible by integration',
    });
  });

  it('records the pull request a lost answer already opened when it tries again', async () => {
    await pick();
    const opened = configs.opened.bind(configs);

    configs.opened = async (...args) => {
      await opened(...args);
      throw new Error('socket hang up');
    };
    await opening().processDue();

    expect(only()).toMatchObject({ current: 'opening', retries: 1 });

    configs.opened = opened;
    now = new Date(now.getTime() + 60 * 60_000);
    await opening().processDue();

    expect(only()).toMatchObject({
      current: 'opened',
      url: 'https://github.com/acme/platform/pull/1',
    });
    expect(configs.openings).toHaveLength(1);
    expect(configs.commits[1]?.replacing).toBe('commit_1');
  });

  it('retries later when GitHub fails, and fails after the last try', async () => {
    configs.failing = new Error('GitHub is down');
    await pick();
    await opening().processDue();

    expect(only()).toMatchObject({ current: 'opening', retries: 1 });
    await opening().processDue();
    expect(only().retries).toBe(1);

    for (let retries = 1; retries < MAX_RETRIES; retries += 1) {
      now = new Date(now.getTime() + 24 * 60 * 60_000);
      await opening().processDue();
    }

    expect(only()).toMatchObject({ current: 'failed' });
    expect(only().reason).toMatchObject({
      code: 'github-error',
      message: 'GitHub is down',
    });
  });

  it('fails at once when the line names no source', async () => {
    work.station = async () => ({ ...STATION_VIEW, source: null });
    await pick();
    await opening().processDue();

    expect(only().reason?.code).toBe('no-source');
    expect(editor.edits).toEqual([]);
  });

  it('says the held-out result was still pending when its held-out replay had not finished', async () => {
    const world = replayedWorld(true);
    const pending = replayFor(
      world.set,
      'replay_held_out_terse',
      'candidate_terse',
      world.search.split.heldOutRuns,
    );
    search = world.search;
    search.pullEvents();
    memory.searches.set(search.id.value, search);
    for (const each of [
      ...world.replays.filter((one) => !one.id.equals(pending.id)),
      pending,
    ]) {
      await memory.replayRepository.add(each);
    }

    await pick();
    await opening().processDue();

    expect(configs.openings[0]?.body).toContain(
      'Its held-out replay had not finished when this pull request opened',
    );
  });
});

describe('following a config pull request after it opened', () => {
  it('records the canonical repository, GitHub id and number, and the live config it was based on', async () => {
    await opened();

    expect(only()).toMatchObject({
      current: 'opened',
      repository: 'Acme/Platform',
      number: 1,
      gitHubId: 101,
      basedOn: FINGERPRINT,
      proposing: PROPOSED,
    });
  });

  it('closes it on GitHub, then comments, once the live config changed to another one', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);

    expect(only()).toMatchObject({
      current: 'closing',
      closedBecause: 'stale',
    });
    expect(await pullRequests.openAtStation(STATION_VIEW.stationId)).toBe(true);

    configs.closeFailing = new Error('GitHub is down');
    await closing().processDue();

    expect(only()).toMatchObject({ current: 'closing', retries: 1 });

    configs.closeFailing = null;
    now = new Date(now.getTime() + 60 * 60_000);
    await closing().processDue();

    expect(only()).toMatchObject({
      current: 'closed',
      closedBecause: 'stale',
      closeFailure: null,
    });
    expect(configs.closings).toEqual([1]);
    expect(configs.comments).toEqual([{ number: 1, body: STALE_COMMENT }]);
  });

  it('records the merge instead of closing when GitHub says the pull request already merged', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    configs.statuses.set(1, { state: 'merged', closedAt: later(50) });
    await closing().processDue();

    expect(only()).toMatchObject({ current: 'merged' });
    expect(configs.closings).toEqual([]);
  });

  it('records the close without closing again when GitHub says the pull request already closed', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    configs.statuses.set(1, { state: 'closed', closedAt: later(50) });
    await closing().processDue();

    expect(only()).toMatchObject({ current: 'closed', closedBecause: 'stale' });
    expect(configs.closings).toEqual([]);
  });

  it('closes as stale with the failure recorded when GitHub refuses the close for good', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    configs.closeFailing = new ConfigRepositoryError(
      'repository-unreachable',
      'Spotlight’s GitHub App is not installed.',
    );
    await closing().processDue();

    expect(only()).toMatchObject({ current: 'closed', closedBecause: 'stale' });
    expect(only().closeFailure).toMatchObject({
      code: 'repository-unreachable',
    });
  });

  it('closes as stale with the failure recorded after the last transient failure', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    configs.closeFailing = new Error('GitHub is down');

    for (let tries = 0; tries < MAX_RETRIES; tries += 1) {
      await closing().processDue();
      now = new Date(now.getTime() + 24 * 60 * 60_000);
    }

    expect(only()).toMatchObject({ current: 'closed', closedBecause: 'stale' });
    expect(only().closeFailure).toMatchObject({
      code: 'github-error',
      message: 'GitHub is down',
    });
  });

  it('records the close even when the comment fails', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    configs.commentFailing = new Error('GitHub is down');
    await closing().processDue();

    expect(only()).toMatchObject({
      current: 'closed',
      closedBecause: 'stale',
      closeFailure: null,
    });
    expect(configs.comments).toEqual([]);
  });

  it('closes it as stale once it opens when the live config changed while it was opening', async () => {
    await pick();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await opening().processDue();
    await following().check(only().id);

    expect(only()).toMatchObject({
      current: 'closing',
      closedBecause: 'stale',
    });
  });

  it('keeps it open when the live config became the one it proposes, and records the merge after', async () => {
    await opened();
    liveIs(PROPOSED);
    await following().lineChanged(STATION_VIEW.lineId);

    expect(only().current).toBe('opened');

    await closedOnGitHub(true);

    expect(only()).toMatchObject({ current: 'merged' });
    expect(configs.closings).toEqual([]);
  });

  it('records a merge that arrives after a stale close', async () => {
    await opened();
    liveIs(StationFingerprint.of('c'.repeat(64)));
    await following().lineChanged(STATION_VIEW.lineId);
    await closing().processDue();
    await closedOnGitHub(true);

    expect(only()).toMatchObject({ current: 'merged', closedBecause: null });
  });

  it('matches GitHub by workspace and GitHub id, or by repository in any case and number without an id', async () => {
    await opened();
    await closedOnGitHub(false, { workspaceId: 'workspace_other' });
    await closedOnGitHub(false, { gitHubId: 999 });
    await closedOnGitHub(false, { number: 2, gitHubId: null });

    expect(only().current).toBe('opened');

    await closedOnGitHub(false, {
      gitHubId: null,
      repository: 'ACME/platform',
    });

    expect(only()).toMatchObject({
      current: 'closed',
      closedBecause: 'by-person',
    });
    expect(await pullRequests.openAtStation(STATION_VIEW.stationId)).toBe(
      false,
    );
  });

  it('reopens a pull request reopened on GitHub', async () => {
    await opened();
    await closedOnGitHub(false);
    await following().reopenedOnGitHub(onGitHub());

    expect(only()).toMatchObject({ current: 'opened', closedBecause: null });
  });

  it('reconciles an opened pull request with GitHub after six hours without a check', async () => {
    await opened();
    configs.statuses.set(1, { state: 'closed', closedAt: later(50) });
    await reconciling().processDue();

    expect(only().current).toBe('opened');

    now = new Date(now.getTime() + 6 * 60 * 60_000 + 1);
    await reconciling().processDue();

    expect(only()).toMatchObject({
      current: 'closed',
      closedBecause: 'by-person',
    });
  });

  it('records a check when GitHub says it is still open', async () => {
    await opened();
    now = new Date(now.getTime() + 6 * 60 * 60_000 + 1);
    await reconciling().processDue();

    expect(only()).toMatchObject({ current: 'opened', checkedAt: now });
  });

  it('withdraws a pick as pull-request-open when another config pull request is open at its station', async () => {
    const world = replayedWorld(true);
    const runIds = searchRunIds();
    const finished = world.search.heldOut.reduce(
      (each, held) =>
        each.recordReplayStopReason(
          held.replay.replayId,
          'finished',
          charged,
          later(2),
          runIds,
          true,
        ),
      world.search,
    );

    expect(finished.current).toBe('finished');

    search = finished.picked({ outcome: 'picked', candidateId: TERSE });
    search.pullEvents();
    memory.searches.set(search.id.value, search);
    await pullRequests.add(
      ConfigPullRequest.pick({
        id: ConfigPullRequestId.of('pr_elsewhere'),
        searchId: SearchId.of('search_elsewhere'),
        candidateId: TERSE,
        station: search.station,
        stationKey: 'build',
        candidateName: 'other',
        lineKey: 'delivery',
        source: {
          repository: Repository.of('acme/platform'),
          path: 'teams/core/delivery.tf',
        },
        at: NOW,
        by: ChangeActor.spotlight(search.workspaceId),
      }),
    );

    await pick();

    expect(memory.searches.get(search.id.value)?.pick).toEqual({
      outcome: 'declined',
      reason: 'pull-request-open',
    });
    expect(pullRequests.stored.size).toBe(1);
  });

  it('remembers a config closed on GitHub and restarts the cooldown, forgets it when reopened, and records when a merge improved the station', async () => {
    const schedule = StationSearchSchedule.create({
      station: search.station,
      setId: search.setId,
      at: NOW,
    });
    const pullRequestId = ConfigPullRequestId.of('pr_1');
    const closedBy = (because: 'stale' | 'by-person') =>
      new ConfigPullRequestClosed(
        pullRequestId,
        search.workspaceId,
        search.teamId,
        STATION_VIEW.stationId,
        because,
        FINGERPRINT,
        PROPOSED,
        later(50),
      );

    memory.schedules.set(STATION_VIEW.stationId, schedule);
    await schedules().rejected(closedBy('stale'));

    expect(memory.schedules.get(STATION_VIEW.stationId)?.rejected).toEqual([]);

    await schedules().rejected(closedBy('by-person'));
    await schedules().improved(
      new ConfigPullRequestMerged(
        pullRequestId,
        search.workspaceId,
        search.teamId,
        STATION_VIEW.stationId,
        later(60),
      ),
    );

    expect(memory.schedules.get(STATION_VIEW.stationId)).toMatchObject({
      rejected: [PROPOSED],
      rejectedAgainst: FINGERPRINT,
      lastRejectedAt: later(50),
      cooldownFrom: later(50),
      lastImprovedAt: later(60),
    });

    await schedules().reopened(
      new ConfigPullRequestReopened(
        pullRequestId,
        search.workspaceId,
        search.teamId,
        STATION_VIEW.stationId,
        'by-person',
        PROPOSED,
        later(70),
      ),
    );

    expect(memory.schedules.get(STATION_VIEW.stationId)).toMatchObject({
      rejected: [],
      lastRejectedAt: later(50),
    });
  });
});
