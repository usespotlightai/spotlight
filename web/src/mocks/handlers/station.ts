import type { RequestHandler } from 'msw';
import type {
  CandidateResponseDto,
  ConfigPullRequestResponseDto,
  EstimateSearchRequestDto,
  OpenReplaySetRequestDto,
  ProbeReplaySetRequestDto,
  RenameReplaySetRequestDto,
  ReplayStartedResponseDto,
  SanityReplayStartedResponseDto,
  SearchEstimateResponseDto,
  SearchStartedResponseDto,
  StartReplayRequestDto,
  StartSanityReplayRequestDto,
  StartSearchRequestDto,
} from '@/lib/api';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { PLATFORM_ID } from '@/mocks/world';
import { replayedCandidates } from '@/mocks/world/station-candidates';
import {
  CONFIG_REPOSITORY,
  STATION_ADDRESS,
} from '@/mocks/world/station-history';
import { stationJudge } from '@/mocks/world/station-judge';
import { rounded } from '@/mocks/world/station-measures';
import { stationOf, stationOutcomes } from '@/mocks/world/station-outcomes';
import { replayOfRun, replayRun } from '@/mocks/world/station-replay-runs';
import {
  baselineOfSet,
  CANDIDATES,
  listedReplays,
  type Mark,
  makeReplay,
  type ReplaySpec,
  replayDetailOf,
  replaySpec,
  replayStore,
} from '@/mocks/world/station-replays';
import { searchRun } from '@/mocks/world/station-search-runs';
import {
  type SearchSpec,
  searchDetailOf,
  searchSpec,
  searchStore,
  searchSummaryOf,
} from '@/mocks/world/station-searches';
import {
  checksFor,
  NO_HEALTH,
  replayableRuns,
  replaySetOf,
  resourceCandidates,
  runOfStation,
  setSpec,
  setStore,
  suggestionsFor,
} from '@/mocks/world/station-sets';

const STATION = '/teams/:teamId/lines/:lineId/stations/:stationId';
const SET = '/teams/:teamId/replay-sets/:setId';

type Params = Record<string, string | readonly string[] | undefined>;

const param = (params: Params, name: string): string =>
  String(params[name] ?? '');

const placeOf = (params: Params) => ({
  teamId: param(params, 'teamId'),
  lineId: param(params, 'lineId'),
  stationId: param(params, 'stationId'),
});

const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const uniqueId = (prefix: string, taken: (id: string) => boolean): string => {
  let id = prefix;
  let count = 2;

  while (taken(id)) {
    id = `${prefix}_${count}`;
    count += 1;
  }

  return id;
};

const startingMarks = (count: number): Mark[] =>
  Array.from({ length: count }, (_, place) =>
    place < 4 ? 'running' : 'waiting',
  );

const candidateFor = (asked: string): CandidateResponseDto | undefined => {
  if (asked === 'live') {
    return CANDIDATES.live4;
  }

  const found = resourceCandidates().find((each) => each.id === asked);

  return found
    ? {
        id: found.id,
        name: found.name,
        kind: found.kind,
        fingerprint: found.fingerprint,
        station: found.station,
        createdAt: found.createdAt,
      }
    : undefined;
};

const startOn = (
  setId: string,
  candidate: CandidateResponseDto,
  over: Partial<ReplaySpec>,
): ReplaySpec => {
  const set = setSpec(setId);
  const runs = over.runs ?? set?.entries.map((each) => each.runId) ?? [];
  const live = candidate.kind === 'live';
  const replay = makeReplay({
    id: uniqueId(`replay_${slugOf(candidate.name)}`, (id) =>
      Boolean(replaySpec(id)),
    ),
    setId,
    candidate,
    startedAsBaseline: live,
    state: 'running',
    startedHoursAgo: 0,
    endedHoursAgo: null,
    runs,
    marks: startingMarks(runs.length),
    comparedWith: live ? null : (baselineOfSet(setId)?.id ?? null),
    paired: !live,
    listed: true,
    ...over,
  });

  replayStore().push(replay);
  return replay;
};

