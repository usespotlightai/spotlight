import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import {
  DELIVERY_LANES,
  type DeliveryLane,
} from '@platform/events/event-subscribers';
import { LiveWrites } from '@platform/live/live-writes';
import { detached } from '@platform/telemetry/detached';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1000;

interface LaneState {
  ticking: Promise<void> | null;
  again: boolean;
}

const asksAgain = (state: LaneState): boolean => state.again;

// Each lane ticks on its own, so a slow sink never holds up the subscribers of the contexts.
@Injectable()
export class EventDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  readonly #lanes = new Map<DeliveryLane, LaneState>(
    DELIVERY_LANES.map((lane) => [lane, { ticking: null, again: false }]),
  );
  #stopped = false;
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly delivery: EventDelivery,
    private readonly outbox: EventOutbox,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onModuleInit(): void {
    this.#unsubscribe = this.outbox.onRecorded(() => {
      setImmediate(() =>
        detached(() => LiveWrites.outside(() => void this.tick())),
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    this.#unsubscribe?.();
    await Promise.all(
      [...this.#lanes.values()].flatMap((each) =>
        each.ticking ? [each.ticking] : [],
      ),
    );
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    await Promise.all(DELIVERY_LANES.map((lane) => this.tickLane(lane)));
  }

  private async tickLane(lane: DeliveryLane): Promise<void> {
    const state = this.#lanes.get(lane);

    if (!state || this.#stopped) {
      return;
    }

    if (state.ticking) {
      state.again = true;
      return;
    }

    state.ticking = this.processDue(lane, state);
    await state.ticking;
    state.ticking = null;
  }

  private async processDue(
    lane: DeliveryLane,
    state: LaneState,
  ): Promise<void> {
    try {
      do {
        state.again = false;
        await this.delivery.processDue(lane);
      } while (asksAgain(state) && !this.#stopped);
    } catch (error) {
      this.logger.error({ err: error, lane }, 'Delivering domain events');
    }
  }
}
