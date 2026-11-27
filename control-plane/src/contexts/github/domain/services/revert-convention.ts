import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export type RevertTarget =
  | { readonly kind: 'number'; readonly number: number }
  | { readonly kind: 'title'; readonly title: string };

const REVERTS_IN_BODY =
  /^\s*Reverts\s+([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)#(\d+)\s*$/im;

const REVERT_TITLE = /^Revert\s+"(.+)"\s*$/;

export const revertTargetOf = (pullRequest: {
  readonly title: string;
  readonly body: string | null;
  readonly repository: Repository;
}): RevertTarget | null => {
  const named =
    pullRequest.body !== null && pullRequest.body !== ''
      ? REVERTS_IN_BODY.exec(pullRequest.body)
      : null;

  const owner = named?.[1];
  const number = named?.[2];

  if (
    owner !== undefined &&
    owner !== '' &&
    number !== undefined &&
    number !== '' &&
    owner.toLowerCase() === pullRequest.repository.value.toLowerCase()
  ) {
    return { kind: 'number', number: Number(number) };
  }

  const title = REVERT_TITLE.exec(pullRequest.title.trim())?.[1];

  return title !== undefined && title !== '' ? { kind: 'title', title } : null;
};

export const sameRevertTarget = (
  one: RevertTarget | null,
  other: RevertTarget | null,
): boolean => {
  if (one === null || other === null) {
    return one === other;
  }

  return one.kind === 'number' && other.kind === 'number'
    ? one.number === other.number
    : one.kind === 'title' &&
        other.kind === 'title' &&
        one.title === other.title;
};

export interface MergeCandidate {
  readonly merged: boolean;
  readonly closedAt: Date | null;
}

export const lastMergedOf = <Candidate extends MergeCandidate>(
  titled: readonly Candidate[],
): Candidate | null =>
  [...titled]
    .filter((each) => each.merged)
    .sort(
      (a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0),
    )[0] ?? null;
