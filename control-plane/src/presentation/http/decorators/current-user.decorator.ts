import type { AuthenticatedUser } from '@application/ports/session.port';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const REQUEST_USER = Symbol('REQUEST_USER');

export type RequestWithUser = { [REQUEST_USER]?: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request[REQUEST_USER];

    if (!user) {
      throw new Error(
        'No authenticated user on the request. Is the route @AllowAnonymous()?',
      );
    }

    return user;
  },
);
