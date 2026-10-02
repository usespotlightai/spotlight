export const CONFIG_PULL_REQUEST_STATES = [
  'opening',
  'opened',
  'refused',
] as const;

export type ConfigPullRequestState =
  (typeof CONFIG_PULL_REQUEST_STATES)[number];

export const CONFIG_PULL_REQUEST_REFUSALS = [
  'no-source',
  'repository-unreachable',
  'file-missing',
  'file-unparsable',
  'block-not-found',
  'blocks-ambiguous',
  'computed-attribute',
  'drifted',
  'edit-failed',
  'branch-taken',
  'file-unwritable',
  'github-refused',
] as const;

export type ConfigPullRequestRefusal =
  (typeof CONFIG_PULL_REQUEST_REFUSALS)[number];
