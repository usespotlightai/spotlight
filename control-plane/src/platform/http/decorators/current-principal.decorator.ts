import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const REQUEST_PRINCIPAL = Symbol('REQUEST_PRINCIPAL');

export type RequestWithPrincipal = { [REQUEST_PRINCIPAL]?: Principal };

export const principalOf = (request: RequestWithPrincipal): Principal => {
  const principal = request[REQUEST_PRINCIPAL];

  if (!principal) {
    throw new Error(
      'No principal on the request. Is the route @AllowAnonymous()?',
    );
  }

  return principal;
};

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    principalOf(context.switchToHttp().getRequest<RequestWithPrincipal>()),
);
