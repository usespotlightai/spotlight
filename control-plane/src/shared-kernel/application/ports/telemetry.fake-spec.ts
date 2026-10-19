import type {
  MetricAttributes,
  TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';

export const telemetryInMemory = (): TelemetryPort & {
  readonly started: { name: string; ids: Record<string, unknown> }[];
  readonly counted: { metric: string; attributes?: MetricAttributes }[];
} => {
  const started: { name: string; ids: Record<string, unknown> }[] = [];
  const counted: { metric: string; attributes?: MetricAttributes }[] = [];

  return {
    started,
    counted,
    inSpan: (name, ids, work) => {
      started.push({ name, ids });
      return work();
    },
    count: (metric, attributes) => {
      counted.push({ metric, attributes });
    },
  };
};
