import type { RunEventReaderPort } from '@runs/application/ports/run-event-reader.port';
import type {
  RunViewersPort,
  WatchedRun,
} from '@runs/application/ports/run-viewers.port';
import { ReadRunEventsHandler } from '@runs/application/queries/handlers/read-run-events.handler';
import { ReadRunEventsQuery } from '@runs/application/queries/read-run-events.query';
import { describe, expect, it, vi } from 'vitest';

const ENTRY = {
  attempt: 1,
  seq: 1,
  type: 'output',
  at: '2026-11-07T09:00:00.000Z',
};

const reading = (watchable: boolean) => {
  const runs = {
    watchedBy: vi.fn(async () => (watchable ? ({} as WatchedRun) : null)),
  } as unknown as RunViewersPort;
  const events = {
    eventsSince: vi.fn(async () => [ENTRY]),
    lastOfType: vi.fn(async () => null),
  } satisfies RunEventReaderPort;

  return { events, handler: new ReadRunEventsHandler(runs, events) };
};

describe('ReadRunEventsHandler', () => {
  it('replays the journal of a run the viewer may watch', async () => {
    const { handler } = reading(true);

    expect(
      await handler.execute(new ReadRunEventsQuery('run_1', 'user_1', 1, 0)),
    ).toEqual([ENTRY]);
  });

  it('replays nothing of a run the viewer may not watch', async () => {
    const { handler, events } = reading(false);

    expect(
      await handler.execute(new ReadRunEventsQuery('run_1', 'user_2', 1, 0)),
    ).toEqual([]);
    expect(events.eventsSince).not.toHaveBeenCalled();
  });
});
