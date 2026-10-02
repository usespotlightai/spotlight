import {
  aSight,
  BUILD_BLOCK,
} from '@work/application/ports/search-sight.fake-spec';
import { SightedHistory } from '@work/application/read-models/sighted-history';
import { describe, expect, it } from 'vitest';

const SIGHT = aSight({
  stationId: 'station_build',
  hiddenTasks: ['task_held_out'],
  shownOriginals: ['run_a', 'run_b'],
  candidates: [
    {
      name: 'shorter-prompt',
      fingerprint: 'f'.repeat(64),
      hypothesis: 'Less to read, fewer wrong turns.',
      block: BUILD_BLOCK,
      runs: [
        {
          runId: 'run_c',
          original: 'run_a',
          succeeded: true,
          reasons: [],
          verdict: 'pass',
        },
      ],
    },
  ],
});

describe('SightedHistory', () => {
  it('sees only the searched station, hides held-out tasks and shows originals not already kept', () => {
    const sighted = SightedHistory.through(SIGHT);

    expect(sighted.isSearch).toBe(true);
    expect(sighted.seesRunAt('station_build')).toBe(true);
    expect(sighted.seesRunAt('station_ship')).toBe(false);
    expect(sighted.seesRunAt(null)).toBe(false);
    expect(sighted.hides({ taskId: 'task_held_out' })).toBe(true);
    expect(sighted.hides({ taskId: 'task_searched' })).toBe(false);
    expect(sighted.hiddenTasks).toEqual(['task_held_out']);
    expect(sighted.shownBeyond([{ runId: 'run_a' }])).toEqual(['run_b']);
    expect(sighted.candidates.map((each) => each.name)).toEqual([
      'shorter-prompt',
    ]);
    expect(sighted.seedBlock).toEqual(BUILD_BLOCK);
  });

  it('sees everything, hides nothing and shows nothing extra for a run that is no search', () => {
    const unsighted = SightedHistory.unsighted();

    expect(unsighted.isSearch).toBe(false);
    expect(unsighted.seesRunAt('station_ship')).toBe(true);
    expect(unsighted.seesRunAt(null)).toBe(true);
    expect(unsighted.hides({ taskId: 'task_held_out' })).toBe(false);
    expect(unsighted.hiddenTasks).toEqual([]);
    expect(unsighted.shownBeyond([])).toEqual([]);
    expect(unsighted.candidates).toEqual([]);
    expect(unsighted.seedBlock).toBeNull();
  });
});
