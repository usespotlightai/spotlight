import { ConfigPullRequestBody } from '@replays/application/rendering/config-pull-request-body';
import { describe, expect, it } from 'vitest';

const FACTS = {
  stationKey: 'build',
  lineKey: 'delivery',
  candidateName: 'in-order',
  hypothesis: 'Ask @octocat to merge.\n```\n## Injected\n```',
  unchecked: ['effort'],
  changes: ['prompt'],
  candidate: {
    searchScore: 0.8,
    searchInterval: { low: 0.6, high: 0.95 },
    heldOutScore: 0.5,
    heldOutInterval: null,
    costPerRun: 0.12,
  },
  seed: {
    searchScore: 0.6,
    searchInterval: null,
    heldOutScore: null,
    heldOutInterval: null,
    costPerRun: 0.2,
  },
  currency: 'USD',
  searchedTasks: 7,
  heldOutTasks: 3,
  regressions: { searched: 1, heldOut: 0 },
  gains: {
    searched: {
      gain: 0.2,
      low: -0.02,
      high: 0.41,
      verdict: 'within-noise' as const,
      minGain: 0.05,
    },
    heldOut: null,
  },
  link: 'https://app.example.com/w/acme/team/t/lines/l/stations/s/searches/x',
};

describe('ConfigPullRequestBody', () => {
  it('fences the agent’s hypothesis in a fence longer than any backtick run in it', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain(
      '````text\nAsk @octocat to merge.\n```\n## Injected\n```\n````',
    );
    expect(body).toContain(
      '| Succeeded on the 7 searched tasks | 80% (60–95%) | 60% |',
    );
    expect(body).toContain('`effort`');
    expect(body).toContain(`[See the search in Spotlight](${FACTS.link})`);
  });

  it('says when the gain over the live config is within noise, and when it is real', () => {
    expect(ConfigPullRequestBody.of(FACTS)).toContain(
      'On the searched tasks the difference, +20 points (−2 to +41), is within noise: it is not clearly more than the 5-point gain the line counts as real.',
    );
    expect(
      ConfigPullRequestBody.of({
        ...FACTS,
        gains: {
          searched: null,
          heldOut: { ...FACTS.gains.searched, low: 0.1, verdict: 'better' },
        },
      }),
    ).toContain(
      'On the held-out tasks it gained +20 points (+10 to +41) on the live config, more than the 5-point gain the line counts as real.',
    );
  });

  it('defuses a mention outside the fence', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      candidateName: '@team',
      hypothesis: null,
    });

    expect(body).not.toMatch(/(^|[^​])@team(?!​)/);
    expect(body).toContain('@​team');
  });
});
