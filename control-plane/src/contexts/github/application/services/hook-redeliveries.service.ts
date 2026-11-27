import type {
  AppHookDeliveriesPort,
  HookDeliveryAttempt,
} from '@github/application/ports/app-hook-deliveries.port';
import { HookDelivery } from '@github/domain/entities/hook-delivery.entity';
import {
  HOOK_DELIVERY_LOOKBACK_MS,
  outcomeOf,
} from '@github/domain/services/hook-redelivery-policy';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

export const REDELIVER_EVERY_MS = 60_000;

const MAX_PAGES = 20;

const MAX_REQUESTS_PER_RUN = 20;

const OVERLAP_MS = 10 * 60_000;

const HOUR_MS = 60 * 60_000;

const REDELIVERIES_METRIC = 'spotlight.github.hook_redeliveries';

const OUTCOME = 'spotlight.github.redelivery.outcome';

type RequestOutcome = 'requested' | 'failed';

const oldestFirst = (
  one: HookDeliveryAttempt,
  other: HookDeliveryAttempt,
): number => {
  const apart = one.deliveredAt.getTime() - other.deliveredAt.getTime();

  if (apart !== 0) {
    return apart;
  }

  const [a, b] = [BigInt(one.id), BigInt(other.id)];

  return a < b ? -1 : a > b ? 1 : 0;
};

export interface HookDeliveryHealth {
  readonly failedLastHour: number;
  readonly undelivered: number;
}

export class HookRedeliveries {
  #scannedAt: Date | null = null;
  readonly #seen = new Map<string, Date>();
  readonly #undelivered = new Map<string, HookDelivery>();
  #failures: Date[] = [];

  constructor(
    private readonly deliveries: AppHookDeliveriesPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async redeliver(): Promise<void> {
    const now = this.clock.now();

    this.track(await this.unseen(now), now);
    this.#scannedAt = now;
    this.forget(now);

    const due = HookDelivery.dueOldestFirst(
      this.#undelivered.values(),
      now,
    ).slice(0, MAX_REQUESTS_PER_RUN);

    const taken: string[] = [];

    for (const each of due) {
      if ((await this.request(each, now)) === 'requested') {
        taken.push(each.guid);
      }
    }

    if (taken.length > 0) {
      this.logger.info(
        { guids: taken, failed: due.length - taken.length },
        'Asked GitHub to redeliver failed webhook deliveries',
      );
    }
  }

  health(): HookDeliveryHealth {
    const hourAgo = this.clock.now().getTime() - HOUR_MS;

    return {
      failedLastHour: this.#failures.filter((at) => at.getTime() >= hourAgo)
        .length,
      undelivered: this.#undelivered.size,
    };
  }

  private async unseen(now: Date): Promise<HookDeliveryAttempt[]> {
    const until = Math.max(
      now.getTime() - HOOK_DELIVERY_LOOKBACK_MS,
      (this.#scannedAt?.getTime() ?? 0) - OVERLAP_MS,
    );
    const unseen: HookDeliveryAttempt[] = [];
    let cursor: string | null = null;

    for (let pages = 0; pages < MAX_PAGES; pages += 1) {
      const page = await this.deliveries.page(cursor);

      for (const each of page.attempts) {
        if (each.deliveredAt.getTime() < until) {
          return unseen;
        }

        if (!this.#seen.has(each.id)) {
          unseen.push(each);
        }
      }

      if (page.next === null) {
        return unseen;
      }

      cursor = page.next;
    }

    this.logger.warn(
      { pages: MAX_PAGES },
      'Read only the newest GitHub webhook deliveries',
    );

    return unseen;
  }

  private track(attempts: readonly HookDeliveryAttempt[], now: Date): void {
    const hourAgo = now.getTime() - HOUR_MS;

    for (const attempt of [...attempts].sort(oldestFirst)) {
      this.#seen.set(attempt.id, attempt.deliveredAt);

      const outcome = outcomeOf(attempt.statusCode);

      if (outcome === 'delivered') {
        this.#undelivered.delete(attempt.guid);
        continue;
      }

      if (attempt.deliveredAt.getTime() >= hourAgo) {
        this.#failures.push(attempt.deliveredAt);
      }

      const known = this.#undelivered.get(attempt.guid);
      const failed = { ...attempt, outcome };
      const delivery = known
        ? known.failedAgain(failed)
        : HookDelivery.failed(failed);
      const givesUp = delivery.gaveUp && !known?.gaveUp;

      this.#undelivered.set(attempt.guid, delivery);

      if (givesUp) {
        this.logger.warn(
          { guid: attempt.guid, attempts: delivery.attempts },
          'Stopped asking GitHub to redeliver a failed webhook delivery',
        );
      }
    }
  }

  private forget(now: Date): void {
    const overlap = now.getTime() - OVERLAP_MS;
    const hourAgo = now.getTime() - HOUR_MS;

    for (const [guid, each] of this.#undelivered) {
      if (each.isGone(now)) {
        this.#undelivered.delete(guid);
      }
    }

    for (const [id, at] of this.#seen) {
      if (at.getTime() < overlap) {
        this.#seen.delete(id);
      }
    }

    this.#failures = this.#failures.filter((at) => at.getTime() >= hourAgo);
  }

  private async request(
    each: HookDelivery,
    now: Date,
  ): Promise<RequestOutcome> {
    let outcome: RequestOutcome = 'requested';

    try {
      await this.deliveries.redeliver(each.latestAttemptId);
    } catch (error) {
      outcome = 'failed';
      this.logger.warn(
        { guid: each.guid, err: error },
        'GitHub did not take a webhook redelivery request',
      );
    }

    this.#undelivered.set(each.guid, each.requested(now));
    this.telemetry.count(REDELIVERIES_METRIC, { [OUTCOME]: outcome });

    return outcome;
  }
}
