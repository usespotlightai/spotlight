import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';

const LARGE_BODY_LIMIT = '64mb';

const LARGE_BODY_ROUTES = [
  /^\/api\/runs\/[^/]+\/events$/,
  /^\/api\/runs\/[^/]+\/completion$/,
  /^\/api\/runs\/[^/]+\/change-stacks$/,
  /^\/api\/runs\/[^/]+\/change-stack-checks\/[^/]+$/,
  /^\/api\/runs\/[^/]+\/tools\/[^/]+$/,
  /^\/api\/webhooks\//,
  /^\/api\/terraform\/workspaces\/[^/]+\/states\/[^/]+$/,
];

const parseLarge = json({
  limit: LARGE_BODY_LIMIT,
  verify: (request: Request & { rawBody?: Buffer }, _response, buffer) => {
    request.rawBody = buffer;
  },
});

export const largeBodies = (
  request: Request,
  response: Response,
  next: NextFunction,
) =>
  request.method === 'POST' &&
  LARGE_BODY_ROUTES.some((route) => route.test(request.path))
    ? parseLarge(request, response, next)
    : next();
