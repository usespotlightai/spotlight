import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { replayed } from '@platform/http/resources/replayed';
import { inCodePointOrderOf } from '@platform/ordering/code-point-order';
import type {
  Rejected,
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';

const rejected = (kind: string, outcome: Rejected): never => {
  switch (outcome.outcome) {
    case 'version-conflict':
      throw ProblemException.versionConflict(kind, outcome.currentVersion);
    case 'in-use':
      throw ProblemException.inUse(kind, outcome.reason);
    case 'forbidden':
      throw ProblemException.forbidden(kind, outcome.act);
  }
};

export const respondFound = <T, R>(
  kind: string,
  resource: T | null,
  toResponse: (resource: T) => R,
): R => {
  if (resource === null) {
    throw ProblemException.notFound(kind);
  }

  return toResponse(resource);
};

export const respondListed = <T, R extends { readonly address: string }>(
  resources: readonly T[] | null,
  toResponse: (resource: T) => R,
): ResourceList<R> => {
  if (resources === null) {
    throw ProblemException.notFound('workspace');
  }

  return {
    items: resources
      .map(toResponse)
      .sort(inCodePointOrderOf((each) => each.address)),
  };
};

export const respondCreated = async <R extends object>(
  kind: string,
  created: ResourceCreated | null,
  toResponse: (id: string) => Promise<R>,
): Promise<R> => {
  switch (created?.outcome) {
    case 'created': {
      const response = await toResponse(created.id);

      return created.replayed ? replayed(response) : response;
    }
    case 'invalid':
      throw ProblemException.invalid(kind, created.problems);
    case 'already-exists':
      throw ProblemException.alreadyExists(kind, created.address);
    case 'idempotency-key-reused':
      throw ProblemException.idempotencyKeyReused();
    case 'forbidden':
      throw ProblemException.forbidden(kind, created.act);
    default:
      throw ProblemException.notFound(kind);
  }
};

export const respondUpdated = <R>(
  kind: string,
  updated: ResourceUpdated | null,
  toResponse: (id: string) => Promise<R>,
): Promise<R> => {
  if (!updated) {
    throw ProblemException.notFound(kind);
  }

  switch (updated.outcome) {
    case 'updated':
      return toResponse(updated.id);
    case 'invalid':
      throw ProblemException.invalid(kind, updated.problems);
    default:
      return rejected(kind, updated);
  }
};

export const respondDeleted = (
  kind: string,
  deleted: ResourceDeleted | null,
): void => {
  if (!deleted) {
    throw ProblemException.notFound(kind);
  }

  if (deleted.outcome !== 'deleted') {
    rejected(kind, deleted);
  }
};
