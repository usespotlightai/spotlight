import { ConfigPullRequestBody } from '@replays/application/rendering/config-pull-request-body';
import { describe, expect, it } from 'vitest';

const FACTS = {
  stationKey: 'build',
  lineKey: 'delivery',
  candidateName: 'in-order',
  hypothesis: 'Ask @octocat to merge.\n```\n## Injected\n```',
  unchecked: ['effort'],
  changes: ['prompt'],
  candidate: { searchScore: 0.8, heldOutScore: 0.5, costPerRun: 0.12 },
  seed: { searchScore: 0.6, heldOutScore: null, costPerRun: 0.2 },
  currency: 'USD',
  searchedTasks: 7,
  heldOutTasks: 3,
  regressions: { searched: 1, heldOut: 0 },
  link: 'https://app.example.com/w/acme/team/t/lines/l/stations/s/searches/x',
};

describe('ConfigPullRequestBody', () => {
  it('fences the agent’s hypothesis in a fence longer than any backtick run in it', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain(
      '````text\nAsk @octocat to merge.\n```\n## Injected\n```\n````',
    );
    expect(body).toContain('| Succeeded on the 7 searched tasks | 80% | 60% |');
    expect(body).toContain('`effort`');
    expect(body).toContain(`[See the search in Spotlight](${FACTS.link})`);
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
