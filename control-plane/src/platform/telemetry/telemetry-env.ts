type TelemetryEnv = Readonly<Record<string, string | undefined>>;

export type Exporters = {
  readonly OTEL_TRACES_EXPORTER: string;
  readonly OTEL_METRICS_EXPORTER: string;
  readonly OTEL_LOGS_EXPORTER: 'none';
};

const present = (value: string | undefined): boolean =>
  value !== undefined && value.trim() !== '';

const exporterOf = (
  chosen: string | undefined,
  endpoints: readonly (string | undefined)[],
): string => {
  if (present(chosen)) {
    return chosen as string;
  }

  return endpoints.some(present) ? 'otlp' : 'none';
};

// Without this, the SDK exports to localhost when nothing is set.
export function exportersOf(env: TelemetryEnv): Exporters | undefined {
  if (env.OTEL_SDK_DISABLED?.trim().toLowerCase() === 'true') {
    return undefined;
  }

  const exporters = {
    OTEL_TRACES_EXPORTER: exporterOf(env.OTEL_TRACES_EXPORTER, [
      env.OTEL_EXPORTER_OTLP_ENDPOINT,
      env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    ]),
    OTEL_METRICS_EXPORTER: exporterOf(env.OTEL_METRICS_EXPORTER, [
      env.OTEL_EXPORTER_OTLP_ENDPOINT,
      env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    ]),
    OTEL_LOGS_EXPORTER: 'none' as const,
  };

  return exporters.OTEL_TRACES_EXPORTER === 'none' &&
    exporters.OTEL_METRICS_EXPORTER === 'none'
    ? undefined
    : exporters;
}
