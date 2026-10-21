import { PickSearchCandidateHandler } from '@replays/application/commands/handlers/pick-search-candidate.handler';
import { PickSearchCandidateCommand } from '@replays/application/commands/pick-search-candidate.command';
import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type {
  ConfigCommit,
  ConfigPullRequestOpening,
  ConfigRepositoryPort,
} from '@replays/application/ports/config-repository.port';
import type {
  StationSourceEdit,
  StationSourceEdited,
  StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { replayedWorld } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  ACTOR,
  accessFor,
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
import { SetHealths } from '@replays/application/services/set-healths.service';
import {
  ConfigPullRequest,
  MAX_RETRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import {
  aSearch,
  candidateOf,
  later,
  NOW,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

class FakeConfigs implements ConfigRepositoryPort {
  readonly commits: ConfigCommit[] = [];
  readonly openings: ConfigPullRequestOpening[] = [];
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

    return `https://github.com/${repository.value}/pull/${at < 0 ? this.openings.length : at + 1}`;
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

const picking = (mayPlan = true) =>
  new PickSearchCandidateHandler(
    accessFor(memory, work, mayPlan),
    work,
    pullRequests,
    IDS,
    clock,
    TRANSACTION,
  );

const pick = (candidateId = TERSE.value, mayPlan = true) =>
  picking(mayPlan).execute(
    new PickSearchCandidateCommand(
      STATION_VIEW.teamId.value,
      search.id.value,
      candidateId,
      ACTOR,
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
  it('opens one pull request however often it is picked', async () => {
    const first = await pick();
    const again = await pick();

    expect(first).toMatchObject({
      outcome: 'picked',
      pullRequest: {
        state: 'opening',
        repository: 'acme/platform',
        path: 'teams/core/delivery.tf',
        branch: `spotlight/search-${search.id.value.slice(0, 8)}-terse`,
      },
    });
    expect(again).toMatchObject({ outcome: 'already' });

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

  it('rejects the seed and denies a reader who may not plan', async () => {
    await expect(pick(search.seed.candidateId.value)).rejects.toThrow(
      'The seed is already the station’s live config.',
    );
    expect(await pick(TERSE.value, false)).toMatchObject({
      outcome: 'forbidden',
    });
    expect(pullRequests.stored.size).toBe(0);
  });

  it('records why the file could not be edited, and tries again when picked again', async () => {
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

    expect(only()).toMatchObject({ current: 'failed', generation: 1 });
    expect(only().reason).toMatchObject({
      code: 'computed-attribute',
      wanted: 'Build it.',
    });
    expect(configs.commits).toEqual([]);

    editor.answer = { ok: true, files: [], unchecked: ['judge.rubric'] };
    expect(await pick()).toMatchObject({
      outcome: 'picked',
      pullRequest: { state: 'opening', generation: 2, reason: null },
    });
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
    await pick();
    await opening().processDue();

    expect(only().reason?.code).toBe('file-missing');
  });

  it('fails at once on what GitHub rejects for good, and writes over only its own branch on a new attempt', async () => {
    configs.failing = null;
    await pick();
    const opened = configs.opened.bind(configs);

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

    configs.opened = opened;
    await pick();
    await opening().processDue();

    expect(configs.commits[1]?.replacing).toBe('commit_1');
    expect(only()).toMatchObject({ current: 'opened', lastCommit: 'commit_2' });
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
