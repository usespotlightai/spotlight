import { SearchBriefing } from '@replays/application/rendering/search-briefing';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const briefed = (objective: SearchObjective) =>
  SearchBriefing.of({
    stationKey: 'build',
    stationName: 'Build',
    lineKey: 'delivery',
    seed: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
    iteration: 1,
    iterations: 3,
    perIteration: 2,
    left: Spend.of(40, 'USD'),
    ceiling: Spend.ceiling(50, 'USD'),
    searchedTasks: 7,
    heldOutTasks: 3,
    objective,
  });

describe('SearchBriefing', () => {
  it('tells the agent a better candidate succeeds on more tasks when the search looks for success', () => {
    expect(briefed('success')).toContain(
      'A candidate is better when it succeeds on more tasks.',
    );
    expect(briefed('success')).not.toContain('less cost');
  });

  it('tells the agent to find the same success for less when the search looks for cost', () => {
    const briefing = briefed('cost');

    expect(briefing).toContain(
      'this search looks for the same success at less cost',
    );
    expect(briefing).toContain(
      'One that succeeds clearly less often is out, however cheap.',
    );
  });
});
