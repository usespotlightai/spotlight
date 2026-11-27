import { IncomingMessage } from 'node:http';

import {
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
} from '@opentelemetry/semantic-conventions';
import { fieldOf } from '@platform/json/field-of';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

const attributesOf = (span: unknown): object | undefined => {
  const attributes = fieldOf(span, 'attributes');

  return typeof attributes === 'object' && attributes !== null
    ? attributes
    : undefined;
};

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

  Reflect.deleteProperty(attributes, ATTR_URL_PATH);
  Reflect.deleteProperty(attributes, ATTR_URL_QUERY);

  const full = fieldOf(attributes, ATTR_URL_FULL);
  const origin = typeof full === 'string' ? originOf(full) : undefined;

  if (nonEmpty(origin)) {
    Reflect.set(attributes, ATTR_URL_FULL, origin);
  } else {
    Reflect.deleteProperty(attributes, ATTR_URL_FULL);
  }
}

function withoutQuery(span: unknown): void {
  const attributes = attributesOf(span);

  if (attributes) {
    Reflect.deleteProperty(attributes, ATTR_URL_QUERY);
  }
}

export function withRoutePath(span: unknown, route: string | undefined): void {
  const attributes = attributesOf(span);

  if (!attributes) {
    return;
  }

  if (nonEmpty(route)) {
    Reflect.set(attributes, ATTR_URL_PATH, route);
  } else {
    Reflect.deleteProperty(attributes, ATTR_URL_PATH);
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
