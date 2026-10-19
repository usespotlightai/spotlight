import { metrics, type ProxyTracerProvider, trace } from '@opentelemetry/api';
import { startOpenTelemetry } from '@platform/telemetry/open-telemetry';
import { describe, expect, it } from 'vitest';

describe('startOpenTelemetry', () => {
  it('starts nothing and opens no connection when no exporter is set', () => {
    const env = { OTEL_SERVICE_NAME: 'spotlight' };

    expect(startOpenTelemetry(env)).toBe(false);
    expect(env).toEqual({ OTEL_SERVICE_NAME: 'spotlight' });
    expect(
      (trace.getTracerProvider() as ProxyTracerProvider).getDelegate()
        .constructor.name,
    ).toBe('NoopTracerProvider');
    expect(metrics.getMeterProvider().constructor.name).toBe(
      'NoopMeterProvider',
    );
  });
});
