import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { observeGauges } from '@platform/telemetry/gauges';

@Injectable()
export class ReadinessGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(private readonly checks: ReadinessChecks) {}

  onModuleInit(): void {
    this.#stop = observeGauges(
      {
        'spotlight.readiness': {
          description:
            'One when the readiness check passes, zero when it fails',
        },
      },
      async () => ({
        'spotlight.readiness': (await this.checks.run()).map((outcome) => ({
          value: outcome.ok ? 1 : 0,
          attributes: { 'spotlight.check': outcome.name },
        })),
      }),
    );
  }

  onModuleDestroy(): void {
    this.#stop?.();
  }
}
