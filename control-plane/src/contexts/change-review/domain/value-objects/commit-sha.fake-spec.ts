import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';

export const commitSha = (digit: string): CommitSha => {
  const sha = CommitSha.parsed(digit.repeat(40));

  if (sha === null) {
    throw new Error(`'${digit}' repeated is not a commit SHA`);
  }

  return sha;
};
