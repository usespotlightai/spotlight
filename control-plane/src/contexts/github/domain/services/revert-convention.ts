import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export type RevertTarget =
  | { readonly kind: 'number'; readonly number: number }
  | { readonly kind: 'title'; readonly title: string };

const REVERTS_IN_BODY =
  /^\s*Reverts\s+([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)#(\d+)\s*$/im;

const REVERT_TITLE = /^Revert\s+"(.+)"\s*$/;

export const revertTargetOf = (said: {
  readonly title: string;
  readonly body: string | null;
  readonly repository: Repository;
}): RevertTarget | null => {
  const named = said.body ? REVERTS_IN_BODY.exec(said.body) : null;

  if (
    named?.[1] &&
    named[2] &&
    named[1].toLowerCase() === said.repository.value.toLowerCase()
  ) {
    return { kind: 'number', number: Number(named[2]) };
  }

  const titled = REVERT_TITLE.exec(said.title.trim());

  return titled?.[1] ? { kind: 'title', title: titled[1] } : null;
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
