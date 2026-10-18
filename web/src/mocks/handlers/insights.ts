import type { RequestHandler } from 'msw';
import { api, json, notFound } from '@/mocks/http';
import { world } from '@/mocks/world';
import {
  costOf,
  flowOf,
  overviewOf,
  peopleOf,
  runsListOf,
  stationsOf,
} from '@/mocks/world/insights';
import { agentConfigsOf, changesOf } from '@/mocks/world/insights-changes';
import type { RunSize } from '@/mocks/world/insights-history';
import { type PeriodName, periodNameOf } from '@/mocks/world/insights-measures';
import { memoryOf } from '@/mocks/world/insights-memory';
import {
  pullRequestListOf,
  pullRequestsOf,
} from '@/mocks/world/insights-pull-requests';
import { shippingOf } from '@/mocks/world/insights-shipping';
import { toolsOf } from '@/mocks/world/insights-tools';

type ResolverInput = {
  readonly params: Record<string, unknown>;
  readonly request: Request;
};

const teamOf = (params: ResolverInput['params']): string | null => {
  const teamId = String(params.teamId);
  return world().lines[teamId] ? teamId : null;
};

const queryOf = (request: Request): URLSearchParams =>
  new URL(request.url).searchParams;

const periodOf = (request: Request): PeriodName =>
  periodNameOf(queryOf(request).get('period'));

const forPeriod =
  (read: (teamId: string, period: PeriodName) => unknown) =>
  ({ params, request }: ResolverInput) => {
    const teamId = teamOf(params);
    return teamId ? json(read(teamId, periodOf(request))) : notFound();
  };

const forQuery =
  (read: (teamId: string, query: URLSearchParams) => unknown) =>
  ({ params, request }: ResolverInput) => {
    const teamId = teamOf(params);
    return teamId ? json(read(teamId, queryOf(request))) : notFound();
  };

const SIZES: readonly RunSize[] = ['small', 'medium', 'large'];

const agentConfigsFor = (teamId: string, query: URLSearchParams) => {
  const size = query.get('size');

  return agentConfigsOf(
    teamId,
    periodNameOf(query.get('period')),
    query.get('stationId') || null,
    SIZES.find((each) => each === size) ?? null,
  );
};

export const insightsHandlers: RequestHandler[] = [
  api.get('/teams/:teamId/insights/overview', forPeriod(overviewOf)),
  api.get('/teams/:teamId/insights/cost', forPeriod(costOf)),
  api.get('/teams/:teamId/insights/people', forPeriod(peopleOf)),
  api.get('/teams/:teamId/insights/flow', forPeriod(flowOf)),
  api.get('/teams/:teamId/insights/stations', forPeriod(stationsOf)),
  api.get('/teams/:teamId/insights/runs', forQuery(runsListOf)),
  api.get('/teams/:teamId/insights/tools', forPeriod(toolsOf)),
  api.get('/teams/:teamId/insights/memory', forPeriod(memoryOf)),
  api.get('/teams/:teamId/insights/changes', forPeriod(changesOf)),
  api.get('/teams/:teamId/insights/agent-configs', forQuery(agentConfigsFor)),
  api.get(
    '/teams/:teamId/insights/pull-requests/list',
    forQuery(pullRequestListOf),
  ),
  api.get('/teams/:teamId/insights/pull-requests', forPeriod(pullRequestsOf)),
  api.get('/teams/:teamId/insights/shipping', forPeriod(shippingOf)),
];
