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
  reporting: () => boolean = () => true,
): () => void {
  const meter = metrics.getMeter(SCOPE);
  const gauges = new Map<string, ObservableGauge>(
    Object.entries<GaugeSpec>(specs).map(([name, spec]) => [
      name,
      meter.createObservableGauge(name, spec),
    ]),
  );
  const observables = [...gauges.values()];

  const observe = async (result: {
    observe(
      gauge: ObservableGauge,
      value: number,
      attributes?: MetricAttributes,
    ): void;
  }) => {
    if (!reporting()) {
      return;
    }

    const observed = await withinTime(read());

    if (!observed) {
      return;
    }

    for (const [name, observations] of Object.entries<readonly Observation[]>(
      observed,
    )) {
      const gauge = gauges.get(name);

      if (gauge === undefined) {
        continue;
      }

      for (const { value, attributes } of observations) {
        result.observe(gauge, value, attributes);
      }
    }
  };

  meter.addBatchObservableCallback(observe, observables);

  return () => meter.removeBatchObservableCallback(observe, observables);
}

export const ageInSeconds = (oldest: Date | null, now: Date): number =>
  oldest ? Math.max(0, (now.getTime() - oldest.getTime()) / 1000) : 0;
