import type { RunJournalEntryReaderPort } from '@runs/application/ports/run-journal-entry-reader.port';
import type { RunJournalEntryView } from '@runs/application/ports/run-stream.port';
import type {
  RunViewing,
  WatchedRun,
} from '@runs/application/services/run-viewing.service';
import { WatchRunStream } from '@runs/application/services/watch-run-stream.service';
import { InMemoryRunStream } from '@runs/infrastructure/streaming/in-memory-run-stream';
import { describe, expect, it, vi } from 'vitest';

const entry = (seq: number): RunJournalEntryView => ({
  attempt: 1,
  seq,
  type: 'output',
  at: '2026-11-07T09:00:00.000Z',
});

const watching = (watchable: boolean, backlog = [entry(1)]) => {
  const runs = {
    watchedBy: vi.fn(async () =>
      watchable ? ({ attempt: 1 } as WatchedRun) : null,
    ),
  } as unknown as RunViewing;
  let answer: (found: RunJournalEntryView[]) => void = () => {};
  const entries = {
    entriesSince: vi.fn(
      () =>
        new Promise<RunJournalEntryView[]>((resolve) => {
          answer = resolve;
        }),
    ),
    egressEnforcementOf: vi.fn(async () => null),
  } satisfies RunJournalEntryReaderPort;
  const stream = new InMemoryRunStream();

  return {
    entries,
    stream,
    answerBacklog: () => answer(backlog),
    service: new WatchRunStream(runs, entries, stream),
  };
};

describe('WatchRunStream', () => {
  it('replays the backlog first, then what was published while it was read', async () => {
    const { service, stream, answerBacklog } = watching(true);
    const seen: number[] = [];

    const watch = await service.open('run_1', 'user_1');
    watch?.follow(
      { attempt: 1, seq: 0 },
      (each) => seen.push(each.seq),
      () => {},
    );
    stream.publish('run_1', [entry(2)]);
    answerBacklog();
    await vi.waitFor(() => expect(seen).toEqual([1, 2]));

    stream.publish('run_1', [entry(3)]);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('opens no watch on a run the viewer may not watch', async () => {
    const { service, entries } = watching(false);

    expect(await service.open('run_1', 'user_2')).toBeNull();
    expect(entries.entriesSince).not.toHaveBeenCalled();
  });
});