const started = (replay: ReplaySpec): ReplayStartedResponseDto => ({
  id: replay.id,
  ceiling: replay.ceiling,
  baseline: null,
});

export const stationHandlers: RequestHandler[] = [
  api.get(`${STATION}/outcomes`, ({ params, request }) => {
    const { teamId, lineId, stationId } = placeOf(params);
    const last = new URL(request.url).searchParams.get('last');

    return stationOf(teamId, lineId, stationId)
      ? json(
          stationOutcomes(
            teamId,
            lineId,
            stationId,
            last === null ? null : Number(last),
          ),
        )
      : notFound();
  }),

  api.get(`${STATION}/judge`, ({ params }) => {
    const { teamId, lineId, stationId } = placeOf(params);
    const judge = stationJudge(teamId, lineId, stationId);

    return judge ? json(judge) : notFound();
  }),

  api.get(`${STATION}/replay-sets`, ({ params }) => {
    const { teamId, lineId, stationId } = placeOf(params);

    return json(
      teamId === PLATFORM_ID
        ? setStore()
            .filter(
              (set) => set.lineId === lineId && set.stationId === stationId,
            )
            .map(replaySetOf)
        : [],
    );
  }),

  api.post(`${STATION}/replay-sets`, async ({ params, request }) => {
    const { lineId, stationId } = placeOf(params);
    const { name } = (await request.json()) as OpenReplaySetRequestDto;
    const id = uniqueId(`set_${slugOf(name)}`, (taken) =>
      Boolean(setSpec(taken)),
    );

    setStore().push({
      id,
      name,
      lineId,
      stationId,
      createdHoursAgo: 0,
      guardsChanges: false,
      entries: [],
      health: NO_HEALTH,
    });

    return json({ id }, 201);
  }),

  api.get(`${STATION}/replayable-runs`, ({ params }) => {
    const { teamId, stationId } = placeOf(params);

    return json(teamId === PLATFORM_ID ? replayableRuns(stationId) : []);
  }),

  api.get(`${STATION}/searches`, ({ params }) => {
    const { teamId, stationId } = placeOf(params);

    return json(
      teamId === PLATFORM_ID
        ? searchStore()
            .filter((search) => searchSummaryOf(search).stationId === stationId)
            .sort((one, other) => one.startedHoursAgo - other.startedHoursAgo)
            .map(searchSummaryOf)
        : [],
    );
  }),

  api.post(`${STATION}/searches/estimate`, async ({ request }) => {
    const { setId, budget, objective } =
      (await request.json()) as EstimateSearchRequestDto;
    const set = setSpec(setId);

    if (!set) {
      return notFound();
    }

    const entries = set.entries.length;
    const searchedTasks = Math.ceil(entries * 0.7);
    const heldOutTasks = entries - searchedTasks;
    const repeats = budget.repeats ?? 1;
    const proposals = budget.iterations * budget.perIteration;
    const runs = {
      seed: searchedTasks * repeats,
      searchReplays: proposals * searchedTasks * repeats,
      heldOutReplays: heldOutTasks * (1 + Math.min(2, proposals)) * repeats,
      agent: budget.iterations,
      total: 0,
    };
    runs.total =
      runs.seed + runs.searchReplays + runs.heldOutReplays + runs.agent;
    const share = (part: number) => ({
      amount: rounded(budget.ceiling.amount * part),
      currency: budget.ceiling.currency,
    });

    return json<SearchEstimateResponseDto>({
      searchedTasks,
      heldOutTasks,
      runs,
      ceiling: budget.ceiling,
      perReplayAllotments: {
        seed: share(0.1),
        searchReplay: share(0.6 / Math.max(1, proposals)),
        heldOutReplay: share(0.05),
        agentRun: share(0.15 / Math.max(1, budget.iterations)),
      },
      estimatedDuration:
        entries === 0 ? null : (budget.iterations + 1) * 1_500_000,
      minGain: 0.05,
      objective: objective ?? 'success',
      warnings: set.health.noise ? [] : [{ kind: 'noise-unmeasured' }],
    });
  }),

  api.post(`${STATION}/searches`, async ({ params, request }) => {
    const { stationId } = placeOf(params);
    const { setId, budget, agent, objective } =
      (await request.json()) as StartSearchRequestDto;
    const set = setSpec(setId);

    if (!set || set.stationId !== stationId) {
      return notFound();
    }

    const runs = set.entries.map((each) => each.runId);
    const cut = Math.ceil(runs.length * 0.7);
    const searched = runs.slice(0, cut);
    const id = uniqueId('search_started', (taken) =>
      Boolean(searchSpec(taken)),
    );
    const seedReplay = startOn(setId, CANDIDATES.live4, {
      id: `replay_${id}_seed`,
      runs: searched,
      marks: startingMarks(searched.length),
      comparedWith: null,
      paired: false,
      listed: false,
      search: { searchId: id, candidateName: 'seed' },
    });
    const search: SearchSpec = {
      id,
      setId,
      state: 'seeding',
      ending: null,
      agent: {
        harness: agent.harness,
        model: agent.model ?? null,
        effort: agent.effort ?? null,
      },
      budget: {
        iterations: budget.iterations,
        perIteration: budget.perIteration,
        ceiling: budget.ceiling,
        concurrency: budget.concurrency ?? 4,
        repeats: budget.repeats ?? 1,
      },
      objective: objective ?? 'success',
      startedHoursAgo: 0,
      endedHoursAgo: null,
      iterations: [],
      seed: {
        candidate: CANDIDATES.live4,
        seed: true,
        iteration: null,
        hypothesis: null,
        changes: [],
        replayId: seedReplay.id,
        heldOutReplayId: null,
        onFrontier: true,
        onlyOnSeenTasks: null,
        pullRequest: null,
      },
      candidates: [],
      bestId: null,
      frontier: [CANDIDATES.live4.id],
      searched,
      heldOut: runs.slice(cut),
    };

    searchStore().push(search);

    return json<SearchStartedResponseDto>(
      {
        id,
        seedReplayId: seedReplay.id,
        objective: search.objective,
        warnings: set.health.noise ? [] : [{ kind: 'noise-unmeasured' }],
      },
      201,
    );
  }),

  api.get(
    '/resources/workspaces/:workspaceId/replay-candidates',
    ({ request }) => {
      const station = new URL(request.url).searchParams.get('station');

      return json({
        items: resourceCandidates().filter(
          (each) => !station || each.stationAddress === station,
        ),
      });
    },
  ),

  api.get('/teams/:teamId/replay-sets', ({ params }) =>
    json(
      param(params, 'teamId') === PLATFORM_ID
        ? setStore().map(replaySetOf)
        : [],
    ),
  ),

  api.patch(SET, async ({ params, request }) => {
    const set = setSpec(param(params, 'setId'));
    const { name } = (await request.json()) as RenameReplaySetRequestDto;

    if (!set) {
      return notFound();
    }

    set.name = name;
    return noContent();
  }),

  api.delete(SET, ({ params }) => {
    const setId = param(params, 'setId');
    const sets = setStore();
    const at = sets.findIndex((each) => each.id === setId);

    if (at < 0) {
      return notFound();
    }

    sets.splice(at, 1);
    const replays = replayStore();
    for (let place = replays.length - 1; place >= 0; place -= 1) {
      if (replays[place]?.setId === setId) {
        replays.splice(place, 1);
      }
    }
    return noContent();
  }),

  api.post(`${SET}/entries`, async ({ params, request }) => {
    const set = setSpec(param(params, 'setId'));
    const { runId } = (await request.json()) as { runId: string };

    if (!set) {
      return notFound();
    }
    if (!runOfStation(runId)) {
      return problem(422, 'Sorry, that run did not end at this station.');
    }
    if (!set.entries.some((each) => each.runId === runId)) {
      set.entries.push({ runId, addedHoursAgo: 0, origin: 'person' });
    }
    return noContent();
  }),

  api.delete(`${SET}/entries/:runId`, ({ params }) => {
    const set = setSpec(param(params, 'setId'));
    const runId = param(params, 'runId');

    if (!set) {
      return notFound();
    }

    set.entries = set.entries.filter((each) => each.runId !== runId);
    return noContent();
  }),

  api.post(`${SET}/guards-changes`, ({ params }) => {
    const set = setSpec(param(params, 'setId'));

    if (!set) {
      return notFound();
    }

    set.guardsChanges = true;
    return noContent();
  }),

  api.delete(`${SET}/guards-changes`, ({ params }) => {
    const set = setSpec(param(params, 'setId'));

    if (!set) {
      return notFound();
    }

    set.guardsChanges = false;
    return noContent();
  }),

  api.post(`${SET}/probes`, async ({ params, request }) => {
    const setId = param(params, 'setId');
    const { ceiling } = (await request.json()) as ProbeReplaySetRequestDto;
    const set = setSpec(setId);

    if (!set) {
      return notFound();
    }

    const runs = set.entries.slice(0, 2).map((each) => each.runId);
    const replay = startOn(setId, CANDIDATES.live4, {
      id: uniqueId('replay_probe', (id) => Boolean(replaySpec(id))),
      runs,
      marks: startingMarks(runs.length),
      probe: true,
      startedAsBaseline: false,
      ceiling,
    });

    return json<ReplayStartedResponseDto>(started(replay), 201);
  }),

  api.get(`${SET}/replay-checks`, ({ params, request }) => {
    const query = new URL(request.url).searchParams;

    return json(
      checksFor(
        param(params, 'setId'),
        Number(query.get('limit') ?? 20),
        query.get('before') ?? undefined,
      ),
    );
  }),

  api.get(`${SET}/replays`, ({ params }) =>
    json(listedReplays(param(params, 'setId'))),
  ),

  api.post(`${SET}/replays`, async ({ params, request }) => {
    const setId = param(params, 'setId');
    const body = (await request.json()) as StartReplayRequestDto;
    const candidate = candidateFor(body.candidate);

    if (!setSpec(setId) || !candidate) {
      return notFound();
    }

    const replay = startOn(setId, candidate, { ceiling: body.ceiling });

    return json<ReplayStartedResponseDto>(started(replay), 201);
  }),

  api.post(`${SET}/sanity-replays`, async ({ params, request }) => {
    const setId = param(params, 'setId');
    const body = (await request.json()) as StartSanityReplayRequestDto;

    if (!setSpec(setId)) {
      return notFound();
    }

    const model = body.model ?? 'opus';
    const effort = body.effort ?? 'max';
    const candidate: CandidateResponseDto = {
      id: uniqueId(`candidate_sanity_${slugOf(model)}`, (id) =>
        replayStore().some((each) => each.candidate.id === id),
      ),
      name: `${model}, ${effort} effort`,
      kind: 'sanity',
      fingerprint: CANDIDATES.opus.fingerprint,
      station: { key: 'implementation' },
      createdAt: new Date().toISOString(),
    };
    const replay = startOn(setId, candidate, {
      agent: { model, effort },
      ceiling: body.ceiling,
    });

    return json<SanityReplayStartedResponseDto>(
      {
        id: replay.id,
        candidateId: candidate.id,
        ceiling: replay.ceiling,
        comparison: null,
      },
      201,
    );
  }),

  api.get(`${SET}/suggestions`, ({ params }) => {
    const set = setSpec(param(params, 'setId'));

    return set ? json(suggestionsFor(set)) : notFound();
  }),

  api.get('/teams/:teamId/replayed-candidates', ({ params, request }) => {
    const period = new URL(request.url).searchParams.get('period') ?? '30d';

    return json(
      replayedCandidates(
        param(params, 'teamId'),
        period === '7d' || period === '90d' ? period : '30d',
      ),
    );
  }),

  api.get('/teams/:teamId/replays/:replayId', ({ params }) => {
    const replay = replaySpec(param(params, 'replayId'));

    return replay ? json(replayDetailOf(replay)) : notFound();
  }),

  api.post('/teams/:teamId/replays/:replayId/stop', ({ params }) => {
    const replay = replaySpec(param(params, 'replayId'));

    if (!replay) {
      return notFound();
    }

    replay.state = 'stopped';
    replay.endedHoursAgo = 0;
    replay.marks = replay.marks.map((mark) =>
      mark === 'running' || mark === 'waiting' ? 'not-run' : mark,
    );
    return noContent();
  }),

  api.get('/teams/:teamId/replay-runs/:runId', ({ params }) => {
    const run = replayRun(param(params, 'runId'));

    return run ? json(run) : notFound();
  }),

  api.get('/teams/:teamId/replay-runs/:runId/replay', ({ params }) => {
    const replay = replayOfRun(param(params, 'runId'));

    return replay ? json(replay) : notFound();
  }),

  api.get('/teams/:teamId/search-runs/:runId', ({ params }) => {
    const run = searchRun(param(params, 'runId'));

    return run ? json(run) : notFound();
  }),

  api.get('/teams/:teamId/searches/:searchId', ({ params }) => {
    const search = searchSpec(param(params, 'searchId'));

    return search ? json(searchDetailOf(search)) : notFound();
  }),

  api.post('/teams/:teamId/searches/:searchId/stop', ({ params }) => {
    const search = searchSpec(param(params, 'searchId'));

    if (!search) {
      return notFound();
    }

    search.state = 'stopped';
    search.ending = 'stopped';
    search.endedHoursAgo = 0;
    return noContent();
  }),

  api.post(
    '/teams/:teamId/searches/:searchId/candidates/:candidateId/pick',
    ({ params }) => {
      const teamId = param(params, 'teamId');
      const search = searchSpec(param(params, 'searchId'));
      const candidateId = param(params, 'candidateId');
      const picked = search?.candidates.find(
        (each) => each.candidate.id === candidateId,
      );

      if (!search || !picked) {
        return notFound();
      }

      const already =
        picked.pullRequest !== null && picked.pullRequest.state !== 'refused';
      const number =
        60 +
        searchStore().indexOf(search) * 10 +
        search.candidates.indexOf(picked);

      if (!already) {
        picked.pullRequest = {
          id: `config_pull_request_${slugOf(picked.candidate.name)}`,
          state: 'opened',
          url: `https://github.com/${CONFIG_REPOSITORY}/pull/${number}`,
          reason: null,
        };
      }

      const pullRequest = picked.pullRequest;
      const now = new Date().toISOString();

      return json<ConfigPullRequestResponseDto>(
        {
          id: pullRequest?.id ?? '',
          state: pullRequest?.state ?? 'opening',
          url: pullRequest?.url ?? null,
          reason: pullRequest?.reason ?? null,
          teamId,
          searchId: search.id,
          candidateId,
          candidateName: picked.candidate.name,
          lineId: searchSummaryOf(search).lineId,
          stationId: searchSummaryOf(search).stationId,
          stationKey: STATION_ADDRESS.split('/').at(-1) ?? 'implementation',
          repository: CONFIG_REPOSITORY,
          path: 'lines/delivery.tf',
          branch: `spotlight/${search.id.replaceAll('_', '-')}/${slugOf(picked.candidate.name).replaceAll('_', '-')}`,
          attempts: 1,
          createdAt: now,
          updatedAt: now,
        },
        already ? 200 : 201,
      );
    },
  ),
];
