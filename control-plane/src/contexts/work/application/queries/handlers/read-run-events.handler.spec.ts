import type { RunEventReaderPort } from '@work/application/ports/run-event-reader.port';
import { ReadRunEventsHandler } from '@work/application/queries/handlers/read-run-events.handler';
import { ReadRunEventsQuery } from '@work/application/queries/read-run-events.query';
import { describe, expect, it, vi } from 'vitest';

const ENTRY = {
  attempt: 1,
  seq: 1,
  type: 'output',
  at: '2026-11-07T09:00:00.000Z',
};

const reading = (watchable: boolean) => {
  const events = {
    findForViewer: vi.fn(async () =>
      watchable ? { id: 'run_1', attempt: 1 } : null,
    ),
    eventsSince: vi.fn(async () => [ENTRY]),
    lastOfType: vi.fn(async () => null),
  } satisfies RunEventReaderPort;

  return { events, handler: new ReadRunEventsHandler(events) };
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
