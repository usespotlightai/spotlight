import type {
  MetricAttributes,
  TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';

export const telemetryInMemory = (): TelemetryPort & {
  readonly started: { name: string; ids: Record<string, unknown> }[];
  readonly counted: { metric: string; attributes?: MetricAttributes }[];
  readonly measured: {
    metric: string;
    value: number;
    attributes?: MetricAttributes;
  }[];
} => {
  const measured: {
    metric: string;
    value: number;
    attributes?: MetricAttributes;
  }[] = [];
  const started: { name: string; ids: Record<string, unknown> }[] = [];
  const counted: { metric: string; attributes?: MetricAttributes }[] = [];

  return {
    started,
    counted,
    measured,
    inSpan: (name, ids, work) => {
      started.push({ name, ids });
      return work();
    },
    count: (metric, attributes) => {
      counted.push({ metric, attributes });
    },
    measure: (metric, value, attributes) => {
      measured.push({ metric, value, attributes });
    },
  };
};
