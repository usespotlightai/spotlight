import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import {
  activeTraceparent,
  linkActiveSpanTo,
} from '@platform/telemetry/trace-context';
import { afterAll, describe, expect, it } from 'vitest';

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({
  spanProcessors: [new SimpleSpanProcessor({ exporter })],
});
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
trace.setGlobalTracerProvider(provider);
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

afterAll(() => provider.shutdown());

describe('linkActiveSpanTo', () => {
  it('links the active span to the trace that queued the work', () => {
    const tracer = trace.getTracer('test');
    const queued = tracer.startActiveSpan('queue the run', (span) => {
      const traceparent = activeTraceparent();
      span.end();
      return { traceparent, traceId: span.spanContext().traceId };
    });

    tracer.startActiveSpan('claim the run', (span) => {
      linkActiveSpanTo(queued.traceparent);
      span.end();
    });

    const claimed = exporter
      .getFinishedSpans()
      .find((span) => span.name === 'claim the run');
    expect(claimed?.links.map((link) => link.context.traceId)).toEqual([
      queued.traceId,
    ]);
  });

  it('adds nothing when no trace was stored', () => {
    trace.getTracer('test').startActiveSpan('claim without trace', (span) => {
      linkActiveSpanTo(null);
      span.end();
    });

    expect(
      exporter
        .getFinishedSpans()
        .find((span) => span.name === 'claim without trace')?.links,
    ).toEqual([]);
  });
});
