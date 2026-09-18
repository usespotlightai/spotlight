import { WebChangeStackLinks } from '@change-review/infrastructure/links/web-change-stack.links';
import { describe, expect, it } from 'vitest';

describe('WebChangeStackLinks', () => {
  it('links a run’s change stack page on the web app', () => {
    expect(
      new WebChangeStackLinks('https://app.example/').pageOf({
        slug: 'acme',
        teamId: 't 1',
        runId: 'r1',
      }),
    ).toBe('https://app.example/w/acme/team/t%201/runs/r1/changes');
  });
});
