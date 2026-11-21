import { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import { ExpiredPlanTermError } from '@catalog/domain/exceptions/expired-plan-term.error';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { WorkspacePlanChangeDetail } from '@catalog/domain/value-objects/workspace-plan-change-detail.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const assertNotExpired = (term: PlanTerm, now: Date): void => {
  if (term.expiresAt && term.isExpiredAt(now)) {
    throw new ExpiredPlanTermError(term.expiresAt);
  }
};

// A stored plan never holds the free plan: a workspace without one has the free plan.
export class WorkspacePlan extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly term: PlanTerm,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  // Null for the free plan, which needs no stored plan.
  static create(input: {
    workspaceId: WorkspaceId;
    term: PlanTerm;
    by: ChangeActor;
    now: Date;
  }): WorkspacePlan | null {
    if (input.term.isFree) {
      return null;
    }

    assertNotExpired(input.term, input.now);

    const created = new WorkspacePlan(input.workspaceId, input.term, 0, false);

    created.record(
      new WorkspacePlanCreated(
        input.workspaceId,
        input.term,
        ConfigurationChange.created(
          created.whatChanged,
          input.by,
          WorkspacePlanChangeDetail.of(input.term),
        ),
      ),
    );

    return created;
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    term: PlanTerm;
    version: number;
  }): WorkspacePlan {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'workspace plan',
        `has an impossible version (${input.version})`,
      );
    }

    if (input.term.isFree) {
      throw new InconsistentStateError('workspace plan', 'holds the free plan');
    }

    return new WorkspacePlan(
      input.workspaceId,
      input.term,
      input.version,
      false,
    );
  }

  // Deleted for the free plan, and null when the term does not change. It refuses an expired term, also the term it has.
  set(term: PlanTerm, by: ChangeActor, now: Date): WorkspacePlan | null {
    this.assertNotDeleted();

    if (term.isFree) {
      return this.delete(by);
    }

    assertNotExpired(term, now);

    if (term.equals(this.term)) {
      return null;
    }

    const updated = this.with(term, false);

    updated.record(
      new WorkspacePlanUpdated(
        this.workspaceId,
        term,
        this.term,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          WorkspacePlanChangeDetail.of(term),
        ),
      ),
    );

    return updated;
  }

  delete(by: ChangeActor): WorkspacePlan {
    this.assertNotDeleted();

    const deleted = this.with(this.term, true);

    deleted.record(
      new WorkspacePlanDeleted(
        this.workspaceId,
        this.term,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-plan' as const,
      id: this.workspaceId.value,
      key: 'plan',
    };
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'workspace plan',
        'was changed after it was deleted',
      );
    }
  }

  private with(term: PlanTerm, deleted: boolean): WorkspacePlan {
    const next = new WorkspacePlan(
      this.workspaceId,
      term,
      this.version,
      deleted,
    );
    next.inheritEvents(this);

    return next;
  }
}
