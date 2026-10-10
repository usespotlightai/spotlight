import { delay, HttpResponse, http } from 'msw';
import { scenario } from '@/mocks/scenario';

type Resolver = Parameters<typeof http.get>[1];

const SHELL = new Set([
  '/workspaces',
  '/workspaces/:slug',
  '/workspaces/:slug/runners',
  '/workspaces/:slug/runner-activity',
  '/teams/:teamId/lines',
]);

export const problem = (status: number, detail: string) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Request failed', status, detail },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

const gated =
  (path: string, resolver: Resolver): Resolver =>
  async (info) => {
    const { state, scope } = scenario();

    if (SHELL.has(path) && scope === 'page') {
      return resolver(info);
    }
    if (state === 'loading') {
      await delay('infinite');
    }
    if (state === 'error') {
      return problem(500, 'Sorry, something went wrong on our side.');
    }

    return resolver(info);
  };

const saved =
  (resolver: Resolver): Resolver =>
  (info) =>
    scenario().actions === 'fail'
      ? problem(500, 'Sorry, that could not be saved. Please try again.')
      : resolver(info);

export const api = {
  get: (path: string, resolver: Resolver) =>
    http.get(`/api${path}`, gated(path, resolver)),
  post: (path: string, resolver: Resolver) =>
    http.post(`/api${path}`, saved(resolver)),
  put: (path: string, resolver: Resolver) =>
    http.put(`/api${path}`, saved(resolver)),
  patch: (path: string, resolver: Resolver) =>
    http.patch(`/api${path}`, saved(resolver)),
  delete: (path: string, resolver: Resolver) =>
    http.delete(`/api${path}`, saved(resolver)),
};

export const json = <T>(body: T, status = 200) =>
  HttpResponse.json(body as never, { status });

export const noContent = () => new HttpResponse(null, { status: 204 });

export const notFound = () => problem(404, 'Sorry, that is not here.');
