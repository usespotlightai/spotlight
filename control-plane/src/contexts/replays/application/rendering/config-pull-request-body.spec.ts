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
      tasks: 7,
    },
    heldOut: null,
  },
  onlyOnSeenTasks: null,
  heldOutPending: false,
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

  it('warns when the picked candidate gained only on the tasks the search could see, and only then', () => {
    const marked = ConfigPullRequestBody.of({
      ...FACTS,
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, verdict: 'better' },
        heldOut: {
          gain: -0.03,
          low: -0.2,
          high: 0.12,
          verdict: 'within-noise',
          minGain: 0.05,
          tasks: 6,
        },
      },
      onlyOnSeenTasks: 'marked',
    });

    expect(marked).toContain(
      'Its gain showed only on the tasks the search could see: +20 points on the searched tasks, but −3 points on the held-out tasks the search never showed its agent.',
    );
    expect(ConfigPullRequestBody.of(FACTS)).not.toContain(
      'Its gain showed only on the tasks the search could see',
    );
  });

  it('says when too few held-out tasks were scored to tell whether the gain carries over', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, verdict: 'better' },
        heldOut: {
          gain: 0,
          low: -0.5,
          high: 0.5,
          verdict: 'within-noise',
          minGain: 0.05,
          tasks: 3,
        },
      },
      onlyOnSeenTasks: 'too-few-held-out',
    });

    expect(body).toContain(
      'It gained +20 points on the searched tasks, but only 3 held-out tasks scored on both sides, too few to tell whether the gain also shows on tasks the search never showed its agent.',
    );
    expect(body).not.toContain(
      'Its gain showed only on the tasks the search could see',
    );
  });

  it('says the held-out result was still pending when the pull request opened, so the warning could not be checked', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      candidate: { ...FACTS.candidate, heldOutScore: null },
      regressions: { searched: 1, heldOut: null },
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, verdict: 'better' },
        heldOut: null,
      },
      heldOutPending: true,
    });

    expect(body).toContain(
      'Its held-out replay had not finished when this pull request opened, so Spotlight could not yet check whether its gain also shows on the held-out tasks the search never showed its agent.',
    );
    expect(ConfigPullRequestBody.of(FACTS)).not.toContain(
      'Its held-out replay had not finished',
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
