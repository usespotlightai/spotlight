import { traceVolumeOf } from '@work/domain/services/trace-volume';
import { TraceRange } from '@work/domain/value-objects/trace-range.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-29T12:00:00.000Z');

const HOUR = TraceRange.of('1h', NOW);

const BARS = 30;

const started = (at: Date, errors = 0) => ({ startedAt: at, errors });

describe('traceVolumeOf', () => {
  it('draws the whole stretch even where nothing ran', () => {
    const volume = traceVolumeOf([], HOUR);

    expect(volume).toHaveLength(BARS);
    expect(volume.every((bucket) => bucket.count === 0)).toBe(true);
    expect(volume[0]?.from).toEqual(HOUR.from);
    expect(volume[volume.length - 1]?.to).toEqual(HOUR.to);
  });

  it('lays the traces where they fall in the window, not end to end', () => {
    const volume = traceVolumeOf(
      [started(HOUR.from), started(new Date(NOW.getTime() - 1))],
      HOUR,
    );

    expect(volume[0]?.count).toBe(1);
    expect(volume[volume.length - 1]?.count).toBe(1);
    expect(volume.slice(1, -1).every((bucket) => bucket.count === 0)).toBe(
      true,
    );
  });

  it('adds up every error in the stretch', () => {
    const volume = traceVolumeOf(
      [started(HOUR.from, 2), started(HOUR.from, 1)],
      HOUR,
    );

    expect(volume[0]).toMatchObject({ count: 2, errors: 3 });
  });

  it('reads a clean stretch as nothing rather than as nothing having run', () => {
    expect(traceVolumeOf([started(HOUR.from)], HOUR)[0]).toMatchObject({
      count: 1,
      errors: 0,
    });
  });

  it('keeps a trace from outside the window at the near end', () => {
    const volume = traceVolumeOf(
      [started(new Date(0)), started(new Date(NOW.getTime() + 60_000))],
      HOUR,
    );

    expect(volume[0]?.count).toBe(1);
    expect(volume[volume.length - 1]?.count).toBe(1);
  });
});
