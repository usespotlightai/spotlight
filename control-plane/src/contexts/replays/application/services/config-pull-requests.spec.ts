import { PickSearchCandidateHandler } from '@replays/application/commands/handlers/pick-search-candidate.handler';
import { PickSearchCandidateCommand } from '@replays/application/commands/pick-search-candidate.command';
import { ConfigRepositoryRefusedError } from '@replays/application/errors/config-repository-refused.error';
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
  AT_HAND,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  peopleWho,
  QUIET,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SetNoises } from '@replays/application/services/set-noises.service';
import {
  ConfigPullRequest,
  MOST_TRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
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
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

class FakeConfigs implements ConfigRepositoryPort {
  readonly commits: ConfigCommit[] = [];
  readonly openings: ConfigPullRequestOpening[] = [];
  failing: Error | null = null;
  holds = true;

  async fileAt(_workspace: unknown, _repository: unknown, path: string) {
    if (this.failing) {
      throw this.failing;
    }

    return this.holds
      ? { path, content: 'resource "spotlight_line" "x" {}\n', commit: 'c1' }
      : null;
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
  readonly asked: StationSourceEdit[] = [];
  answer: StationSourceEdited = {
    ok: true,
    files: [{ path: 'teams/core/delivery.tf', content: 'edited\n' }],
    unchecked: [],
  };

  async edited(edit: StationSourceEdit) {
    this.asked.push(edit);

    return this.answer;
  }
}

const charged = { spent: Spend.of(1, 'USD'), unpriced: 0 };

const TERSE = CandidateId.of('candidate_terse');

const searchWithTerse = (): Search => {
  const runIds = searchRunIds();

  return aSearch()
    .replayEnded(ReplayId.of('replay_seed'), 'finished', charged, NOW, runIds)
    .admitted(RunId.of('search_run_1'), {
      candidateId: TERSE,
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .replayEnded(
      ReplayId.of('replay_terse'),
      'finished',
      charged,
      later(1),
      runIds,
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
      AT_HAND.teamId.value,
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
    new SetNoises(work, memory.replayRepository, memory.candidateRepository),
  );

const only = (): ConfigPullRequest => {
  const [kept, ...rest] = pullRequests.kept.values();

  if (!kept || rest.length > 0) {
    throw new Error(`expected one pull request, found ${rest.length + 1}`);
  }

  return kept;
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
    candidateOf('proposed', TERSE.value),
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

    await opening().workDue();
    await opening().workDue();

    expect(only()).toMatchObject({
      current: 'opened',
      url: 'https://github.com/acme/platform/pull/1',
      lastCommit: 'commit_1',
    });
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
      `https://app.example.com/w/acme/team/${AT_HAND.teamId.value}/lines/${AT_HAND.lineId}/stations/${AT_HAND.stationId}/searches/${search.id.value}`,
    );
    expect(editor.asked[0]).toMatchObject({
      lineKey: 'delivery',
      stationKey: 'build',
      file: { path: 'teams/core/delivery.tf' },
    });
  });

  it('refuses the seed and a reader who may not plan', async () => {
    await expect(pick(search.seed.candidateId.value)).rejects.toThrow(
      'The seed is the station’s live config already',
    );
    expect(await pick(TERSE.value, false)).toMatchObject({
      outcome: 'forbidden',
    });
    expect(pullRequests.kept.size).toBe(0);
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
    await opening().workDue();

    expect(only()).toMatchObject({ current: 'refused', attempts: 1 });
    expect(only().reason).toMatchObject({
      code: 'computed-attribute',
      wanted: 'Build it.',
    });
    expect(configs.commits).toEqual([]);

    editor.answer = { ok: true, files: [], unchecked: ['judge.rubric'] };
    expect(await pick()).toMatchObject({
      outcome: 'picked',
      pullRequest: { state: 'opening', attempts: 2, reason: null },
    });
    await opening().workDue();

    expect(only().current).toBe('opened');
    expect(configs.openings[0]?.body).toContain('## Not checked');
    expect(configs.openings[0]?.body).toContain('`judge.rubric`');
  });

  it('refuses a repository the GitHub App cannot reach, and a file it does not hold', async () => {
    configs.failing = new ConfigRepositoryRefusedError(
      'repository-unreachable',
      'not installed',
    );
    await pick();
    await opening().workDue();

    expect(only().reason).toMatchObject({
      code: 'repository-unreachable',
      message: 'not installed',
    });

    configs.failing = null;
    configs.holds = false;
    await pick();
    await opening().workDue();

    expect(only().reason?.code).toBe('file-missing');
  });

  it('gives up at once on what GitHub refuses for good, and writes over only its own branch on a new attempt', async () => {
    configs.failing = null;
    await pick();
    const opened = configs.opened.bind(configs);

    configs.opened = async () => {
      throw new ConfigRepositoryRefusedError(
        'github-refused',
        'Resource not accessible by integration',
      );
    };
    await opening().workDue();

    expect(only()).toMatchObject({
      current: 'refused',
      tries: 0,
      lastCommit: 'commit_1',
    });
    expect(only().reason).toMatchObject({
      code: 'github-refused',
      message: 'Resource not accessible by integration',
    });

    configs.opened = opened;
    await pick();
    await opening().workDue();

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
    await opening().workDue();

    expect(only()).toMatchObject({ current: 'opening', tries: 1 });

    configs.opened = opened;
    now = new Date(now.getTime() + 60 * 60_000);
    await opening().workDue();

    expect(only()).toMatchObject({
      current: 'opened',
      url: 'https://github.com/acme/platform/pull/1',
    });
    expect(configs.openings).toHaveLength(1);
    expect(configs.commits[1]?.replacing).toBe('commit_1');
  });

  it('tries again later when GitHub fails, and gives up after the last try', async () => {
    configs.failing = new Error('GitHub is down');
    await pick();
    await opening().workDue();

    expect(only()).toMatchObject({ current: 'opening', tries: 1 });
    await opening().workDue();
    expect(only().tries).toBe(1);

    for (let tries = 1; tries < MOST_TRIES; tries += 1) {
      now = new Date(now.getTime() + 24 * 60 * 60_000);
      await opening().workDue();
    }

    expect(only()).toMatchObject({ current: 'refused' });
    expect(only().reason).toMatchObject({
      code: 'github-refused',
      message: 'GitHub is down',
    });
  });

  it('is refused at once when the line names no source', async () => {
    work.station = async () => ({ ...AT_HAND, source: null });
    await pick();
    await opening().workDue();

    expect(only().reason?.code).toBe('no-source');
    expect(editor.asked).toEqual([]);
  });

  it('says the held-out result was still pending when its held-out replay had not finished', async () => {
    const world = replayedWorld(true);
    const pending = replayFor(
      world.set,
      'replay_held_terse',
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
    await opening().workDue();

    expect(configs.openings[0]?.body).toContain(
      'Its held-out replay had not finished when this pull request opened',
    );
  });
});
