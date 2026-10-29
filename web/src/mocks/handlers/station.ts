import type { RequestHandler } from 'msw';
import { api, json, notFound } from '@/mocks/http';
import { replayedCandidates } from '@/mocks/world/station-candidates';
import { stationOf, stationRunOutcomes } from '@/mocks/world/station-insights';
import { stationJudge } from '@/mocks/world/station-judge';

const STATION = '/teams/:teamId/lines/:lineId/stations/:stationId';

type Params = Record<string, string | readonly string[] | undefined>;

const param = (params: Params, name: string): string =>
  String(params[name] ?? '');

const placeOf = (params: Params) => ({
  teamId: param(params, 'teamId'),
  lineId: param(params, 'lineId'),
  stationId: param(params, 'stationId'),
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

  api.get('/teams/:teamId/replayed-candidates', ({ params, request }) => {
    const period = new URL(request.url).searchParams.get('period') ?? '30d';

    return json(
      replayedCandidates(
        param(params, 'teamId'),
        period === '7d' || period === '90d' ? period : '30d',
      ),
    );
  }),
];
