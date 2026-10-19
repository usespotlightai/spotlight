import type { IncomingMessage, ServerResponse } from 'node:http';
import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import { withRoutePath } from '@platform/telemetry/span-urls';

type Routed = IncomingMessage & { route?: { path?: unknown } };

export function routeOfRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const metadata = getRPCMetadata(context.active());

  if (metadata?.type === RPCType.HTTP) {
    res.once('finish', () => {
      const path = (req as Routed).route?.path;
      const route = typeof path === 'string' ? path : undefined;

      if (route) {
        metadata.route = route;
      }

      withRoutePath(metadata.span, route);
    });
  }

  next();
}
