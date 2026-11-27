import { metrics, trace } from '@opentelemetry/api';
import { startOpenTelemetry } from '@platform/telemetry/open-telemetry';
import { describe, expect, it } from 'vitest';

describe('startOpenTelemetry', () => {
  it('starts nothing and opens no connection when no exporter is set', () => {
    const env = { OTEL_SERVICE_NAME: 'spotlight' };

    expect(startOpenTelemetry(env)).toBe(false);
    expect(env).toEqual({ OTEL_SERVICE_NAME: 'spotlight' });
    const provider = trace.getTracerProvider();
    const getDelegate: unknown = Reflect.get(provider, 'getDelegate');
    if (typeof getDelegate !== 'function') {
      throw new Error('expected a proxy tracer provider');
    }
    const delegate: unknown = Reflect.apply(getDelegate, provider, []);
    if (typeof delegate !== 'object' || delegate === null) {
      throw new Error('expected a delegate');
    }

    expect(delegate.constructor.name).toBe('NoopTracerProvider');
    expect(metrics.getMeterProvider().constructor.name).toBe(
      'NoopMeterProvider',
    );
  });
});
