import { ProposeSearchCandidateHandler } from '@replays/application/commands/handlers/propose-search-candidate.handler';
import { RecordSearchCauseHandler } from '@replays/application/commands/handlers/record-search-cause.handler';
import { StartSearchHandler } from '@replays/application/commands/handlers/start-search.handler';
import { StopSearchHandler } from '@replays/application/commands/handlers/stop-search.handler';
import { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import { RecordSearchCauseCommand } from '@replays/application/commands/record-search-cause.command';
import {
  type SearchBudgetAsked,
  type SearchObjectiveAsked,
  StartSearchCommand,
} from '@replays/application/commands/start-search.command';
import { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import type { SearchCandidateProposed } from '@replays/application/dto/replay-outcomes.dto';
import type { SearchNotice } from '@replays/application/ports/search-notices.port';
import { EstimateSearchQuery } from '@replays/application/queries/estimate-search.query';
import { EstimateSearchHandler } from '@replays/application/queries/handlers/estimate-search.handler';
import { ReadSearchHandler } from '@replays/application/queries/handlers/read-search.handler';
import { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import { AbandonSearches } from '@replays/application/services/abandon-searches.service';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import { LetSearchGo } from '@replays/application/services/let-search-go.service';
import { NoteSearchProgress } from '@replays/application/services/note-search-progress.service';
import { NoticeSearchReflections } from '@replays/application/services/notice-search-reflections.service';
import {
  ACTOR,
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  PERSON,
  peopleWho,
  QUIET,
  snapshotsFor,
  stationsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { SearchSights } from '@replays/application/services/search-sights.service';
import { SetHealths } from '@replays/application/services/set-healths.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { SearchAbandonmentDue } from '@replays/domain/events/search-abandonment-due.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutWanted } from '@replays/domain/events/search-holding-out-wanted.event';
import { SearchIterationWanted } from '@replays/domain/events/search-iteration-wanted.event';
import { SearchReflected } from '@replays/domain/events/search-reflected.event';
import { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import { UnknownSearchRunError } from '@replays/domain/exceptions/unknown-search-run.error';
import {
  aSet,
  candidateOf,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  NOW,
  replayedAs,
  replayFor,
  STATION,
  sha256,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const DIGEST = { sha256 };

const healthsFor = () =>
  new SetHealths(work, memory.replayRepository, memory.candidateRepository);

const BUDGET: SearchBudgetAsked = {
  iterations: 2,
  perIteration: 2,
  ceiling: { amount: 100, currency: 'USD' },
  concurrency: null,
  repeats: null,
};

const AGENT = { harness: 'claude-code', model: 'opus', effort: 'high' };

const SEED_BLOCK = { key: 'build', name: 'Build', kind: 'work' };

const starting = (mayPlan = true) =>
  new StartSearchHandler(
    accessFor(memory, work, mayPlan),
    work,
    snapshotsFor(memory, work, mayPlan),
    memory.setRepository,
    memory.replayRepository,
    memory.searchRepository,
    DIGEST,
    IDS,
    CLOCK,
    TRANSACTION,
    stationsFor(memory, work),
    healthsFor(),
  );

const start = async (
  over: {
    budget?: SearchBudgetAsked;
    mayPlan?: boolean;
    setId?: string;
    objective?: SearchObjectiveAsked;
  } = {},
) =>
  starting(over.mayPlan).execute(
    new StartSearchCommand(
      'team_1',
      STATION.lineId,
      STATION.stationId,
      over.setId ?? 'set_1',
      AGENT,
      over.budget ?? BUDGET,
      over.objective ?? null,
      ACTOR,
    ),
  );

const progress = () =>
  new NoteSearchProgress(
    memory.searchRepository,
    memory.replayRepository,
    healthsFor(),
    IDS,
    CLOCK,
    TRANSACTION,
  );

const iterating = () =>
  new DispatchSearchIteration(
    memory.searchRepository,
    memory.candidateRepository,
    memory.replayRepository,
    healthsFor(),
    work,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const holdingOut = () =>
  new HoldOutSearch(
    memory.searchRepository,
    memory.replayRepository,
    memory.candidateRepository,
    memory.setRepository,
    IDS,
    CLOCK,
    TRANSACTION,
    healthsFor(),
  );

const lettingGo = () =>
  new LetSearchGo(memory.replayRepository, work, CLOCK, TRANSACTION);

const abandoning = () =>
  new AbandonSearches(memory.searchRepository, work, CLOCK, TRANSACTION);

const delivered = async (): Promise<void> => {
  for (
    let events = memory.events.splice(0);
    events.length > 0;
    events = memory.events.splice(0)
  ) {
    for (const event of events) {
      if (event instanceof ReplayEnded) {
        await progress().replayEnded(event);
      } else if (event instanceof SearchIterationWanted) {
        await iterating().wanted(event.searchId);
      } else if (event instanceof SearchHoldingOutWanted) {
        await holdingOut().wanted(event.searchId);
      } else if (event instanceof SearchEnded) {
        await lettingGo().ended(event);
      } else if (event instanceof SearchReflected) {
        await noticing().reflected(event);
      } else if (event instanceof SearchStalledUnreflected) {
        await noticing().stalledUnreflected(event);
      }
    }
  }
};

let noticed: SearchNotice[];

const noticing = () =>
  new NoticeSearchReflections(memory.searchRepository, work, {
    told: async (notice) => {
      noticed.push(notice);
    },
  });

const recording = () =>
  new RecordSearchCauseHandler(
    work,
    memory.searchRepository,
    CLOCK,
    TRANSACTION,
  );

const cause = (
  run: string,
  taskId: string,
  kind: string,
  suggestion: string | null = null,
) =>
  recording().execute(
    new RecordSearchCauseCommand(
      run,
      'runner_1',
      taskId,
      kind,
      `Task ${taskId} failed for the ${kind}.`,
      suggestion,
    ),
  );

const proposing = () =>
  new ProposeSearchCandidateHandler(
    peopleWho(true),
    work,
    memory.searchRepository,
    memory.candidateRepository,
    memory.replayRepository,
    memory.setRepository,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const propose = (
  run: string,
  name: string,
  station: unknown = { ...SEED_BLOCK, prompt: `Try ${name}.` },
  hypothesis = 'A firmer prompt keeps it on task.',
): Promise<SearchCandidateProposed> =>
  proposing().execute(
    new ProposeSearchCandidateCommand(
      run,
      'runner_1',
      name,
      hypothesis,
      station,
    ),
  );

const theSearch = (): Search => [...memory.searches.values()][0] as Search;

const replayed = async (
  replayId: string,
  succeeds: (original: string) => boolean,
  cost = 1,
): Promise<void> => {
  const replay = memory.replays.get(replayId);

  if (!replay) {
    throw new Error(`no replay ${replayId}`);
  }

  await memory.replayRepository.save(
    replayedAs(
      replay,
      (original) => (succeeds(original) ? 'completed' : 'failed'),
      cost,
    ),
  );
  await delivered();
};

const heldRun = (): string => {
  const run = theSearch().heldRun;

  if (!run) {
    throw new Error('the search holds no run');
  }

  work.heldSearchRuns.set(run.value, {
    searchId: theSearch().id,
    iteration: theSearch().iterationOf(run)?.number ?? 0,
  });

  return run.value;
};

const NO_SPEND = ModelSpent.of([], 0);

const runEnds = async (
  run: string,
  outcome = 'completed',
  spent: ModelSpent | null = NO_SPEND,
) => {
  await progress().runEnded({
    runId: run,
    outcome,
    asked: false,
    started: outcome !== 'withdrawn',
  });
  await delivered();
  if (spent) {
    await progress().digested(run, spent);
    await delivered();
  }
};

const advancing = () =>
  new AdvanceSearches(
    memory.searchRepository,
    memory.replayRepository,
    work,
    iterating(),
    holdingOut(),
    progress(),
    lettingGo(),
    CLOCK,
    QUIET,
  );

const seeded = async (budget = BUDGET) => {
  const started = await start({ budget });

  if (started.outcome !== 'started') {
    throw new Error('the search did not start');
  }

  await delivered();
  await replayed(started.seedReplayId, () => true, 0.5);

  return started;
};

beforeEach(async () => {
  noticed = [];
  memory = new InMemoryReplays();
  work = new FakeWork();
  work.live = async () => ({
    lineKey: 'delivery',
    block: StationBlock.of(SEED_BLOCK),
    fingerprint: LIVE_FINGERPRINT,
    scoring: UNSCORED,
    digests: LIVE_DIGESTS,
    threshold: null,
  });
  await memory.setRepository.add(aSet(10));
  memory.events.splice(0);
});

describe('StartSearchHandler', () => {
  it('replays the live config over the whole set first, in the search’s own pool, within its allotted ceiling', async () => {
    const started = await start();

    if (started.outcome !== 'started') {
      throw new Error('the search did not start');
    }

    const search = theSearch();
    const seed = memory.replays.get(started.seedReplayId);

    expect(search.current).toBe('seeding');
    expect(search.split.heldOutTasks).toBe(3);
    expect(seed?.baseline).toBe(true);
    expect(seed?.searchId?.equals(search.id)).toBe(true);
    expect(seed?.entries).toHaveLength(10);
    expect(seed?.ceiling.equals(search.allotment.seed)).toBe(true);
    expect(work.searchesDispatched).toHaveLength(0);
  });

  it('looks for the same success at less cost on a set the live config saturates, and warns of it, unless told otherwise', async () => {
    await memory.candidateRepository.add(
      candidateOf('live', 'candidate_saturating', null, null, LIVE_FINGERPRINT),
    );
    await memory.replayRepository.add(
      replayedAs(
        replayFor(
          aSet(10),
          'replay_saturating',
          'candidate_saturating',
          null,
          true,
          1,
          null,
        ),
        () => 'completed',
      ),
    );

    const started = await start();

    if (started.outcome !== 'started') {
      throw new Error('the search did not start');
    }

    expect(started.objective).toBe('cost');
    expect(started.warnings).toContainEqual({ kind: 'saturated', rate: 1 });
    expect(memory.searches.get(started.id)?.objective).toBe('cost');
  });

  it('looks for success on a set the live config does not saturate, and as told on one it does', async () => {
    const plain = await start();

    expect(plain.outcome === 'started' && plain.objective).toBe('success');

    await new StopSearchHandler(
      accessFor(memory, work, true),
      memory.searchRepository,
      CLOCK,
      TRANSACTION,
    ).execute(
      new StopSearchCommand(
        'team_1',
        plain.outcome === 'started' ? plain.id : '',
        ACTOR,
      ),
    );
    await memory.candidateRepository.add(
      candidateOf('live', 'candidate_saturating', null, null, LIVE_FINGERPRINT),
    );
    await memory.replayRepository.add(
      replayedAs(
        replayFor(
          aSet(10),
          'replay_saturating',
          'candidate_saturating',
          null,
          true,
          1,
          null,
        ),
        () => 'completed',
      ),
    );

    const told = await start({ objective: 'success' });

    expect(told.outcome === 'started' && told.objective).toBe('success');
  });

  it('refuses a second search of the station, a harness no runner starts, a set elsewhere, and a caller who may not plan', async () => {
    await start();

    await expect(start()).rejects.toMatchObject({ kind: 'conflict' });

    work.refusingAgent = { field: 'harness', reason: 'is unknown' };
    expect(await start()).toMatchObject({
      outcome: 'invalid',
      problems: [expect.objectContaining({ reason: 'is unknown' })],
    });
    work.refusingAgent = null;

    await expect(start({ setId: 'set_elsewhere' })).rejects.toMatchObject({
      kind: 'not-found',
    });
    expect(await start({ mayPlan: false })).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
    expect(
      [...memory.candidates.values()].filter((each) => each.isLive),
    ).toHaveLength(1);
  });

  it('refuses a set with too few tasks to hold some out, and lets go of the live snapshot it took', async () => {
    memory.sets.clear();
    await memory.setRepository.add(aSet(4));

    const refused = await start();

    expect(
      refused.outcome === 'invalid' &&
        refused.problems.map((each) => each.field.rendered),
    ).toEqual(['setId']);
    expect(memory.candidates.size).toBe(0);
  });

  it('names the field of each term it refuses', async () => {
    const refused = await starting().execute(
      new StartSearchCommand(
        'team_1',
        STATION.lineId,
        STATION.stationId,
        'set_1',
        { harness: ' ', model: 'm'.repeat(201), effort: '' },
        {
          iterations: 11,
          perIteration: 0,
          ceiling: { amount: 0, currency: 'USD' },
          concurrency: 99,
          repeats: null,
        },
        null,
        ACTOR,
      ),
    );

    expect(
      refused.outcome === 'invalid' &&
        refused.problems.map((each) => each.field.rendered),
    ).toEqual(['agent.harness', 'agent.model', 'agent.effort']);

    const budget = await start({
      budget: {
        iterations: 11,
        perIteration: 0,
        ceiling: { amount: 0, currency: 'USD' },
        concurrency: 99,
        repeats: null,
      },
    });

    expect(
      budget.outcome === 'invalid' &&
        budget.problems.map((each) => each.field.rendered),
    ).toEqual([
      'budget.ceiling.amount',
      'budget.iterations',
      'budget.perIteration',
      'budget.concurrency',
    ]);

    const low = await start({
      budget: {
        iterations: 10,
        perIteration: 5,
        ceiling: { amount: 0.5, currency: 'USD' },
        concurrency: null,
        repeats: null,
      },
    });

    expect(
      low.outcome === 'invalid' &&
        low.problems.map((each) => each.field.rendered),
    ).toEqual(['budget.ceiling.amount']);
    expect(memory.searches.size).toBe(0);
  });
});

describe('a search’s iterations', () => {
  it('runs its agent once the seed ended, briefed with the station, its budget and the held-out count, never which', async () => {
    await seeded();

    const search = theSearch();
    const [order] = work.searchesDispatched;

    expect(search.current).toBe('searching');
    expect(search.iterations[0]?.current).toBe('running');
    expect(order?.iteration).toBe(1);
    expect(order?.agent.harness).toBe('claude-code');
    expect(order?.briefing).toContain('spotlight history --station build');
    expect(order?.briefing).toContain('spotlight candidate --name <name>');
    expect(order?.briefing).toContain('3 more tasks you never see');
    expect(order?.briefing).toContain('at most 2 candidates');
    for (const held of search.split.heldOut) {
      expect(order?.briefing).not.toContain(held.taskId.value);
    }
  });

  it('is stopped while seeding: its seed replay stops and its agent never runs', async () => {
    const started = await start();

    if (started.outcome !== 'started') {
      throw new Error('the search did not start');
    }

    await new StopSearchHandler(
      accessFor(memory, work),
      memory.searchRepository,
      CLOCK,
      TRANSACTION,
    ).execute(new StopSearchCommand('team_1', theSearch().id.value, ACTOR));
    await delivered();

    expect(theSearch().ending).toBe('stopped');
    expect(memory.replays.get(started.seedReplayId)?.current).toBe('stopped');
    expect(work.searchesDispatched).toHaveLength(0);
  });

  it('counts an iteration that could not start as failed, and stalls after two without looking into why when only one iteration is left', async () => {
    work.refusingSearch = 'no runner can start claude-code';

    await seeded({ ...BUDGET, iterations: 3 });

    expect(theSearch().current).toBe('finished');
    expect(theSearch().ending).toBe('stalled');
    expect(
      theSearch().iterations.map((each) => [each.kind, each.current]),
    ).toEqual([
      ['propose', 'failed'],
      ['propose', 'failed'],
    ]);
    expect(noticed).toEqual([
      expect.objectContaining({
        addressee: (PERSON as PersonPrincipal).userId,
        searchId: theSearch().id,
        about: 'stalled',
        endedSearch: true,
        headline:
          'The search for a better Build config ended with no budget left to reflect',
      }),
    ]);
  });

  it('retries an iteration whose dispatch failed, from the sweeper', async () => {
    const dispatch = work.dispatchSearch;
    work.dispatchSearch = async () => {
      throw new Error('the database went away');
    };

    await expect(seeded()).rejects.toThrow('the database went away');
    expect(theSearch().iterations[0]?.current).toBe('wanted');

    work.dispatchSearch = dispatch;
    await advancing().workDue();

    expect(theSearch().iterations[0]?.current).toBe('running');
    expect(work.searchesDispatched).toHaveLength(1);
  });
});

describe('a stalled search looking into why', () => {
  const stalledOn = async (
    budget: SearchBudgetAsked,
    failing: (original: string) => boolean,
  ) => {
    const started = await start({ budget });

    if (started.outcome !== 'started') {
      throw new Error('the search did not start');
    }

    await delivered();
    await replayed(started.seedReplayId, (original) => !failing(original), 0.5);
    await runEnds(heldRun(), 'failed');
    await runEnds(heldRun(), 'failed');
  };

  const searchedAt = (at: number) => {
    const entry = theSearch().split.searched[at];

    if (!entry) {
      throw new Error(`no searched task ${at}`);
    }

    return entry;
  };

  it('briefs its agent with the searched tasks the best config still fails, takes one cause each, never for a held-out task, and ends stalled telling who started it', async () => {
    work.standing = async (_workspace, runs) =>
      runs.map((runId) => ({
        runId,
        taskId: null,
        stationId: null,
        refusal: null,
        reason: null,
        title: runId.equals(searchedAt(0).runId) ? 'Drain the queue' : null,
        state: null,
        endedAt: null,
        origin: null,
      }));
    await stalledOn({ ...BUDGET, iterations: 5 }, (original) => {
      const search = theSearch();

      return [
        ...search.split.heldOutRuns,
        ...search.split.searchedRuns.slice(0, 2),
      ].some((each) => each.value === original);
    });

    const run = heldRun();
    const reflection = theSearch().iterationOf(RunId.of(run));
    const order = work.searchesDispatched[work.searchesDispatched.length - 1];

    expect(reflection?.kind).toBe('reflect');
    expect(reflection?.reflectedOn.map((each) => each.taskId)).toEqual([
      searchedAt(0).taskId,
      searchedAt(1).taskId,
    ]);
    expect(order?.briefing).toContain(`| \`${searchedAt(0).taskId.value}\` |`);
    for (const held of theSearch().split.heldOut) {
      expect(order?.briefing).not.toContain(held.taskId.value);
      await expect(cause(run, held.taskId.value, 'task')).rejects.toMatchObject(
        { kind: 'not-found' },
      );
    }
    await expect(cause(run, 'task_unknown', 'task')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(
      cause(run, searchedAt(0).taskId.value, 'luck'),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(propose(run, 'late')).rejects.toMatchObject({
      kind: 'conflict',
    });

    await cause(run, searchedAt(0).taskId.value, 'config');
    expect(
      await cause(
        run,
        searchedAt(0).taskId.value,
        'judge',
        'Loosen the rubric.',
      ),
    ).toEqual({
      taskId: searchedAt(0).taskId.value,
      cause: 'judge',
      replayRunId: reflection?.reflectedOn[0]?.replayRunId.value,
    });
    await cause(run, searchedAt(1).taskId.value, 'infra');
    await runEnds(run);

    expect(theSearch().current).toBe('finished');
    expect(theSearch().ending).toBe('stalled');
    expect(noticed).toEqual([
      expect.objectContaining({
        addressee: (PERSON as PersonPrincipal).userId,
        searchId: theSearch().id,
        about: 'iteration 3',
        endedSearch: true,
        points: [
          'No config change can fix the 2 tasks still failing. The rest of the budget stays unspent.',
          'Fix the judge’s rubric, for “Drain the queue”: Loosen the rubric.',
          `Fix what the run needed around the work, for one of the searched tasks: Task ${searchedAt(1).taskId.value} failed for the infra.`,
        ],
      }),
    ]);
  });

  it('searches on once it finds a cause the config can fix, and briefs the next iteration with it', async () => {
    await stalledOn(
      { ...BUDGET, iterations: 5 },
      (original) =>
        [...memory.searches.values()][0]?.split.searched[0]?.runId.value ===
        original,
    );

    const run = heldRun();

    await cause(
      run,
      searchedAt(0).taskId.value,
      'config',
      'Run the migrations first.',
    );
    await runEnds(run);

    expect(theSearch().current).toBe('searching');
    expect(theSearch().iterations.map((each) => each.kind)).toEqual([
      'propose',
      'propose',
      'reflect',
      'propose',
    ]);
    expect(
      work.searchesDispatched[work.searchesDispatched.length - 1]?.briefing,
    ).toContain('Suggested: Run the migrations first.');
    expect(noticed).toEqual([]);
  });

  it('fails the reflection without running it when no searched task fails', async () => {
    await stalledOn({ ...BUDGET, iterations: 5 }, () => false);

    expect(theSearch().ending).toBe('stalled');
    expect(theSearch().iterations[2]?.current).toBe('ended');
    expect(theSearch().iterations[2]?.outcome).toBe('no-failures');
    expect(work.searchesDispatched).toHaveLength(2);
    expect(noticed).toEqual([
      expect.objectContaining({
        endedSearch: true,
        points: [
          'Two iterations in a row found nothing better. The best config already passes every searched task.',
        ],
        headline:
          'The search for a better Build config ended with every searched task passing',
      }),
    ]);
  });
});

describe('ProposeSearchCandidateHandler', () => {
  it('replays a valid proposal on the searched runs only, within a search replay’s ceiling, once however often it is sent', async () => {
    await seeded();
    const run = heldRun();

    const proposed = await propose(run, 'firmer');
    const again = await propose(run, 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    const replay = memory.replays.get(proposed.replayId);
    const candidate = memory.candidates.get(proposed.candidateId);

    expect(again).toEqual(proposed);
    expect(candidate?.kind).toBe('searched');
    expect(candidate?.search?.hypothesis.value).toBe(
      'A firmer prompt keeps it on task.',
    );
    expect(replay?.originals.map((each) => each.value).sort()).toEqual(
      theSearch()
        .split.searchedRuns.map((each) => each.value)
        .sort(),
    );
    expect(replay?.ceiling.equals(theSearch().allotment.searchReplay)).toBe(
      true,
    );
    expect(theSearch().proposals).toHaveLength(1);
  });

  it('refuses a bad name, no hypothesis and a change a search may not make, as problems, counting the attempt', async () => {
    await seeded();
    const run = heldRun();

    const refused = await propose(
      run,
      'Not A Slug',
      { ...SEED_BLOCK, check: 'npm test' },
      '',
    );

    expect(refused.outcome).toBe('invalid');
    expect(
      refused.outcome === 'invalid' &&
        refused.problems.map((each) => each.field.rendered),
    ).toEqual(['name', 'hypothesis', 'station.check']);
    expect(theSearch().iterations[0]?.attempts).toBe(1);
    expect(theSearch().proposals).toHaveLength(0);

    expect((await propose(run, 'seed')).outcome).toBe('invalid');
  });

  it('refuses a proposal past the iteration’s candidates, and one from a run the search no longer holds', async () => {
    await seeded();
    const run = heldRun();

    await propose(run, 'one');
    await propose(run, 'two');

    await expect(propose(run, 'three')).rejects.toMatchObject({
      kind: 'conflict',
    });
    await expect(propose('elsewhere', 'four')).rejects.toMatchObject({
      kind: 'not-found',
      message: 'The search no longer holds this run',
    });

    await runEnds(run);

    await expect(propose(run, 'five')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});

describe('a search running its course', () => {
  it('runs its next iteration once the last one’s run and replays ended, holds out only its frontier, then finishes', async () => {
    await seeded();
    const first = heldRun();
    const strong = await propose(first, 'strong');
    const weak = await propose(first, 'weak');

    if (strong.outcome !== 'proposed' || weak.outcome !== 'proposed') {
      throw new Error('the proposals were refused');
    }

    await runEnds(first);

    expect(work.searchesDispatched).toHaveLength(1);

    await replayed(strong.replayId, () => true, 0.25);
    await replayed(weak.replayId, (original) => original.endsWith('_9'));

    expect(work.searchesDispatched).toHaveLength(2);

    const second = heldRun();

    await runEnds(second);

    const search = theSearch();

    expect(search.current).toBe('holding-out');
    expect(search.ending).toBe('iterations-spent');
    expect(search.heldOut.map((each) => each.candidateId.value)).toEqual([
      strong.candidateId,
    ]);

    const heldOutReplay = memory.replays.get(
      search.heldOut[0]?.replay.replayId.value ?? '',
    );

    expect(heldOutReplay?.originals.map((each) => each.value).sort()).toEqual(
      search.split.heldOutRuns.map((each) => each.value).sort(),
    );

    await replayed(heldOutReplay?.id.value ?? '', () => true);

    expect(theSearch().current).toBe('finished');

    const read = await new ReadSearchHandler(
      accessFor(memory, work),
      memory.replayRepository,
      memory.candidateRepository,
      new InMemoryConfigPullRequests(),
      healthsFor(),
    ).execute(new ReadSearchQuery('team_1', search.id.value, PERSON));

    expect(read.seed.name).toBe('seed');
    expect(read.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['strong', true],
        ['weak', false],
      ],
    );
    expect(read.candidates[0]?.heldOutScore).toBe(1);
    expect(read.best?.name).toBe('strong');
    expect(read.frontier).toContain(strong.candidateId);
  });

  it('withdraws its agent run and stops its replays once a person stops it', async () => {
    await seeded();
    const run = heldRun();
    const proposed = await propose(run, 'firmer');

    await new StopSearchHandler(
      accessFor(memory, work),
      memory.searchRepository,
      CLOCK,
      TRANSACTION,
    ).execute(new StopSearchCommand('team_1', theSearch().id.value, ACTOR));
    await delivered();

    expect(theSearch().ending).toBe('stopped');
    expect(work.searchesWithdrawn).toEqual([run]);
    expect(
      proposed.outcome === 'proposed' &&
        memory.replays.get(proposed.replayId)?.current,
    ).toBe('stopped');
  });
});

describe('SearchSights', () => {
  it('shows a search run the searched tasks and every candidate’s run on them, the seed’s included, and never a held-out task', async () => {
    await seeded();
    const run = heldRun();
    const proposed = await propose(run, 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    await replayed(proposed.replayId, () => true);

    const search = theSearch();
    const sight = await new SearchSights(
      memory.searchRepository,
      memory.candidateRepository,
      memory.replayRepository,
    ).of(run);
    const heldOut = search.split.heldOutRuns.map((each) => each.value);

    expect(sight.stationId).toBe(STATION.stationId);
    expect([...sight.hiddenTasks].sort()).toEqual(
      search.split.heldOut.map((each) => each.taskId.value).sort(),
    );
    expect([...sight.shownOriginals].sort()).toEqual(
      search.split.searchedRuns.map((each) => each.value).sort(),
    );
    expect(sight.candidates.map((each) => each.name)).toEqual([
      'seed',
      'firmer',
    ]);
    expect(sight.seedBlock).toEqual(SEED_BLOCK);
    for (const candidate of sight.candidates) {
      expect(candidate.runs).toHaveLength(7);
      expect(
        candidate.runs.some((each) => heldOut.includes(each.original)),
      ).toBe(false);
      expect(candidate.runs.every((each) => each.succeeded === true)).toBe(
        true,
      );
    }
  });

  it('sees no search for a run no search ran', async () => {
    await expect(
      new SearchSights(
        memory.searchRepository,
        memory.candidateRepository,
        memory.replayRepository,
      ).of('run_1'),
    ).rejects.toThrow(UnknownSearchRunError);
  });
});

describe('AbandonSearches', () => {
  it('abandons every search of a disbanded team, withdrawing the run it held', async () => {
    await seeded();
    const run = heldRun();

    const due = await abandoning().ofTeam(STATION.teamId, STATION.workspaceId);

    expect(due).toEqual([
      new SearchAbandonmentDue(theSearch().id, STATION.workspaceId),
    ]);
    expect(
      await abandoning().ofTeam(TeamId.of('team_2'), STATION.workspaceId),
    ).toEqual([]);

    await abandoning().search((due[0] as SearchAbandonmentDue).searchId);

    expect(memory.searches.size).toBe(0);
    expect(work.searchesWithdrawn).toEqual([run]);
  });

  it('ends the search of a set whose station left its line', async () => {
    await seeded();

    await abandoning().stationGone(theSearch().setId);

    expect(theSearch().ending).toBe('station-gone');
  });
});

describe('EstimateSearchHandler', () => {
  it('counts the runs and ceilings the budget allows, and times them from the set’s runs', async () => {
    for (const each of aSet(10).runs) {
      work.durationsOf.set(each.value, 60_000);
    }

    const answered = await new EstimateSearchHandler(
      accessFor(memory, work),
      work,
      healthsFor(),
    ).execute(
      new EstimateSearchQuery(
        'team_1',
        STATION.lineId,
        STATION.stationId,
        'set_1',
        BUDGET,
        null,
        PERSON,
      ),
    );

    if ('problems' in answered) {
      throw new Error('the estimate was refused');
    }

    const estimate = answered;
    const budget = SearchBudget.of({
      iterations: 2,
      perIteration: 2,
      ceiling: Spend.ceiling(100, 'USD'),
    });
    const split = HeldOutSplit.costliest(
      aSet(10).entries,
      (searched, heldOut) => budget.unitsFor(searched, heldOut),
    );
    const expected = estimateOf(budget, split, Array(10).fill(60_000));

    expect(estimate.runs).toEqual({
      seed: 10,
      searchReplays: 28,
      heldOutReplays: 6,
      agent: 2,
      total: 46,
    });
    expect(estimate.perReplayAllotments.searchReplay.amount).toBe(
      budget.allot(split).searchReplay.amount,
    );
    expect(estimate.estimatedDuration).toBe(expected.ms);
    expect(estimate.estimatedDuration).toBe(60_000 * (3 + 2 * (1 + 4) + 2));
    expect(memory.searches.size).toBe(0);
  });
});

describe('NoteSearchProgress', () => {
  it('closes an iteration that proposed nothing only once its late digest came, and charges an unpriced run its allotment', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const first = heldRun();

    await runEnds(first, 'completed', null);

    expect(theSearch().heldRun).toBeNull();
    expect(work.searchesDispatched).toHaveLength(1);

    const before = theSearch().spent;

    await progress().digested(first, ModelSpent.of([], 1));
    await delivered();

    expect(
      theSearch().spent.equals(before.plus(theSearch().allotment.agentRun)),
    ).toBe(true);
    expect(work.searchesDispatched).toHaveLength(2);

    const second = heldRun();
    const charged = theSearch().spent;

    await runEnds(second, 'completed', NO_SPEND);

    expect(theSearch().spent.equals(charged)).toBe(true);
    expect(theSearch().iterations[1]?.agentSpent?.unpriced).toBe(0);
  });

  it('closes an iteration whose run was withdrawn before it started without waiting for a digest', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const first = heldRun();

    await runEnds(first, 'withdrawn', null);

    expect(theSearch().iterations.map((each) => each.current)).toEqual([
      'failed',
      'running',
    ]);
  });
});

describe('AdvanceSearches', () => {
  it('sees a replay end, a run end and a digest whose word was lost, and an unclaimed run left too long', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const first = heldRun();
    const proposed = await propose(first, 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    const replay = memory.replays.get(proposed.replayId);

    await memory.replayRepository.save(
      replayedAs(replay as never, () => 'completed', 0.5),
    );
    memory.events.splice(0);
    work.runStandings.set(first, {
      run: theSearch().heldRun as never,
      phase: 'ended',
      failed: false,
      started: true,
      queuedAt: new Date(NOW.getTime() - 30 * 60_000),
      endedAt: new Date(NOW.getTime() - 16 * 60_000),
    });

    await advancing().workDue();

    const iteration = theSearch().iterations[0];

    expect(iteration?.current).toBe('ended');
    expect(iteration?.proposals[0]?.replay.end).toBe('finished');
    expect(iteration?.agentSpent?.unpriced).toBe(1);
    expect(theSearch().iterations).toHaveLength(2);

    const second = theSearch().heldRun;

    work.runStandings.set(second?.value ?? '', {
      run: second as never,
      phase: 'queued',
      failed: true,
      started: false,
      queuedAt: new Date(NOW.getTime() - 61 * 60_000),
      endedAt: null,
    });

    work.unclaimed = { outcome: 'claimed' };

    await advancing().workDue();

    expect(theSearch().iterations[1]?.current).toBe('running');
    expect(theSearch().iterations[1]?.agentSpent).toBeNull();

    work.unclaimed = { outcome: 'withdrawn', started: true };

    await advancing().workDue();

    expect(work.unclaimedWithdrawn).toEqual([second?.value]);
    expect(theSearch().iterations[1]?.current).toBe('failed');
    expect(theSearch().iterations[1]?.agentSpent).toBeNull();
    expect(theSearch().awaitingAgentSpend.map((each) => each.number)).toEqual([
      2,
    ]);
  });

  it('fails an iteration whose never-started run it let go, with nothing spent', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const first = heldRun();

    work.runStandings.set(first, {
      run: theSearch().heldRun as never,
      phase: 'queued',
      failed: true,
      started: false,
      queuedAt: new Date(NOW.getTime() - 61 * 60_000),
      endedAt: null,
    });

    await advancing().workDue();

    expect(work.unclaimedWithdrawn).toEqual([first]);
    expect(theSearch().iterations[0]?.current).toBe('failed');
    expect(theSearch().iterations[0]?.agentSpent?.unpriced).toBe(0);
    expect(theSearch().iterations).toHaveLength(2);
  });

  it('never ends a replay admitted after it last looked, though its row is not there yet', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const run = heldRun();
    const seen = theSearch();
    const proposed = await propose(run, 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    await progress().reconcile(seen, []);

    expect(theSearch().proposals[0]?.replay.hasEnded).toBe(false);

    memory.replays.delete(proposed.replayId);
    await progress().reconcile(seen, []);

    expect(theSearch().proposals[0]?.replay.hasEnded).toBe(false);

    await progress().reconcile(theSearch(), []);

    expect(theSearch().proposals[0]?.replay.end).toBe('abandoned');
  });

  it('counts a search replay whose row is gone as ended with nothing spent', async () => {
    await seeded({ ...BUDGET, iterations: 3 });
    const proposed = await propose(heldRun(), 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    memory.replays.delete(proposed.replayId);

    await advancing().workDue();

    expect(theSearch().proposals[0]?.replay.end).toBe('abandoned');
    expect(theSearch().proposals[0]?.replay.spent?.amount).toBe(0);
  });

  it('stops the replays an ended search left running', async () => {
    await seeded();
    const proposed = await propose(heldRun(), 'firmer');

    if (proposed.outcome !== 'proposed') {
      throw new Error('the proposal was refused');
    }

    await new StopSearchHandler(
      accessFor(memory, work),
      memory.searchRepository,
      CLOCK,
      TRANSACTION,
    ).execute(new StopSearchCommand('team_1', theSearch().id.value, ACTOR));
    memory.events.splice(0);

    expect(memory.replays.get(proposed.replayId)?.current).toBe('queued');

    await advancing().workDue();

    expect(memory.replays.get(proposed.replayId)?.current).toBe('stopped');
  });
});
