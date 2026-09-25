import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { describe, expect, it } from 'vitest';

const until = new Date('2026-09-24T12:05:00.000Z');

describe('RunnerReservation', () => {
  it('holds until the moment it runs out', () => {
    const reservation = RunnerReservation.of(
      RunnerId.of('runner_1'),
      'burst',
      until,
    );

    expect(reservation.holdsAt(new Date(until.getTime() - 1))).toBe(true);
    expect(reservation.holdsAt(until)).toBe(false);
  });

  it('is held for the runner it names and no other', () => {
    const reservation = RunnerReservation.of(
      RunnerId.of('runner_1'),
      'burst',
      until,
    );

    expect(reservation.heldFor(RunnerId.of('runner_1'))).toBe(true);
    expect(reservation.heldFor(RunnerId.of('runner_2'))).toBe(false);
  });

  it('gives the runner five minutes to claim from when it is reserved', () => {
    const reservation = RunnerReservation.from(
      RunnerId.of('runner_1'),
      'burst',
      new Date('2026-09-24T12:00:00.000Z'),
    );

    expect(reservation.until).toEqual(until);
    expect(reservation.pool).toBe('burst');
    expect(
      reservation.equals(
        RunnerReservation.of(RunnerId.of('runner_1'), 'burst', until),
      ),
    ).toBe(true);
  });

  it('refuses to be reserved from no pool', () => {
    expect(() =>
      RunnerReservation.from(RunnerId.of('runner_1'), '', until),
    ).toThrow(InconsistentStateError);
  });

  it('refuses to name no pool', () => {
    expect(() =>
      RunnerReservation.of(RunnerId.of('runner_1'), '  ', until),
    ).toThrow(InconsistentStateError);
  });
});
