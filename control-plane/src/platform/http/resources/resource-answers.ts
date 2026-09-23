import { ProblemException } from '@platform/http/resources/problem.exception';
import { replayed } from '@platform/http/resources/replayed';
import type {
  Refused,
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';

const refused = (kind: string, outcome: Refused): never => {
  throw outcome.outcome === 'moved-on'
    ? ProblemException.movedOn(kind, outcome.currentVersion)
    : ProblemException.inUse(kind, outcome.reason);
};

export const found = <T, R>(
  kind: string,
  held: T | null,
  answer: (held: T) => R,
): R => {
  if (held === null) {
    throw ProblemException.notFound(kind);
  }

  return answer(held);
};

export const answerCreated = async <R extends object>(
  kind: string,
  created: ResourceCreated | null,
  answer: (id: string) => Promise<R>,
): Promise<R> => {
  switch (created?.outcome) {
    case 'created': {
      const answered = await answer(created.id);

      return created.replayed ? replayed(answered) : answered;
    }
    case 'invalid':
      throw ProblemException.invalid(kind, created.problems);
    case 'taken':
      throw ProblemException.taken(kind, created.address);
    case 'key-reused':
      throw ProblemException.idempotencyKeyReused();
    default:
      throw ProblemException.notFound(kind);
  }
};

export const answerUpdated = <R>(
  kind: string,
  updated: ResourceUpdated | null,
  answer: (id: string) => Promise<R>,
): Promise<R> => {
  if (!updated) {
    throw ProblemException.notFound(kind);
  }

  switch (updated.outcome) {
    case 'updated':
      return answer(updated.id);
    case 'invalid':
      throw ProblemException.invalid(kind, updated.problems);
    default:
      return refused(kind, updated);
  }
};

export const answerDeleted = (
  kind: string,
  deleted: ResourceDeleted | null,
): void => {
  if (!deleted) {
    throw ProblemException.notFound(kind);
  }

  if (deleted.outcome !== 'deleted') {
    refused(kind, deleted);
  }
};
