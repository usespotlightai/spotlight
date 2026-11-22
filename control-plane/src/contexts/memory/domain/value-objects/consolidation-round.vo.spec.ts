import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { ConsolidationRound } from '@memory/domain/value-objects/consolidation-round.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const DUE = new Date('2026-11-28T10:00:00.000Z');

const round = (attempt = 1, dueAt = DUE, team = 'team_1') =>
  ConsolidationRound.of({ teamId: TeamId.of(team), dueAt, attempt });

describe('a consolidation round', () => {
  it('is the same round only for the same sweep and attempt', () => {
    expect(round().equals(round())).toBe(true);
    expect(round().equals(round(2))).toBe(false);
    expect(round().equals(round(1, new Date(DUE.getTime() + 1)))).toBe(false);
    expect(round().equals(round(1, DUE, 'team_2'))).toBe(false);
  });

  it('consolidates for its sweep in whichever attempt', () => {
    expect(round(3).sweeps(TeamId.of('team_1'), DUE)).toBe(true);
    expect(round(3).sweeps(TeamId.of('team_2'), DUE)).toBe(false);
  });

  it('refuses an attempt that is no count, and a sweep with no due time', () => {
    expect(() => round(-1)).toThrow(InvalidMemoryError);
    expect(() => round(1.5)).toThrow(InvalidMemoryError);
    expect(() => round(1, new Date(Number.NaN))).toThrow(InvalidMemoryError);
  });
});
