export type PullRequestLink = {
  readonly repository: string;
  readonly number: string;
};

export const pullRequestOf = (href: string): PullRequestLink => {
  const parts = new URL(href).pathname.split('/').filter(Boolean);

  return {
    repository: parts.slice(0, 2).join('/') || href,
    number: parts.at(-1) ?? '',
  };
};
