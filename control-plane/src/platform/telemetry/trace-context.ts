import {
  context,
  isSpanContextValid,
  type Link,
  propagation,
  ROOT_CONTEXT,
  trace,
} from '@opentelemetry/api';

const TRACEPARENT = 'traceparent';

export function activeTraceparent(): string | null {
  const carrier: Record<string, string> = {};

  propagation.inject(context.active(), carrier);

  return carrier[TRACEPARENT] ?? null;
}

export function linksTo(traceparent: string | null): Link[] {
  if (!traceparent) {
    return [];
  }

  const linked = trace
    .getSpan(propagation.extract(ROOT_CONTEXT, { [TRACEPARENT]: traceparent }))
    ?.spanContext();

  return linked && isSpanContextValid(linked) ? [{ context: linked }] : [];
}

export function linkActiveSpanTo(traceparent: string | null): void {
  const span = trace.getActiveSpan();

  for (const link of linksTo(traceparent)) {
    span?.addLink(link);
  }
}

export function traceIdOfTraceparent(
  traceparent: string | null,
): string | undefined {
  return linksTo(traceparent)[0]?.context.traceId;
}
