export const CONFIG_PULL_REQUEST_STATES = [
  'opening',
  'opened',
  'failed',
] as const;

export type ConfigPullRequestState =
  (typeof CONFIG_PULL_REQUEST_STATES)[number];

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
