import {
  API_PREFIX,
  INTEGRATION_DELIVERIES,
  RUN_CHANGE_STACK_CHECK,
  RUN_CHANGE_STACKS,
  RUN_COMPLETION,
  RUN_EVENTS,
  RUN_TOOL_CALL,
  TEAM_DELIVERIES,
  TERRAFORM_STATE_ROUTE,
  WEBHOOKS,
} from '@platform/http/routes';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';

const LARGE_BODY_LIMIT = '64mb';

export const LARGE_BODY_ROUTES = [
  RUN_EVENTS,
  RUN_COMPLETION,
  RUN_TOOL_CALL,
  RUN_CHANGE_STACKS,
  RUN_CHANGE_STACK_CHECK,
  `${WEBHOOKS}/${TEAM_DELIVERIES}`,
  `${WEBHOOKS}/${INTEGRATION_DELIVERIES}`,
  TERRAFORM_STATE_ROUTE,
];

const patternOf = (route: string): RegExp =>
  new RegExp(
    `^/${API_PREFIX}/${route
      .split('/')
      .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment))
      .join('/')}$`,
  );

const LARGE_BODY_PATTERNS = LARGE_BODY_ROUTES.map(patternOf);

export const takesLargeBody = (method: string, path: string): boolean =>
  method === 'POST' && LARGE_BODY_PATTERNS.some((route) => route.test(path));

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
  takesLargeBody(request.method, request.path)
    ? parseLarge(request, response, next)
    : next();
