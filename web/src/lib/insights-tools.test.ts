import { describe, expect, it } from 'vitest';
import {
  latencyShown,
  refusedToolFilter,
  trendRuleShown,
  usedNothing,
} from '@/lib/insights-tools';

describe('the Tools tab’s view model', () => {
  it('says the trend rule with the numbers the summary used', () => {
    expect(
      trendRuleShown({ recentWeeks: 3, fewestRuns: 8, shiftPoints: 15 }),
    ).toBe(
      'Spreading or fading: the share of all runs that read the skill moved 15 points or more over the last 3 weeks against the weeks before, with at least 8 runs on each side.',
    );
  });

  it('drills into a refused tool on its own server, or on none', () => {
    expect(
      refusedToolFilter({ tool: 'create_issue', server: 'linear', refused: 2 }),
    ).toEqual({ refusedTool: 'create_issue', refusedServer: 'linear' });
    expect(
      refusedToolFilter({
        tool: 'claude-code execute',
        server: null,
        refused: 1,
      }),
    ).toEqual({ refusedTool: 'claude-code execute', refusedServer: 'none' });
  });

  it('shows latency as a duration, and a dash where nothing was timed', () => {
    expect(latencyShown(420)).toBe('420ms');
    expect(latencyShown(null)).toBe('–');
  });

  it('calls a period that used no skill, server or approval empty', () => {
    const none = {
      skills: [],
      servers: [],
      refusals: [],
      unused: [],
    } as unknown as Parameters<typeof usedNothing>[0];

    expect(usedNothing(none)).toBe(true);
    expect(usedNothing({ ...none, unused: ['grafana'] })).toBe(false);
  });
});
