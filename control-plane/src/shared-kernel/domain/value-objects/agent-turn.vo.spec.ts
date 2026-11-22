import { InvalidAgentTurnError } from '@shared-kernel/domain/exceptions/invalid-agent-turn.error';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const ORDERED = new Date('2026-11-21T09:00:00.000Z');
const LATER = new Date('2026-11-21T10:00:00.000Z');

const turn = (attempt: number, run = RUN, at = ORDERED) =>
  AgentTurn.of(run, attempt, at);

describe('AgentTurn', () => {
  it.each([0, -1, 1.5])('refuses attempt %s', (attempt) => {
    expect(() => turn(attempt)).toThrow(InvalidAgentTurnError);
  });

  it('refuses a run with no time it was ordered', () => {
    expect(() => turn(1, RUN, new Date(Number.NaN))).toThrow(
      'needs the time run run_1 was ordered',
    );
  });

  it('equals the same attempt of the same run', () => {
    expect(turn(2).equals(turn(2))).toBe(true);
    expect(turn(2).equals(turn(1))).toBe(false);
    expect(turn(2).equals(turn(2, RunId.of('run_2')))).toBe(false);
  });

  it('covers its own and earlier attempts of the same run', () => {
    expect(turn(2).covers(turn(1))).toBe(true);
    expect(turn(2).covers(turn(2))).toBe(true);
    expect(turn(2).covers(turn(3))).toBe(false);
  });

  it('covers every turn of a run ordered before its own, and none of a run ordered after', () => {
    const later = turn(1, RunId.of('run_2'), LATER);

    expect(later.covers(turn(5))).toBe(true);
    expect(turn(5).covers(later)).toBe(false);
  });

  it('lets exactly one of two runs ordered at the same time cover the other', () => {
    const other = turn(1, RunId.of('run_2'));

    expect(other.covers(turn(3))).toBe(true);
    expect(turn(3).covers(other)).toBe(false);
  });
});
