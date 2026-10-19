export const TELEMETRY = Symbol('TELEMETRY');

export type SpanIds = Readonly<Record<string, string | undefined>>;

export type MetricAttributes = Readonly<Record<string, string>>;

export interface TelemetryPort {
  inSpan<T>(
    name: string,
    ids: SpanIds,
    work: () => Promise<T>,
    linkedTo?: string | null,
  ): Promise<T>;
  // Attributes never hold ids. Ids belong in spans and logs.
  count(metric: string, attributes?: MetricAttributes): void;
  measure(metric: string, value: number, attributes?: MetricAttributes): void;
}
