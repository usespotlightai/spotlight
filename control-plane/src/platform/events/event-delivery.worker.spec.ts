import type {
  DeliveryLane,
  EventDelivery,
} from '@platform/events/event-delivery';
import { EventDeliveryWorker } from '@platform/events/event-delivery.worker';
import type { EventOutbox } from '@platform/events/event-outbox';
import { describe, expect, it, vi } from 'vitest';

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('EventDeliveryWorker', () => {
  it('keeps delivering to the subscribers while the sinks lane waits for a slow receiver', async () => {
    const lanes: DeliveryLane[] = [];
    let release = () => undefined as void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delivery = {
      processDue: vi.fn(async (_limit: number, lane: DeliveryLane) => {
        lanes.push(lane);

        if (lane === 'sinks') {
          await holding;
        }

        return 0;
      }),
    };
    const worker = new EventDeliveryWorker(
      delivery as unknown as EventDelivery,
      {} as EventOutbox,
      logger,
    );

    const settled = () => new Promise((resolve) => setImmediate(resolve));
    const first = worker.tick();
    await settled();
    await worker.tick();
    await worker.tick();

    expect(lanes).toEqual([
      'subscribers',
      'sinks',
      'subscribers',
      'subscribers',
    ]);

    release();
    await first;

    expect(lanes.filter((each) => each === 'sinks')).toHaveLength(2);
  });
});
