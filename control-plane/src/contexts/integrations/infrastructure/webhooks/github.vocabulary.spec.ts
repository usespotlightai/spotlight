import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubWebhookProvider } from '@integrations/infrastructure/webhooks/github.webhook-provider';
import { describe, expect, it } from 'vitest';

const provider = new GitHubWebhookProvider({} as unknown as GitHubWebhooksPort);

const raised = provider.happenings.map((each) => each.happening.value);

describe('the words the GitHub webhook provider declares', () => {
  it('each start with the name of the GitHub integration', () => {
    for (const happening of provider.happenings) {
      expect(happening.happening.integration).toBe(provider.key);
    }
  });

  it('each have a summary for a note', () => {
    for (const happening of provider.happenings) {
      expect(happening.summary.trim()).not.toBe('');
      expect(happening.label.trim()).not.toBe('');
    }
  });

  it('count a comment, a review and a mention as answers, and nothing else', () => {
    expect(
      provider.happenings
        .filter((each) => each.answers)
        .map((each) => each.happening.value)
        .sort(),
    ).toEqual([
      'github.pull_request.changes-requested',
      'github.pull_request.commented',
      'github.pull_request.mentioned',
    ]);
  });

  it('name no word twice', () => {
    expect(new Set(raised).size).toBe(raised.length);
  });
});
