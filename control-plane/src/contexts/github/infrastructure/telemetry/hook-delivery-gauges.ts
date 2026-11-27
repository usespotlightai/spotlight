import { HookRedeliveries } from '@github/application/services/hook-redeliveries.service';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Leadership } from '@platform/redis/leadership';
import { observeGauges } from '@platform/telemetry/gauges';

@Injectable()
export class HookDeliveryGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    private readonly redeliveries: HookRedeliveries,
    private readonly leadership: Leadership,
  ) {}

  onModuleInit(): void {
    this.#stop = observeGauges(
      {
        'spotlight.github.hook_deliveries.failed_last_hour': {
          description:
            'GitHub webhook deliveries that failed in the last hour, redeliveries included',
        },
        'spotlight.github.hook_deliveries.undelivered': {
          description:
            'GitHub webhook deliveries of the last 3 days with no successful attempt',
        },
      },
      async () => {
        const health = this.redeliveries.health();

        return {
          'spotlight.github.hook_deliveries.failed_last_hour': [
            { value: health.failedLastHour },
          ],
          'spotlight.github.hook_deliveries.undelivered': [
            { value: health.undelivered },
          ],
        };
      },
      () => this.leadership.held(),
    );
  }

  onModuleDestroy(): void {
    this.#stop?.();
  }
}
