import type {
  AppHookDeliveriesPort,
  HookDeliveryAttempt,
} from '@github/application/ports/app-hook-deliveries.port';
import {
  exhausted,
  HOOK_DELIVERY_LOOKBACK_MS,
  type HookDeliveryHistory,
  outcomeOf,
  redeliveryDue,
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

interface Tracked extends HookDeliveryHistory {
  readonly latestId: number;
  readonly gaveUp: boolean;
}

export interface HookDeliveryHealth {
  readonly failedLastHour: number;
  readonly undelivered: number;
}

export class HookRedeliveries {
  #scannedAt: Date | null = null;
  readonly #seen = new Map<number, Date>();
  readonly #undelivered = new Map<string, Tracked>();
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

    const due = [...this.#undelivered]
      .filter(([, each]) => redeliveryDue(each, now))
      .sort(([, a], [, b]) => a.firstAt.getTime() - b.firstAt.getTime())
      .slice(0, MAX_REQUESTS_PER_RUN);

    for (const [guid, each] of due) {
      await this.request(guid, each, now);
    }

    if (due.length > 0) {
      this.logger.info(
        { guids: due.map(([guid]) => guid) },
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

      if (!page.next) {
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
    const oldestFirst = [...attempts].sort(
      (a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime(),
    );

    for (const attempt of oldestFirst) {
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
      const tracked: Tracked = {
        firstAt: known?.firstAt ?? attempt.deliveredAt,
        lastAt: attempt.deliveredAt,
        lastOutcome: outcome,
        attempts: (known?.attempts ?? 0) + 1,
        requests: known?.requests ?? 0,
        requestedAt: known?.requestedAt ?? null,
        latestId: attempt.id,
        gaveUp: known?.gaveUp ?? false,
      };
      const givesUp = !tracked.gaveUp && exhausted(tracked);

      this.#undelivered.set(attempt.guid, { ...tracked, gaveUp: givesUp });

      if (givesUp) {
        this.logger.warn(
          { guid: attempt.guid, attempts: tracked.attempts },
          'Stopped asking GitHub to redeliver a failed webhook delivery',
        );
      }
    }
  }

  private forget(now: Date): void {
    const lookback = now.getTime() - HOOK_DELIVERY_LOOKBACK_MS;
    const overlap = now.getTime() - OVERLAP_MS;
    const hourAgo = now.getTime() - HOUR_MS;

    for (const [guid, each] of this.#undelivered) {
      if (each.firstAt.getTime() < lookback) {
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

  private async request(guid: string, each: Tracked, now: Date): Promise<void> {
    let outcome = 'requested';

    try {
      await this.deliveries.redeliver(each.latestId);
    } catch (error) {
      outcome = 'failed';
      this.logger.warn(
        { guid, err: error },
        'GitHub did not take a webhook redelivery request',
      );
    }

    this.#undelivered.set(guid, {
      ...each,
      requests: each.requests + 1,
      requestedAt: now,
    });
    this.telemetry.count(REDELIVERIES_METRIC, { [OUTCOME]: outcome });
  }
}
