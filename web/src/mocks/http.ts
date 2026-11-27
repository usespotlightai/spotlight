import {
  type DefaultBodyType,
  delay,
  type HttpHandler,
  HttpResponse,
  type HttpResponseResolver,
  http,
  type JsonBodyType,
  type PathParams,
} from 'msw';

import { openPage, scenario } from '@/mocks/scenario';
import { readByShellOnly } from '@/mocks/shell';

type Resolver<Body extends DefaultBodyType = DefaultBodyType> =
  HttpResponseResolver<PathParams, Body>;

export const problem = (
  status: number,
  detail: string,
): HttpResponse<JsonBodyType> =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Request failed', status, detail },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

const gated =
  (path: string, resolver: Resolver): Resolver =>
  async (info) => {
    const { state, scope } = scenario();

    if (scope === 'page' && readByShellOnly(path, openPage())) {
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
  <Body extends DefaultBodyType>(resolver: Resolver<Body>): Resolver<Body> =>
  (info) =>
    scenario().actions === 'fail'
      ? problem(500, 'Sorry, that could not be saved. Please try again.')
      : resolver(info);

export const api = {
  get: (path: string, resolver: Resolver): HttpHandler =>
    http.get(`/api${path}`, gated(path, resolver)),
  post: <Body extends DefaultBodyType = DefaultBodyType>(
    path: string,
    resolver: Resolver<Body>,
  ): HttpHandler => http.post(`/api${path}`, saved(resolver)),
  put: <Body extends DefaultBodyType = DefaultBodyType>(
    path: string,
    resolver: Resolver<Body>,
  ): HttpHandler => http.put(`/api${path}`, saved(resolver)),
  patch: <Body extends DefaultBodyType = DefaultBodyType>(
    path: string,
    resolver: Resolver<Body>,
  ): HttpHandler => http.patch(`/api${path}`, saved(resolver)),
  delete: (path: string, resolver: Resolver): HttpHandler =>
    http.delete(`/api${path}`, saved(resolver)),
};

export const json = <T extends JsonBodyType>(
  body: T,
  status = 200,
): HttpResponse<T> => HttpResponse.json(body, { status });

export const noContent = (): HttpResponse<null> =>
  new HttpResponse(null, { status: 204 });

export const notFound = (): HttpResponse<JsonBodyType> =>
  problem(404, 'Sorry, that is not here.');
