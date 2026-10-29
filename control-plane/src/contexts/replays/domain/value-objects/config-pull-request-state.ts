export const CONFIG_PULL_REQUEST_STATES = [
  'opening',
  'opened',
  'closing',
  'merged',
  'closed',
  'failed',
] as const;

export type ConfigPullRequestState =
  (typeof CONFIG_PULL_REQUEST_STATES)[number];

export const OPEN_CONFIG_PULL_REQUEST_STATES = [
  'opening',
  'opened',
  'closing',
] as const satisfies readonly ConfigPullRequestState[];

export const CONFIG_PULL_REQUEST_CLOSE_REASONS = [
  'stale',
  'by-person',
] as const;

export type ConfigPullRequestCloseReason =
  (typeof CONFIG_PULL_REQUEST_CLOSE_REASONS)[number];

export const CONFIG_PULL_REQUEST_ERRORS = [
  'no-source',
  'repository-unreachable',
  'file-missing',
  'file-unparsable',
  'block-not-found',
  'blocks-ambiguous',
  'computed-attribute',
  'base-changed',
  'edit-failed',
  'branch-taken',
  'file-unwritable',
  'github-error',
] as const;

export type ConfigPullRequestError =
  (typeof CONFIG_PULL_REQUEST_ERRORS)[number];
