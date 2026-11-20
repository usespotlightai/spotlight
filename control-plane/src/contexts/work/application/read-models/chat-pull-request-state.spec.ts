import { chatPullRequestState } from '@work/application/read-models/chat-pull-request-state';
import { describe, expect, it } from 'vitest';

describe('what became of a chat’s pull request', () => {
  it('is on hold while the chat holds its task', () => {
    expect(chatPullRequestState({ finished: false, heldForChat: true })).toBe(
      'held',
    );
  });

  it('is with the line once the person hands the task over', () => {
    expect(chatPullRequestState({ finished: false, heldForChat: false })).toBe(
      'line',
    );
  });

  it('is completed when its task is finished, held or not', () => {
    expect(chatPullRequestState({ finished: true, heldForChat: true })).toBe(
      'completed',
    );
  });

  it('is gone when its task was deleted', () => {
    expect(chatPullRequestState(null)).toBe('gone');
  });
});
