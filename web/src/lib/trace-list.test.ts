import { describe, expect, it } from 'vitest';
import type { Traced } from '@/lib/trace-list';
import { bucketed, spanned, startedOn } from '@/lib/trace-list';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);

const trace = (over: Partial<Traced> = {}): Traced =>
  ({
    taskId: 'task_1',
    title: 'Fix the queue',
    station: 'Implementation',
    stationColor: '#edc12b',
    harness: 'claude-code',
    state: 'completed',
    startedAt: new Date(AT).toISOString(),
    runs: 1,
    input: null,
    output: null,
    ms: 1_000,
    steps: 4,
    faults: 0,
    cost: null,
    currency: null,
    ...over,
  }) as Traced;

const HOUR = { from: AT - 3_600_000, to: AT };
const HALF_HOUR = 30 * 60_000;
const IN_AN_HOUR = 3_600_000 / HALF_HOUR;

describe('bucketed', () => {
  it('draws the whole stretch even where nothing ran', () => {
    const buckets = bucketed([], HOUR, HALF_HOUR);

    expect(buckets).toHaveLength(IN_AN_HOUR);
    expect(buckets.every((each) => each.count === 0)).toBe(true);
    expect(buckets[0]?.from).toBe(HOUR.from);
    expect(buckets[0]?.to).toBe(HOUR.from + HALF_HOUR);
  });

  it('lays the traces where they fall in the window, not end to end', () => {
    const buckets = bucketed(
      [
        trace({ startedAt: new Date(HOUR.from).toISOString() }),
        trace({ taskId: 'task_2', startedAt: new Date(AT).toISOString() }),
      ],
      HOUR,
      HALF_HOUR,
    );

    expect(buckets.reduce((all, each) => all + each.count, 0)).toBe(2);
    expect(buckets[0]?.count).toBe(1);
    expect(buckets[IN_AN_HOUR - 1]?.count).toBe(1);
  });

  it('keeps the buckets nothing happened in', () => {
    expect(
      bucketed([trace()], HOUR, HALF_HOUR).some((each) => each.count === 0),
    ).toBe(true);
  });

  it('adds up every fault in the stretch', () => {
    const held = bucketed([trace({ faults: 2 })], HOUR, HALF_HOUR).at(-1);

    expect(held?.faults).toBe(2);
    expect(held?.count).toBe(1);
  });

  it('reads a clean stretch as nothing rather than as nothing having run', () => {
    const held = bucketed([trace({ faults: 0 })], HOUR, HALF_HOUR).at(-1);

    expect(held?.faults).toBe(0);
    expect(held?.count).toBe(1);
  });

  it('holds a trace from before the window at the near end', () => {
    const buckets = bucketed(
      [trace({ startedAt: new Date(0).toISOString() })],
      HOUR,
      HALF_HOUR,
    );

    expect(buckets[0]?.count).toBe(1);
  });

  it('cuts the stretch into bars of the size it was given', () => {
    const day = bucketed([], { from: AT - 24 * 3_600_000, to: AT }, HALF_HOUR);

    expect(day).toHaveLength(48);
    expect(day[1].from - day[0].from).toBe(HALF_HOUR);
  });
});

describe('spanned', () => {
  it('says both ends, and the day only once where it is the same', () => {
    const said = spanned(AT, AT + 3_600_000);

    expect(said).toContain('–');
    expect(said.match(/Aug/g)).toHaveLength(1);
  });

  it('says both days where the stretch crosses one', () => {
    const said = spanned(AT, AT + 24 * 3_600_000);

    expect(said).toMatch(/Aug.*(–).*(Aug|Sep)/);
  });
});

describe('startedOn', () => {
  it('says the day and the time, which is what tells two runs apart', () => {
    expect(startedOn(new Date(AT).toISOString())).toMatch(/Aug/);
  });
});
