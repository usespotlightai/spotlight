import {
  aSearchVisibility,
  BUILD_BLOCK,
} from '@work/application/ports/search-visibility.fake-spec';
import { VisibleHistory } from '@work/application/read-models/visible-history';
import { describe, expect, it } from 'vitest';

const VISIBILITY = aSearchVisibility({
  stationId: 'station_build',
  heldOutTasks: ['task_held_out'],
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
          repeat: 1,
          succeeded: true,
          reasons: [],
          verdict: 'pass',
        },
      ],
    },
  ],
});

describe('VisibleHistory', () => {
  it('sees only the searched station, hides held-out tasks and shows originals not already listed', () => {
    const visible = VisibleHistory.limitedTo(VISIBILITY);

    expect(visible.isSearch).toBe(true);
    expect(visible.seesRunAt('station_build')).toBe(true);
    expect(visible.seesRunAt('station_ship')).toBe(false);
    expect(visible.seesRunAt(null)).toBe(false);
    expect(visible.hides({ taskId: 'task_held_out' })).toBe(true);
    expect(visible.hides({ taskId: 'task_searched' })).toBe(false);
    expect(visible.heldOutTasks).toEqual(['task_held_out']);
    expect(visible.shownBeyond([{ runId: 'run_a' }])).toEqual(['run_b']);
    expect(visible.candidates.map((each) => each.name)).toEqual([
      'shorter-prompt',
    ]);
    expect(visible.seedBlock).toEqual(BUILD_BLOCK);
  });

  it('sees everything, hides nothing and shows nothing extra for a run that is no search', () => {
    const hidden = VisibleHistory.unrestricted();

    expect(hidden.isSearch).toBe(false);
    expect(hidden.seesRunAt('station_ship')).toBe(true);
    expect(hidden.seesRunAt(null)).toBe(true);
    expect(hidden.hides({ taskId: 'task_held_out' })).toBe(false);
    expect(hidden.heldOutTasks).toEqual([]);
    expect(hidden.shownBeyond([])).toEqual([]);
    expect(hidden.candidates).toEqual([]);
    expect(hidden.seedBlock).toBeNull();
  });
});
