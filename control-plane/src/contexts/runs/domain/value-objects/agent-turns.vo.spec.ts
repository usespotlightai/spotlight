import { AgentTurns } from '@runs/domain/value-objects/agent-turns.vo';
import { describe, expect, it } from 'vitest';

const at = (ms: number): Date => new Date(ms);

describe('AgentTurns', () => {
  it('has no turns without agent updates', () => {
    expect(AgentTurns.of([], [at(5)])).toBeNull();
  });

  it('measures the agent time without the time paused between turns', () => {
    const turns = AgentTurns.of([at(0), at(10), at(100), at(130)], [at(50)]);

    expect(turns?.ms).toBe(40);
  });

  it('counts a step only while a turn is working', () => {
    const turns = AgentTurns.of([at(0), at(10), at(100), at(130)], [at(50)]);

    expect(turns?.workingWithin({ from: 5, to: 120 })).toBe(25);
  });
});
