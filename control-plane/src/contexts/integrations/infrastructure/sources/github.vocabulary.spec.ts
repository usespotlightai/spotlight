import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubSource } from '@integrations/infrastructure/sources/github.source';
import { describe, expect, it } from 'vitest';

const source = new GitHubSource({} as unknown as GitHubWebhooksPort);

const raised = source.happenings.map((each) => each.happening.value);

describe('the words the GitHub source declares', () => {
  it('are each named by GitHub as their source', () => {
    for (const happening of source.happenings) {
      expect(happening.happening.source).toBe(source.key);
    }
  });

  it('each say how they read in a note', () => {
    for (const happening of source.happenings) {
      expect(happening.told.trim()).not.toBe('');
      expect(happening.label.trim()).not.toBe('');
    }
  });

  it('count a comment, a review and a mention as a person speaking, and nothing else', () => {
    expect(
      source.happenings
        .filter((each) => each.spoken)
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
