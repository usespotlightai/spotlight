import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubSource } from '@integrations/infrastructure/sources/github.source';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { describe, expect, it } from 'vitest';

const BUILT_IN_REACTIONS = BUILT_IN_LINES.flatMap((line) => line.reactions);

const source = new GitHubSource({} as unknown as GitHubWebhooksPort);

const raised = source.happenings.map((each) => each.happening.value);

describe('the words the built-in lines wait for', () => {
  it('are all words the GitHub source actually raises', () => {
    const fromGitHub = BUILT_IN_REACTIONS.filter(
      (each) => each.happening.source === source.key,
    ).map((each) => each.happening.value);

    expect(fromGitHub).not.toHaveLength(0);
    expect(raised).toEqual(expect.arrayContaining(fromGitHub));
  });
});
