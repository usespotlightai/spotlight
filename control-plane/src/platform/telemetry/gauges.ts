import { metrics, type ObservableGauge } from '@opentelemetry/api';
import { SCOPE } from '@platform/telemetry/scope';
import type { MetricAttributes } from '@shared-kernel/application/ports/telemetry.port';

export interface Observation {
  readonly value: number;
  readonly attributes?: MetricAttributes;
}

export interface GaugeSpec {
  readonly description: string;
}

const READ_TIMEOUT_MS = 5_000;

const withinTime = <T>(read: Promise<T>): Promise<T | null> => {
  let timer: NodeJS.Timeout | undefined;

  return Promise.race([
    read.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
};

export function observeGauges<Name extends string>(
  specs: Record<Name, GaugeSpec>,
  read: () => Promise<Record<Name, readonly Observation[]>>,
): () => void {
  const meter = metrics.getMeter(SCOPE);
  const names = Object.keys(specs) as Name[];
  const gauges = new Map<Name, ObservableGauge>(
    names.map((name) => [name, meter.createObservableGauge(name, specs[name])]),
  );
  const observables = [...gauges.values()];

  const observe = async (result: {
    observe(
      gauge: ObservableGauge,
      value: number,
      attributes?: MetricAttributes,
    ): void;
  }) => {
    const observed = await withinTime(read());

    if (!observed) {
      return;
    }

    for (const name of names) {
      const gauge = gauges.get(name) as ObservableGauge;

      for (const { value, attributes } of observed[name]) {
        result.observe(gauge, value, attributes);
      }
    }
  };

  meter.addBatchObservableCallback(observe, observables);

  return () => meter.removeBatchObservableCallback(observe, observables);
}

export const ageInSeconds = (oldest: Date | null, now: Date): number =>
  oldest ? Math.max(0, (now.getTime() - oldest.getTime()) / 1000) : 0;
