import { describe, expect, it } from 'vitest';
import {
  dismissedToolFilter,
  formatLatency,
  formatTrendRule,
  usedNothing,
} from '@/lib/insights-tools';

describe('the Tools tab’s view model', () => {
  it('says the trend rule with the numbers the summary used', () => {
    expect(
      formatTrendRule({ recentWeeks: 3, minRuns: 8, shiftPoints: 15 }),
    ).toBe(
      'Rising or falling: the share of runs that read the skill moved by 15+ points. Compares the last 3 weeks with the weeks before. Minimum runs on each side: 8',
    );
  });

  it('drills into a dismissed tool on its own server, or on none', () => {
    expect(
      dismissedToolFilter({
        tool: 'create_issue',
        server: 'linear',
        dismissed: 2,
      }),
    ).toEqual({ dismissedTool: 'create_issue', dismissedServer: 'linear' });
    expect(
      dismissedToolFilter({
        tool: 'claude-code execute',
        server: null,
        dismissed: 1,
      }),
    ).toEqual({
      dismissedTool: 'claude-code execute',
      dismissedServer: 'none',
    });
  });

  it('shows latency as a duration, and a dash where nothing was timed', () => {
    expect(formatLatency(420)).toBe('420ms');
    expect(formatLatency(null)).toBe('–');
  });

  it('calls a period that used no skill, server or approval empty', () => {
    const none = {
      skills: [],
      servers: [],
      dismissals: [],
      unused: [],
    } as unknown as Parameters<typeof usedNothing>[0];

    expect(usedNothing(none)).toBe(true);
    expect(usedNothing({ ...none, unused: ['grafana'] })).toBe(false);
  });
});
