import type { RunServiceShape } from '@runs/application/contracts/run-spec.contract';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CHECKOUT_SERVICES = Symbol('CHECKOUT_SERVICES');

/** A repository a run checks out, at the branch or commit it checks out, or at its default branch where null. */
export interface ServicesAt {
  readonly repository: Repository;
  readonly ref: string | null;
}

/**
 * Finds the services a run's checkouts need beside its sandbox, from the Compose files at their tops. Every path
 * that orders a run with a new spec asks it, so a task, a chat and a replay of a task get services the same way.
 */
export interface CheckoutServicesPort {
  of(
    workspaceId: WorkspaceId,
    at: readonly ServicesAt[],
  ): Promise<readonly RunServiceShape[]>;
}
