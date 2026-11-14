import { lastUseOf } from '@runs/domain/services/working-copy-last-use';
import { describe, expect, it } from 'vitest';

const at = (time: string) => new Date(`2026-11-14T${time}:00.000Z`);

const use = (
  id: string,
  times: { created: string; started?: string; ended?: string },
) => ({
  id,
  createdAt: at(times.created),
  startedAt: times.started ? at(times.started) : null,
  endedAt: times.ended ? at(times.ended) : null,
});

describe('lastUseOf', () => {
  it('picks the run that ended last, not the one created last', () => {
    const early = use('run_1', {
      created: '09:00',
      started: '09:00',
      ended: '13:00',
    });
    const late = use('run_2', {
      created: '10:00',
      started: '10:00',
      ended: '10:30',
    });

    expect(lastUseOf([late, early])).toBe(early);
  });

  it('counts a run that still runs by when it started', () => {
    const ended = use('run_1', {
      created: '09:00',
      started: '09:00',
      ended: '10:00',
    });
    const running = use('run_2', { created: '10:30', started: '10:30' });

    expect(lastUseOf([ended, running])).toBe(running);
  });

  it('skips a run that never started, and finds none among only those', () => {
    const ended = use('run_1', {
      created: '09:00',
      started: '09:00',
      ended: '10:00',
    });
    const queued = use('run_2', { created: '12:00' });

    expect(lastUseOf([queued, ended])).toBe(ended);
    expect(lastUseOf([queued])).toBeNull();
  });

  it('breaks a tie by when the run was created, then by its id', () => {
    const times = { started: '09:00', ended: '10:00' };
    const first = use('run_1', { created: '08:00', ...times });
    const second = use('run_2', { created: '08:30', ...times });
    const twin = use('run_3', { created: '08:30', ...times });

    expect(lastUseOf([first, second])).toBe(second);
    expect(lastUseOf([twin, second])).toBe(twin);
  });
});
