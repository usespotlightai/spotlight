import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';

export const DISPATCH_REPOSITORY = Symbol('DISPATCH_REPOSITORY');

export interface DispatchRepository {
  add(dispatch: Dispatch): Promise<void>;

  save(dispatch: Dispatch): Promise<void>;

  find(id: RunId): Promise<Dispatch | null>;
}
