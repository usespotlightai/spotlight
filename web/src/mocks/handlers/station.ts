import type { RequestHandler } from 'msw';
import type {
  CandidateResponseDto,
  ReplayStartedResponseDto,
  StartReplayRequestDto,
} from '@/lib/api';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { replayedCandidates } from '@/mocks/world/station-candidates';
import { stationOf, stationRunOutcomes } from '@/mocks/world/station-insights';
import { stationJudge } from '@/mocks/world/station-judge';
import { replayOfRun, replayRun } from '@/mocks/world/station-replay-runs';
import {
  baselineOfSet,
  listedReplays,
  liveCandidateOf,
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
  replaySetOf,
  resourceCandidates,
  runOfStation,
  type SetSpec,
  setSpec,
  setStore,
  teamOfLine,
  teamOfSet,
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

const setOn = (params: Params): SetSpec | undefined => {
  const set = setSpec(param(params, 'setId'));

  return set && teamOfLine(set.lineId) === param(params, 'teamId')
    ? set
    : undefined;
};

const replayOn = (params: Params): ReplaySpec | undefined => {
  const replay = replaySpec(param(params, 'replayId'));

  return replay && teamOfSet(replay.setId) === param(params, 'teamId')
    ? replay
    : undefined;
};

const searchOn = (params: Params): SearchSpec | undefined => {
  const search = searchSpec(param(params, 'searchId'));

  return search && teamOfSet(search.setId) === param(params, 'teamId')
    ? search
    : undefined;
};

const candidateFor = (
  set: SetSpec,
  candidateId: string,
): CandidateResponseDto | undefined => {
  if (candidateId === 'live') {
    return liveCandidateOf(set.stationId);
  }

  const found = resourceCandidates().find(
    (each) => each.id === candidateId && each.stationId === set.stationId,
  );

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
    referenceReplayId: live ? null : (baselineOfSet(setId)?.id ?? null),
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
  api.get(`${STATION}/insights`, ({ params, request }) => {
    const { teamId, lineId, stationId } = placeOf(params);
    const last = new URL(request.url).searchParams.get('last');

    return stationOf(teamId, lineId, stationId)
      ? json(
          stationRunOutcomes(
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

  api.get(`${STATION}/replay-set`, ({ params }) => {
    const { teamId, lineId, stationId } = placeOf(params);
    const set = setStore().find(
      (each) => each.lineId === lineId && each.stationId === stationId,
    );

    if (teamOfLine(lineId) !== teamId) {
      return notFound();
    }

    return set
      ? json(replaySetOf(set))
      : problem(404, `Station ${stationId} has no replay set yet.`);
  }),

  api.get(`${STATION}/searches`, ({ params }) => {
    const { teamId, lineId, stationId } = placeOf(params);

    return json(
      teamOfLine(lineId) === teamId
        ? searchStore()
            .map(searchSummaryOf)
            .filter(
              (search) =>
                search.lineId === lineId && search.stationId === stationId,
            )
            .sort((one, other) => other.startedAt.localeCompare(one.startedAt))
        : [],
    );
  }),

  api.get(
    '/resources/workspaces/:workspaceId/replay-candidates',
    ({ request }) => {
      const station = new URL(request.url).searchParams.get('station');

      return json({
        items: resourceCandidates().filter(
          (each) => !station || each.stationPath === station,
        ),
      });
    },
  ),

  api.get('/teams/:teamId/replay-sets', ({ params }) =>
    json(
      setStore()
        .filter((set) => teamOfLine(set.lineId) === param(params, 'teamId'))
        .map(replaySetOf),
    ),
  ),

  api.delete(`${SET}/entries/:runId`, ({ params }) => {
    const set = setOn(params);
    const runId = param(params, 'runId');

    if (!set) {
      return notFound();
    }

    const taskId = runOfStation(runId)?.taskId;

    set.entries = set.entries.filter((each) => each.runId !== runId);
    set.removedTasks = taskId
      ? [...set.removedTasks, taskId]
      : set.removedTasks;
    return noContent();
  }),

  api.get(`${SET}/replay-checks`, ({ params, request }) => {
    const query = new URL(request.url).searchParams;
    const set = setOn(params);

    return json(
      set
        ? checksFor(
            set.id,
            Number(query.get('limit') ?? 20),
            query.get('before') ?? undefined,
          )
        : [],
    );
  }),

  api.get(`${SET}/replays`, ({ params }) => {
    const set = setOn(params);

    return json(set ? listedReplays(set.id) : []);
  }),

  api.post(`${SET}/replays`, async ({ params, request }) => {
    const setId = param(params, 'setId');
    const body = (await request.json()) as StartReplayRequestDto;
    const set = setOn(params);
    const candidate = set ? candidateFor(set, body.candidate) : undefined;

    if (!candidate) {
      return notFound();
    }

    const replay = startOn(setId, candidate, { ceiling: body.ceiling });

    return json<ReplayStartedResponseDto>(started(replay), 201);
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
    const replay = replayOn(params);

    return replay ? json(replayDetailOf(replay)) : notFound();
  }),

  api.post('/teams/:teamId/replays/:replayId/stop', ({ params }) => {
    const replay = replayOn(params);

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
    const replay = replayOfRun(param(params, 'runId'));
    const run = replayRun(param(params, 'runId'));

    return run && replay && teamOfSet(replay.setId) === param(params, 'teamId')
      ? json(run)
      : notFound();
  }),

  api.get('/teams/:teamId/replay-runs/:runId/replay', ({ params }) => {
    const replay = replayOfRun(param(params, 'runId'));

    return replay && teamOfSet(replay.setId) === param(params, 'teamId')
      ? json(replay)
      : notFound();
  }),

  api.get('/teams/:teamId/search-runs/:runId', ({ params }) => {
    const run = searchRun(param(params, 'runId'));
    const search = run ? searchSpec(run.searchId) : undefined;

    return run && search && teamOfSet(search.setId) === param(params, 'teamId')
      ? json(run)
      : notFound();
  }),

  api.get('/teams/:teamId/searches/:searchId', ({ params }) => {
    const search = searchOn(params);

    return search ? json(searchDetailOf(search)) : notFound();
  }),

  api.post('/teams/:teamId/searches/:searchId/stop', ({ params }) => {
    const search = searchOn(params);

    if (!search) {
      return notFound();
    }

    search.state = 'stopped';
    search.stopReason = 'stopped';
    search.endedHoursAgo = 0;
    return noContent();
  }),
];
