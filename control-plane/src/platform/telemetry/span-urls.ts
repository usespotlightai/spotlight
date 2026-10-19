import { IncomingMessage } from 'node:http';
import {
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
} from '@opentelemetry/semantic-conventions';

type WithAttributes = { readonly attributes?: Record<string, unknown> };

const attributesOf = (span: unknown): Record<string, unknown> | undefined =>
  (span as WithAttributes).attributes;

const originOf = (url: string): string | undefined => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

export function withoutOutboundPath(span: unknown): void {
  const attributes = attributesOf(span);

  if (!attributes) {
    return;
  }

  delete attributes[ATTR_URL_PATH];
  delete attributes[ATTR_URL_QUERY];

  const full = attributes[ATTR_URL_FULL];
  const origin = typeof full === 'string' ? originOf(full) : undefined;

  if (origin) {
    attributes[ATTR_URL_FULL] = origin;
  } else {
    delete attributes[ATTR_URL_FULL];
  }
}

function withoutQuery(span: unknown): void {
  const attributes = attributesOf(span);

  if (attributes) {
    delete attributes[ATTR_URL_QUERY];
  }
}

export function withRoutePath(span: unknown, route: string | undefined): void {
  const attributes = attributesOf(span);

  if (!attributes) {
    return;
  }

  if (route) {
    attributes[ATTR_URL_PATH] = route;
  } else {
    delete attributes[ATTR_URL_PATH];
  }
}

export function scrubbedRequestSpan(span: unknown, request: unknown): void {
  if (request instanceof IncomingMessage) {
    withoutQuery(span);
    withRoutePath(span, undefined);
  } else {
    withoutOutboundPath(span);
  }
}
