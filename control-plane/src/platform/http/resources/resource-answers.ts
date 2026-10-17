import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { replayed } from '@platform/http/resources/replayed';
import { inCodePointOrderOf } from '@platform/ordering/code-point-order';
import type {
  Refused,
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';

const refused = (kind: string, outcome: Refused): never => {
  switch (outcome.outcome) {
    case 'version-conflict':
      throw ProblemException.versionConflict(kind, outcome.currentVersion);
    case 'in-use':
      throw ProblemException.inUse(kind, outcome.reason);
    case 'forbidden':
      throw ProblemException.forbidden(kind, outcome.act);
  }
};

export const found = <T, R>(
  kind: string,
  resource: T | null,
  answer: (resource: T) => R,
): R => {
  if (resource === null) {
    throw ProblemException.notFound(kind);
  }

  return answer(resource);
};

export const listed = <T, R extends { readonly address: string }>(
  resources: readonly T[] | null,
  answer: (resource: T) => R,
): ResourceList<R> => {
  if (resources === null) {
    throw ProblemException.notFound('workspace');
  }

  return {
    items: resources
      .map(answer)
      .sort(inCodePointOrderOf((each) => each.address)),
  };
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
    case 'forbidden':
      throw ProblemException.forbidden(kind, created.act);
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
