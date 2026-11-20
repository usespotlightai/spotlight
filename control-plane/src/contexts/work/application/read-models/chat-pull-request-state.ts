export const CHAT_PULL_REQUEST_STATES = [
  'held',
  'line',
  'completed',
  'gone',
] as const;

export type ChatPullRequestState = (typeof CHAT_PULL_REQUEST_STATES)[number];

export const chatPullRequestState = (
  task: { readonly finished: boolean; readonly heldForChat: boolean } | null,
): ChatPullRequestState => {
  if (!task) {
    return 'gone';
  }

  if (task.finished) {
    return 'completed';
  }

  return task.heldForChat ? 'held' : 'line';
};
