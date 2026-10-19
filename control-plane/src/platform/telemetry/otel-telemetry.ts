import { Injectable } from '@nestjs/common';
import {
  type Attributes,
  type Counter,
  type Histogram,
  metrics,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { withLogContext } from '@platform/logging/log-context';
import { SCOPE } from '@platform/telemetry/scope';
import { linksTo } from '@platform/telemetry/trace-context';
import type {
  MetricAttributes,
  SpanIds,
  TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';

const snakeCase = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const attributesOf = (ids: SpanIds): Attributes =>
  Object.fromEntries(
    Object.entries(ids)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [`spotlight.${snakeCase(key)}`, value]),
  );

// The SDK's default buckets are for milliseconds.
const SECONDS_BUCKETS = [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 900, 3600];

@Injectable()
export class OtelTelemetry implements TelemetryPort {
  readonly #counters = new Map<string, Counter>();
  readonly #histograms = new Map<string, Histogram>();

  measure(
    metric: string,
    value: number,
    attributes: MetricAttributes = {},
  ): void {
    let histogram = this.#histograms.get(metric);

    if (!histogram) {
      histogram = metrics
        .getMeter(SCOPE)
        .createHistogram(
          metric,
          metric.endsWith('_seconds')
            ? { advice: { explicitBucketBoundaries: SECONDS_BUCKETS } }
            : {},
        );
      this.#histograms.set(metric, histogram);
    }

    histogram.record(value, attributes);
  }

  count(metric: string, attributes: MetricAttributes = {}): void {
    let counter = this.#counters.get(metric);

    if (!counter) {
      counter = metrics.getMeter(SCOPE).createCounter(metric);
      this.#counters.set(metric, counter);
    }

    counter.add(1, attributes);
  }

  inSpan<T>(
    name: string,
    ids: SpanIds,
    work: () => Promise<T>,
    linkedTo: string | null = null,
  ): Promise<T> {
    const options = { attributes: attributesOf(ids), links: linksTo(linkedTo) };

    return trace
      .getTracer(SCOPE)
      .startActiveSpan(name, options, async (span) => {
        try {
          return await withLogContext(ids, work);
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.setAttribute(
            'error.type',
            error instanceof Error ? error.name : typeof error,
          );
          throw error;
        } finally {
          span.end();
        }
      });
  }
}
