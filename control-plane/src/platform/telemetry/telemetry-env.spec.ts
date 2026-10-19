import { exportersOf } from '@platform/telemetry/telemetry-env';
import { describe, expect, it } from 'vitest';

describe('exportersOf', () => {
  it('exports nothing when no exporter or endpoint is set', () => {
    expect(exportersOf({})).toBeUndefined();
    expect(exportersOf({ OTEL_SERVICE_NAME: 'spotlight' })).toBeUndefined();
    expect(exportersOf({ OTEL_EXPORTER_OTLP_ENDPOINT: ' ' })).toBeUndefined();
  });

  it('exports traces and metrics over OTLP when an endpoint is set', () => {
    expect(
      exportersOf({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' }),
    ).toEqual({
      OTEL_TRACES_EXPORTER: 'otlp',
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_LOGS_EXPORTER: 'none',
    });
  });

  it('exports only the signal whose endpoint is set', () => {
    expect(
      exportersOf({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://collector:4318/v1/traces',
      }),
    ).toEqual({
      OTEL_TRACES_EXPORTER: 'otlp',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
    });
  });

  it('serves Prometheus metrics without sending traces anywhere', () => {
    expect(exportersOf({ OTEL_METRICS_EXPORTER: 'prometheus' })).toEqual({
      OTEL_TRACES_EXPORTER: 'none',
      OTEL_METRICS_EXPORTER: 'prometheus',
      OTEL_LOGS_EXPORTER: 'none',
    });
  });

  it('never sends logs, whatever the operator sets', () => {
    expect(
      exportersOf({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_LOGS_EXPORTER: 'otlp',
      })?.OTEL_LOGS_EXPORTER,
    ).toBe('none');
  });

  it('exports nothing when the SDK is disabled', () => {
    expect(
      exportersOf({
        OTEL_SDK_DISABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
      }),
    ).toBeUndefined();
  });
});
