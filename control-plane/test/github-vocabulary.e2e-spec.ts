import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubWebhookProvider } from '@integrations/infrastructure/webhooks/github.webhook-provider';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { describe, expect, it } from 'vitest';

const BUILT_IN_REACTIONS = BUILT_IN_LINES.flatMap((line) => line.reactions);

const provider = new GitHubWebhookProvider({} as unknown as GitHubWebhooksPort);

const raised = provider.happenings.map((each) => each.happening.value);

describe('the words the built-in lines wait for', () => {
  it('are all words the GitHub webhook provider actually raises', () => {
    const fromGitHub = BUILT_IN_REACTIONS.filter(
      (each) => each.happening.integration === provider.key,
    ).map((each) => each.happening.value);

    expect(fromGitHub).not.toHaveLength(0);
    expect(raised).toEqual(expect.arrayContaining(fromGitHub));
  });
});
