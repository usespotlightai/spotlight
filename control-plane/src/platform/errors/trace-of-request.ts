import type { IncomingMessage, ServerResponse } from 'node:http';
import { traceIdOf } from '@platform/http/trace-id';
import { getCurrentScope, getIsolationScope } from '@sentry/nestjs';

export function traceOfRequest(
  req: IncomingMessage,
  _res: ServerResponse,
  next: () => void,
): void {
  const traceId = traceIdOf(req);

  if (traceId) {
    for (const scope of [getIsolationScope(), getCurrentScope()]) {
      scope.setPropagationContext({
        ...scope.getPropagationContext(),
        traceId,
      });
    }
  }

  next();
}
