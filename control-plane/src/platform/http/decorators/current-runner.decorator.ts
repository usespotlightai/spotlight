import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const REQUEST_RUNNER = Symbol('REQUEST_RUNNER');

export type RequestWithRunner = { [REQUEST_RUNNER]?: string };

export const CurrentRunner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const runnerId = context.switchToHttp().getRequest<RequestWithRunner>()[
      REQUEST_RUNNER
    ];

    if (!runnerId) {
      throw new Error('No runner on the request. Is the route @RunnerOnly()?');
    }

    return runnerId;
  },
);
