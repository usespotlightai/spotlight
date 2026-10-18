import type { RunEventView } from '@work/application/ports/run-stream.port';
import {
  cursorOf,
  eventIdOf,
  StreamMark,
} from '@work/presentation/http/streaming/stream-mark';
import { describe, expect, it } from 'vitest';

const event = (attempt: number, seq: number): RunEventView => ({
  attempt,
  seq,
  type: 'output',
  at: '2026-09-17T09:00:00.000Z',
});

describe('cursorOf', () => {
  it('resumes within the attempt the run is on', () => {
    expect(cursorOf('2:7', 2)).toEqual({ attempt: 2, seq: 7 });
    expect(cursorOf('7', 2)).toEqual({ attempt: 2, seq: 7 });
  });

  it('starts over when the viewer last saw an earlier attempt', () => {
    expect(cursorOf('1:40', 2)).toEqual({ attempt: 2, seq: 0 });
  });

  it('starts from nothing when there is no cursor', () => {
    expect(cursorOf(undefined, 1)).toEqual({ attempt: 1, seq: 0 });
    expect(cursorOf('nonsense', 1)).toEqual({ attempt: 1, seq: 0 });
  });
});

describe('StreamMark', () => {
  it('sends each entry once, in order', () => {
    const mark = new StreamMark({ attempt: 1, seq: 0 });

    expect(mark.accepts(event(1, 1))).toBe(true);
    expect(mark.accepts(event(1, 1))).toBe(false);
    expect(mark.accepts(event(1, 2))).toBe(true);
  });

  it('follows a requeued run into its next attempt from the first entry', () => {
    const mark = new StreamMark({ attempt: 1, seq: 0 });

    expect(mark.accepts(event(1, 5))).toBe(true);
    expect(mark.accepts(event(2, 1))).toBe(true);
    expect(mark.accepts(event(2, 2))).toBe(true);
    expect(mark.accepts(event(1, 6))).toBe(false);
  });

  it('names each event by its attempt and place', () => {
    expect(eventIdOf(event(2, 3))).toBe('2:3');
  });

  it('names no control-plane entry, so a viewer resumes from where the runner’s entries left off', () => {
    expect(eventIdOf(event(2, -1_000_000))).toBeUndefined();
  });

  it('sends each control-plane entry once, without moving past the runner’s entries', () => {
    const mark = new StreamMark({ attempt: 1, seq: 4 });

    expect(mark.accepts(event(1, -1_000_000))).toBe(true);
    expect(mark.accepts(event(1, -1_000_000))).toBe(false);
    expect(mark.accepts(event(1, -1_000_001))).toBe(true);
    expect(mark.accepts(event(1, 4))).toBe(false);
    expect(mark.accepts(event(1, 5))).toBe(true);
  });

  it('sends the control-plane entries again for a run’s next attempt', () => {
    const mark = new StreamMark({ attempt: 1, seq: 0 });

    expect(mark.accepts(event(1, -1_000_000))).toBe(true);
    expect(mark.accepts(event(2, -1_000_000))).toBe(true);
  });

  it('keeps sending nothing a provisioning failure journalled before the cursor', () => {
    const mark = new StreamMark({ attempt: 1, seq: 3 });

    expect(mark.accepts(event(1, -1))).toBe(false);
  });
});
