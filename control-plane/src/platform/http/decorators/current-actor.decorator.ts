import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import {
  principalOf,
  type RequestWithPrincipal,
} from '@platform/http/decorators/current-principal.decorator';
import {
  CLIENT_HEADER,
  headerIn,
  type RequestHeaders,
} from '@platform/http/resources/resource-headers';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders } & RequestWithPrincipal>();

    return Actor.of(
      principalOf(request),
      Client.named(headerIn(request.headers, CLIENT_HEADER)),
    );
  },
);
