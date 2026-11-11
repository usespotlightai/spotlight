import type { INestApplication } from '@nestjs/common';
import {
  type ControllerRoute,
  controllerRoutesOf,
} from '@platform/http/controller-routes';
import { ACCEPTS_LARGE_BODY } from '@platform/http/decorators/accepts-large-body.decorator';
import { API_PREFIX } from '@platform/http/routes';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';

const LARGE_BODY_LIMIT = '64mb';

export type LargeBodyRoute = Pick<ControllerRoute, 'method' | 'segments'>;

const patternOf = (route: LargeBodyRoute): RegExp =>
  new RegExp(
    `^/${[API_PREFIX, ...route.segments]
      .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment))
      .join('/')}$`,
  );

const largeBodyRoutesOf = (app: INestApplication): readonly LargeBodyRoute[] =>
  controllerRoutesOf(app).filter(
    (route) => route.method === 'post' && route.marked(ACCEPTS_LARGE_BODY),
  );

export const takingLargeBodies = (
  routes: readonly LargeBodyRoute[],
): ((method: string, path: string) => boolean) => {
  const patterns = routes.map(patternOf);

  return (method, path) =>
    method === 'POST' && patterns.some((route) => route.test(path));
};

const parseLarge = json({
  limit: LARGE_BODY_LIMIT,
  verify: (request: Request & { rawBody?: Buffer }, _response, buffer) => {
    request.rawBody = buffer;
  },
});

export const largeBodiesOf = (app: INestApplication) => {
  let takesLargeBody: ((method: string, path: string) => boolean) | null = null;

  return (request: Request, response: Response, next: NextFunction) => {
    takesLargeBody ??= takingLargeBodies(largeBodyRoutesOf(app));

    return takesLargeBody(request.method, request.path)
      ? parseLarge(request, response, next)
      : next();
  };
};
